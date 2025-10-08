import * as fs from 'fs';
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json" with { type: "json" };
import type { Schema } from "../amplify/data/resource";

// Amplify設定
console.log('Amplify設定開始...');
Amplify.configure(outputs);
console.log('Amplify設定完了');

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

// CSVファイルを読み取る関数
const readCSVFile = (filePath: string): CSVFoodItem[] => {
  try {
    console.log(`CSVファイルを読み取り中: ${filePath}`);
    
    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    console.log(`読み取り行数: ${lines.length}行`);
    
    // ヘッダー行をスキップして2行目から処理
    const dataLines = lines.slice(1);
    const foods: CSVFoodItem[] = [];
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;
      
      // CSV解析（簡単なsplit処理）
      const columns = line.split(',');
      
      if (columns.length >= 7) {
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
          foods.push(food);
        }
      }
    }
    
    console.log(`変換完了: ${foods.length}件の食品データ`);
    
    // サンプルデータ表示
    if (foods.length > 0) {
      console.log('\nサンプルデータ:');
      foods.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.foodName}: ${item.calories}kcal, P:${item.protein}g, F:${item.fat}g, C:${item.carbs}g`);
      });
    }
    
    return foods;
    
  } catch (error) {
    console.error('CSVファイル読み取りエラー:', error);
    return [];
  }
};

// DynamoDBにデータを保存する関数
const saveToDatabase = async (foods: CSVFoodItem[]) => {
  console.log(`\nDynamoDBに${foods.length}件のデータを保存開始`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const food of foods) {
    try {
      await client.models.FoodNutrition.create({
        foodName: food.foodName,
        energyKcal: food.calories,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs,
        per100g: true, // 100gあたりの値として設定
      });
      
      successCount++;
      
      // 100件ごとに進捗表示
      if (successCount % 100 === 0) {
        console.log(`進捗: ${successCount}/${foods.length}件完了`);
      }
      
    } catch (error) {
      console.error(`保存エラー - ${food.foodName}:`, error);
      errorCount++;
    }
    
    // APIレート制限を避けるため少し待機
    if (successCount % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`保存完了: 成功${successCount}件、エラー${errorCount}件`);
  return { success: successCount, error: errorCount };
};

// メイン実行関数
const main = async () => {
  try {
    console.log('=== CSV栄養データインポート開始 ===');
    
    const csvFilePath = './nutrition-data.csv';
    
    // CSVファイルを読み取り
    const foods = readCSVFile(csvFilePath);
    
    if (foods.length === 0) {
      console.log('データが見つかりませんでした。CSVファイルの内容を確認してください。');
      return;
    }
    
    console.log(`\n${foods.length}件のデータをDynamoDBに保存します。`);
    
    // データベースに保存
    const result = await saveToDatabase(foods);
    
    console.log('\n=== インポート完了 ===');
    console.log(`成功: ${result.success}件`);
    console.log(`エラー: ${result.error}件`);
    
  } catch (error) {
    console.error('インポート処理でエラーが発生:', error);
  }
};

// スクリプトとして実行
main().then(() => {
  console.log('\n処理を完了しました。');
  process.exit(0);
});