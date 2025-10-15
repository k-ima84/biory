import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json" with { type: "json" };
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

// ブラウザ経由でFoodNutritionにデータをインポートする関数
export const importFoodNutritionData = async (csvData: string) => {
  try {
    console.log('=== CSVデータインポート開始 ===');
    
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    const foods = [];
    
    // ヘッダー行をスキップ（1行目）
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const columns = line.split(',');
        if (columns.length >= 6) {
          const food = {
            foodName: columns[1].replace(/"/g, '').trim(),
            energyKcal: parseInt(columns[2]) || 0,
            protein: parseFloat(columns[3]) || 0,
            fat: parseFloat(columns[4]) || 0,
            carbs: parseFloat(columns[5]) || 0,
          };
          
          if (food.foodName && food.energyKcal > 0) {
            foods.push(food);
          }
        }
      }
    }
    
    console.log(`変換完了: ${foods.length}件の食品データ`);
    
    // サンプルデータ表示
    if (foods.length > 0) {
      console.log('サンプルデータ（最初の3件）:');
      foods.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.foodName}: ${item.energyKcal}kcal, P:${item.protein}g, F:${item.fat}g, C:${item.carbs}g`);
      });
    }
    
    // DynamoDBに保存
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`\nDynamoDBに${foods.length}件のデータを保存開始`);
    
    // バッチ処理で効率的に保存（10件ずつ）
    const batchSize = 10;
    for (let i = 0; i < foods.length; i += batchSize) {
      const batch = foods.slice(i, i + batchSize);
      
      const promises = batch.map(async (food) => {
        try {
          await client.models.FoodNutrition.create({
            foodName: food.foodName,
            energyKcal: food.energyKcal,
            protein: food.protein,
            fat: food.fat,
            carbs: food.carbs,
            per100g: true,
          });
          return { success: true, food: food.foodName };
        } catch (error) {
          return { success: false, food: food.foodName, error };
        }
      });
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          console.error(`保存エラー - ${result.food}:`, result.error);
        }
      });
      
      // 進捗表示
      console.log(`進捗: ${Math.min(i + batchSize, foods.length)}/${foods.length} (成功: ${successCount}, エラー: ${errorCount})`);
      
      // レート制限を避けるための待機
      if (i + batchSize < foods.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n=== インポート完了 ===`);
    console.log(`成功: ${successCount}件`);
    console.log(`エラー: ${errorCount}件`);
    
    return {
      success: successCount,
      errors: errorCount,
      total: foods.length
    };
    
  } catch (error) {
    console.error('インポートエラー:', error);
    throw error;
  }
};

// CSVファイルを読み込んでインポートする関数
export const importCSVFile = async (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvData = e.target?.result as string;
        const result = await importFoodNutritionData(csvData);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('ファイル読み込みエラー'));
    reader.readAsText(file, 'utf-8');
  });
};