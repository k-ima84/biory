import { client, log } from './common';
import { execSync } from 'child_process';

// 全てのDynamoDBテーブルを確認する関数
async function debugAllTables(): Promise<void> {
  try {
    log.info('🔍 全DynamoDBテーブルのデバッグ開始...');
    
    // AWS CLIで全テーブル一覧を取得
    const bioryDevOutput = execSync('aws dynamodb list-tables --profile biory-dev --region ap-northeast-1', { 
      encoding: 'utf8',
      timeout: 10000 
    });
    
    const defaultOutput = execSync('aws dynamodb list-tables --profile default --region ap-northeast-1', { 
      encoding: 'utf8',
      timeout: 10000 
    });
    
    const bioryDevTables = JSON.parse(bioryDevOutput).TableNames || [];
    const defaultTables = JSON.parse(defaultOutput).TableNames || [];
    
    log.info('📊 biory-devプロファイルのテーブル:');
    const bioryDevNutrition = bioryDevTables.filter((name: string) => name.includes('Nutrition'));
    const bioryDevMeal = bioryDevTables.filter((name: string) => name.includes('Meal'));
    console.log(`  🥗 Nutrition: ${bioryDevNutrition}`);
    console.log(`  🍽️ Meal: ${bioryDevMeal}`);
    
    log.info('📊 defaultプロファイルのテーブル:');
    const defaultNutrition = defaultTables.filter((name: string) => name.includes('Nutrition'));
    const defaultMeal = defaultTables.filter((name: string) => name.includes('Meal'));
    console.log(`  🥗 Nutrition: ${defaultNutrition}`);
    console.log(`  🍽️ Meal: ${defaultMeal}`);
    
    console.log(''); // 空行
    
    // 各テーブルのデータ件数をチェック
    log.info('📈 各テーブルのデータ件数:');
    
    // biory-devプロファイルのテーブル
    for (const tableName of bioryDevNutrition) {
      try {
        const result = execSync(`aws dynamodb scan --table-name ${tableName} --select COUNT --profile biory-dev --region ap-northeast-1`, { 
          encoding: 'utf8' 
        });
        const count = JSON.parse(result).Count;
        console.log(`  🥗 ${tableName} (biory-dev): ${count}件`);
      } catch (error) {
        console.log(`  ❌ ${tableName} (biory-dev): エラー`);
      }
    }
    
    for (const tableName of bioryDevMeal) {
      try {
        const result = execSync(`aws dynamodb scan --table-name ${tableName} --select COUNT --profile biory-dev --region ap-northeast-1`, { 
          encoding: 'utf8' 
        });
        const count = JSON.parse(result).Count;
        console.log(`  🍽️ ${tableName} (biory-dev): ${count}件`);
      } catch (error) {
        console.log(`  ❌ ${tableName} (biory-dev): エラー`);
      }
    }
    
    // defaultプロファイルのテーブル
    for (const tableName of defaultNutrition) {
      try {
        const result = execSync(`aws dynamodb scan --table-name ${tableName} --select COUNT --profile default --region ap-northeast-1`, { 
          encoding: 'utf8' 
        });
        const count = JSON.parse(result).Count;
        console.log(`  🥗 ${tableName} (default): ${count}件`);
      } catch (error) {
        console.log(`  ❌ ${tableName} (default): エラー`);
      }
    }
    
    for (const tableName of defaultMeal) {
      try {
        const result = execSync(`aws dynamodb scan --table-name ${tableName} --select COUNT --profile default --region ap-northeast-1`, { 
          encoding: 'utf8' 
        });
        const count = JSON.parse(result).Count;
        console.log(`  🍽️ ${tableName} (default): ${count}件`);
      } catch (error) {
        console.log(`  ❌ ${tableName} (default): エラー`);
      }
    }
    
    console.log(''); // 空行
    
    // Amplifyクライアントでのデータ取得
    log.info('🔗 Amplifyクライアントでのデータ取得:');
    
    const { data: nutritions } = await client.models.Nutrition.list();
    const { data: meals } = await client.models.DailyRecord.list();
    
    console.log(`  🥗 Amplify Nutritionデータ件数: ${nutritions?.length || 0}件`);
    console.log(`  📝 Amplify DailyRecordデータ件数: ${meals?.length || 0}件`);
    
    // amplify_outputs.jsonの設定を確認
    log.info('⚙️ 現在のAmplify設定:');
    const fs = require('fs');
    const path = require('path');
    const outputsPath = path.join(process.cwd(), 'amplify_outputs.json');
    const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
    
    console.log(`  GraphQL URL: ${outputs.data?.url}`);
    console.log(`  AWS Region: ${outputs.data?.aws_region}`);
    console.log(`  API Key: ${outputs.data?.api_key?.substring(0, 10)}...`);
    
    log.success('デバッグ完了');

  } catch (error) {
    log.error(`デバッグエラー: ${error}`);
    throw error;
  }
}

// 直接実行時の処理
debugAllTables()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log.error(`デバッグ失敗: ${error}`);
    process.exit(1);
  });
