// scripts/check-environment.ts
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

const checkEnvironment = async () => {
  console.log('=== 🔍 環境確認開始 ===');
  
  try {
    // 1. Amplify設定確認
    console.log('\n📋 1. Amplify設定確認');
    console.log('✅ Amplify.configure() 完了');
    console.log('✅ GraphQLクライアント生成完了');
    
    // 2. FoodNutritionテーブル確認
    console.log('\n🍽️ 2. FoodNutritionテーブル確認');
    
    let totalCount = 0;
    let nextToken: string | null = null;
    
    do {
      const result: any = await client.models.FoodNutrition.list({
        limit: 1000,
        nextToken: nextToken || undefined
      });
      
      if (result.data) {
        totalCount += result.data.length;
        nextToken = result.nextToken;
      } else {
        break;
      }
    } while (nextToken);
    
    console.log(`📊 FoodNutritionデータ件数: ${totalCount}件`);
    
    // 3. サンプルデータ確認
    if (totalCount > 0) {
      console.log('\n🔬 3. サンプルデータ確認（最初の3件）');
      const { data: sampleData }: any = await client.models.FoodNutrition.list({
        limit: 3
      });
      
      sampleData?.forEach((item: any, index: number) => {
        console.log(`${index + 1}. ${item.foodName}: ${item.energyKcal}kcal, P:${item.protein}g, F:${item.fat}g, C:${item.carbs}g`);
      });
    }
    
    // 4. CSVファイル確認
    console.log('\n📁 4. CSVファイル確認');
    const fs = require('fs');
    const csvExists = fs.existsSync('./nutrition-data.csv');
    console.log(`CSV ファイル存在: ${csvExists ? '✅ あり' : '❌ なし'}`);
    
    if (csvExists) {
      const csvStats = fs.statSync('./nutrition-data.csv');
      console.log(`CSV ファイルサイズ: ${(csvStats.size / 1024).toFixed(2)} KB`);
    }
    
    // 5. 判定結果
    console.log('\n🎯 5. 判定結果');
    if (totalCount === 0) {
      console.log('❌ FoodNutritionデータが空です');
      if (csvExists) {
        console.log('✅ CSVファイルが存在するため、自動インポートを実行します');
        
        // 自動インポート実行
        console.log('\n🚀 6. CSV自動インポート開始');
        await importCSVData();
        
        return { needsImport: false, csvExists: true, imported: true };
      } else {
        console.log('❌ CSVファイルも存在しません');
        console.log('📝 対処法: nutrition-data.csvファイルをプロジェクトルートに配置してください');
        return { needsImport: true, csvExists: false };
      }
    } else {
      console.log('✅ FoodNutritionデータが存在します');
      return { needsImport: false, csvExists: csvExists };
    }
    
  } catch (error) {
    console.error('❌ 環境確認エラー:', error);
    return { needsImport: true, csvExists: false, error: error };
  }
};

// CSV自動インポート関数
const importCSVData = async () => {
  try {
    const fs = require('fs');
    const csvData = fs.readFileSync('./nutrition-data.csv', 'utf-8');
    const lines = csvData.split('\n');
    
    console.log(`📄 CSVファイル読み込み完了: ${lines.length}行`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // ヘッダー行をスキップして、2行目からデータ処理
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        try {
          const columns = line.split(',');
          
          if (columns.length >= 6) {
            const food = {
              foodName: columns[1].replace(/"/g, '').trim(),
              energyKcal: parseInt(columns[2]) || 0,
              protein: parseFloat(columns[3]) || 0,
              fat: parseFloat(columns[4]) || 0,
              carbs: parseFloat(columns[5]) || 0,
              category: columns[0].replace(/"/g, '').trim(),
            };
            
            if (food.foodName) {
              await client.models.FoodNutrition.create(food);
              successCount++;
              
              // 100件ごとに進捗表示
              if (successCount % 100 === 0) {
                console.log(`⏳ 進捗: ${successCount}件完了`);
              }
            }
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ 行${i}のインポートエラー:`, error);
        }
        
        // APIレート制限対策
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
    
    console.log(`\n🎉 CSVインポート完了:`);
    console.log(`✅ 成功: ${successCount}件`);
    console.log(`❌ エラー: ${errorCount}件`);
    
  } catch (error) {
    console.error('❌ CSVインポートエラー:', error);
    throw error;
  }
};

// メイン実行
if (require.main === module) {
  checkEnvironment().then(result => {
    console.log('\n=== 📊 最終結果 ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n🎯 次のステップ:');
    if (result.imported) {
      console.log('✅ 環境準備完了！アプリケーションを起動できます');
    } else if (result.needsImport && !result.csvExists) {
      console.log('📝 nutrition-data.csvファイルをプロジェクトルートに配置して再実行してください');
    } else {
      console.log('✅ すべて正常です');
    }
  });
}

export { checkEnvironment };