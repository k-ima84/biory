import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";
import * as fs from 'fs';

// Amplify設定
console.log('🔧 Amplify設定開始...');
Amplify.configure(outputs);
console.log('✅ Amplify設定完了');

const client = generateClient<Schema>();

interface CSVFoodItem {
  foodId: string;
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  category: string;
}

// DynamoDBの栄養データ件数を確認
async function checkNutritionDataCount(): Promise<number> {
  try {
    let totalCount = 0;
    let nextToken: string | null = null;
    
    do {
      const result: any = await client.models.FoodNutrition.list({
        limit: 1000,
        nextToken: nextToken || undefined
      });
      
      if (result.data) {
        totalCount += result.data.length;
      }
      
      nextToken = result.nextToken;
    } while (nextToken);
    
    return totalCount;
  } catch (error) {
    console.error('❌ DynamoDB接続エラー:', error);
    return 0;
  }
}

// CSVファイルの存在と件数を確認
function checkCSVFile(): { exists: boolean; count: number } {
  const csvPath = './nutrition-data.csv';
  
  try {
    if (!fs.existsSync(csvPath)) {
      return { exists: false, count: 0 };
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    const dataLines = lines.slice(1); // ヘッダー行を除く
    
    return { exists: true, count: dataLines.length };
  } catch (error) {
    console.error('❌ CSVファイル読み取りエラー:', error);
    return { exists: false, count: 0 };
  }
}

// CSVファイルを読み取ってDynamoDBに保存
async function importCSVData(): Promise<boolean> {
  try {
    console.log('📥 CSVデータのインポートを開始します...');
    
    const csvContent = fs.readFileSync('./nutrition-data.csv', 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    const dataLines = lines.slice(1); // ヘッダー行を除く
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const line of dataLines) {
      const columns = line.split(',');
      
      if (columns.length >= 7) {
        try {
          const food: CSVFoodItem = {
            foodId: columns[0].trim(),
            foodName: columns[1].trim(),
            calories: parseFloat(columns[2]) || 0,
            protein: parseFloat(columns[3]) || 0,
            fat: parseFloat(columns[4]) || 0,
            carbs: parseFloat(columns[5]) || 0,
            category: columns[6].trim(),
          };
          
          if (food.foodName) {
            await client.models.FoodNutrition.create({
              foodId: food.foodId,
              foodName: food.foodName,
              category: food.category,
              energyKcal: food.calories,
              proteinG: food.protein,
              fatG: food.fat,
              carbohydrateG: food.carbs,
            });
            
            successCount++;
            
            // 100件ごとに進捗表示
            if (successCount % 100 === 0) {
              console.log(`   進捗: ${successCount}/${dataLines.length}件完了`);
            }
          }
        } catch (error) {
          errorCount++;
          if (errorCount <= 5) { // 最初の5件のエラーのみ表示
            console.error(`   エラー (${errorCount}件目):`, error);
          }
        }
        
        // APIレート制限を避けるため少し待機
        if (successCount % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    console.log(`✅ インポート完了: 成功${successCount}件、エラー${errorCount}件`);
    return successCount > 0;
    
  } catch (error) {
    console.error('❌ CSVインポートエラー:', error);
    return false;
  }
}

// サンプルデータを表示
async function showSampleData(): Promise<void> {
  try {
    const result: any = await client.models.FoodNutrition.list({
      limit: 5
    });
    
    if (result.data && result.data.length > 0) {
      console.log('\n📋 サンプルデータ（最初の5件）:');
      result.data.forEach((food: any, index: number) => {
        console.log(`   ${index + 1}. ${food.foodName}: ${food.energyKcal}kcal, P:${food.proteinG}g, F:${food.fatG}g, C:${food.carbohydrateG}g`);
      });
    }
  } catch (error) {
    console.error('❌ サンプルデータ取得エラー:', error);
  }
}

// メイン環境確認関数
async function checkEnvironment() {
  console.log('\n🔍 === Biory環境確認開始 ===\n');
  
  // 1. DynamoDB接続確認
  console.log('1️⃣ DynamoDB接続確認...');
  const dbCount = await checkNutritionDataCount();
  console.log(`   DynamoDB栄養データ件数: ${dbCount}件`);
  
  // 2. CSVファイル確認
  console.log('\n2️⃣ CSVファイル確認...');
  const csvInfo = checkCSVFile();
  if (csvInfo.exists) {
    console.log(`   ✅ nutrition-data.csv存在: ${csvInfo.count}件のデータ`);
  } else {
    console.log('   ❌ nutrition-data.csvが見つかりません');
  }
  
  // 3. データ状況判定
  console.log('\n3️⃣ データ状況判定...');
  
  if (dbCount === 0 && csvInfo.exists) {
    console.log('   🚨 DynamoDBが空です。CSVデータを自動インポートします。');
    
    const imported = await importCSVData();
    if (imported) {
      console.log('   ✅ CSVデータのインポートが完了しました！');
      await showSampleData();
    } else {
      console.log('   ❌ CSVデータのインポートに失敗しました。');
    }
  } else if (dbCount > 0) {
    console.log(`   ✅ DynamoDBに${dbCount}件のデータが存在します。`);
    await showSampleData();
  } else if (dbCount === 0 && !csvInfo.exists) {
    console.log('   ⚠️ DynamoDBもCSVファイルも空です。');
    console.log('   💡 nutrition-data.csvファイルをプロジェクトルートに配置してください。');
  }
  
  // 4. 検索テスト
  console.log('\n4️⃣ 検索機能テスト...');
  try {
    let allFoodData: any[] = [];
    let nextToken: string | null = null;
    
    do {
      const result: any = await client.models.FoodNutrition.list({
        limit: 1000,
        nextToken: nextToken || undefined
      });
      
      if (result.data) {
        allFoodData = allFoodData.concat(result.data);
      }
      
      nextToken = result.nextToken;
    } while (nextToken);
    
    // コッペパン検索テスト
    const coppepan = allFoodData.find(food => food.foodName?.includes("コッペパン"));
    if (coppepan) {
      console.log(`   ✅ あいまい検索テスト成功: ${coppepan.foodName} (${coppepan.energyKcal}kcal)`);
    } else {
      console.log('   ⚠️ コッペパンが見つかりませんでした（データ不足の可能性）');
    }
    
  } catch (error) {
    console.log('   ❌ 検索テストでエラーが発生しました:', error);
  }
  
  console.log('\n🎉 === 環境確認完了 ===');
  console.log('\n💡 利用可能なコマンド:');
  console.log('   npm run check:env        - この環境確認を実行');
  console.log('   npm run check:nutrition  - 栄養データの詳細確認');
  console.log('   npm run clear:nutrition  - 栄養データの全削除');
  console.log('   npm run import:nutrition - 栄養データの手動インポート');
}

// 実行
checkEnvironment().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ 環境確認でエラーが発生しました:', error);
  process.exit(1);
});