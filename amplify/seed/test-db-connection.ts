import { client, log } from './common';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Amplifyの設定から現在の環境情報を取得する関数
function getAmplifyEnvironmentInfo(): { region: string; profile: string } {
  try {
    const outputsPath = path.join(process.cwd(), 'amplify_outputs.json');
    const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
    
    // amplify_outputs.jsonからリージョンを取得
    const region = outputs.data?.aws_region || 'ap-northeast-1';
    
    // AWS_PROFILEまたはAWS_DEFAULT_PROFILEを確認、なければdefault
    const profile = process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE || 'default';
    
    log.info(`🔧 検出された環境設定: profile=${profile}, region=${region}`);
    
    return { region, profile };
  } catch (error) {
    log.error(`設定取得エラー（デフォルト値を使用）: ${error}`);
    return { region: 'ap-northeast-1', profile: 'default' };
  }
}

// Amplifyクライアントが実際に使用するテーブルを特定する関数
async function getAmplifyConnectedTables(): Promise<{ nutrition: string; meal: string; nutritionCount: number; mealCount: number } | null> {
  try {
    // Amplifyクライアントでデータを取得して実際のテーブルを特定
    const { data: nutritions } = await client.models.Nutrition.list();
    const { data: meals } = await client.models.DailyRecord.list();
    
    const nutritionCount = nutritions?.length || 0;
    const mealCount = meals?.length || 0;
    
    // 環境設定を取得
    const { region, profile } = getAmplifyEnvironmentInfo();
    
    // AWS CLIで全テーブルを取得
    const output = execSync(`aws dynamodb list-tables --profile ${profile} --region ${region}`, { 
      encoding: 'utf8',
      timeout: 10000 
    });
    
    const tablesData = JSON.parse(output);
    const allTables = tablesData.TableNames || [];
    
    // Nutrition/Mealテーブルを抽出
    const nutritionTables = allTables.filter((name: string) => name.includes('Nutrition'));
    const mealTables = allTables.filter((name: string) => name.includes('Meal'));
    
    let actualNutritionTable = '';
    let actualMealTable = '';
    
    // 各テーブルのデータ件数を確認して、Amplifyクライアントの結果と一致するものを特定
    for (const table of nutritionTables) {
      try {
        const result = execSync(`aws dynamodb scan --table-name ${table} --select COUNT --profile ${profile} --region ${region}`, { 
          encoding: 'utf8' 
        });
        const count = JSON.parse(result).Count;
        if (count === nutritionCount) {
          actualNutritionTable = table;
          break;
        }
      } catch (error) {
        // アクセスできないテーブルはスキップ
      }
    }
    
    for (const table of mealTables) {
      try {
        const result = execSync(`aws dynamodb scan --table-name ${table} --select COUNT --profile ${profile} --region ${region}`, { 
          encoding: 'utf8' 
        });
        const count = JSON.parse(result).Count;
        if (count === mealCount) {
          actualMealTable = table;
          break;
        }
      } catch (error) {
        // アクセスできないテーブルはスキップ
      }
    }
    
    return {
      nutrition: actualNutritionTable || 'Nutrition（特定失敗）',
      meal: actualMealTable || 'Meal（特定失敗）',
      nutritionCount,
      mealCount
    };
  } catch (error) {
    log.error(`Amplifyテーブル特定エラー: ${error}`);
    return null;
  }
}

async function testDatabase(): Promise<void> {
  try {
    log.info('DynamoDBへの接続をテスト中...');
    
    // Amplifyクライアントが実際に接続しているテーブルを特定
    const tableInfo = await getAmplifyConnectedTables();
    if (tableInfo) {
      log.info('📊 Amplifyが接続中のDynamoDBテーブル情報:');
      console.log(`  🥗 Nutritionテーブル: ${tableInfo.nutrition}`);
      console.log(`  🍽️ Mealテーブル: ${tableInfo.meal}`);
      console.log(''); // 空行
    }
    
    // Nutritionテーブルの全データを取得
    const { data: nutritions } = await client.models.Nutrition.list();
    log.data(`🥗 Nutritionテーブル（${tableInfo?.nutrition || 'Nutrition'}）のデータ件数`, nutritions?.length || 0);
    
    if (nutritions && nutritions.length > 0) {
      log.success('取得したNutritionデータ:');
      nutritions.forEach((nutrition, index) => {
        console.log(`  ${index + 1}. UserID: ${nutrition.userId}, Date: ${nutrition.date}, Calories: ${nutrition.calories}`);
      });
    } else {
      log.error('Nutritionテーブルにデータが存在しません');
    }

    console.log(''); // 空行

    // DailyRecordテーブルの全データを取得
    const { data: meals } = await client.models.DailyRecord.list();
    log.data(`📝 DailyRecordテーブルのデータ件数`, meals?.length || 0);
    
    if (meals && meals.length > 0) {
      log.success('取得したDailyRecordデータ:');
      meals.forEach((meal, index) => {
        console.log(`  ${index + 1}. UserID: ${meal.userId}, Date: ${meal.date}, Type: ${meal.mealType}, Content: ${meal.content}`);
      });
    } else {
      log.error('DailyRecordテーブルにデータが存在しません');
    }

    log.success('データベーステスト完了');

  } catch (error) {
    log.error(`データベース接続エラー: ${error}`);
    throw error;
  }
}

// 直接実行時の処理
testDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log.error(`テスト失敗: ${error}`);
    process.exit(1);
  });
