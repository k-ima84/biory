import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function testFoodSearch() {
  console.log("=== 食品検索テスト開始 ===");
  
  try {
    // 全食品データを取得
    const { data: allFoods } = await client.models.FoodNutrition.list();
    console.log(`総食品数: ${allFoods.length}件`);

    // コッペパン検索テスト
    console.log("\n=== コッペパン検索テスト ===");
    const coppepanResults = allFoods.filter(food => 
      food.foodName?.toLowerCase().includes("コッペパン".toLowerCase()) ||
      food.foodName?.toLowerCase().includes("こっぺぱん") ||
      food.foodName?.includes("コッペパン")
    );
    
    console.log(`コッペパン関連: ${coppepanResults.length}件`);
    coppepanResults.forEach((food, index) => {
      console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal`);
    });

    // パン類の検索テスト
    console.log("\n=== パン類検索テスト ===");
    const panResults = allFoods.filter(food => 
      food.foodName?.includes("パン")
    );
    
    console.log(`パン関連: ${panResults.length}件（上位10件表示）`);
    panResults.slice(0, 10).forEach((food, index) => {
      console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal`);
    });

    // こむぎ検索テスト
    console.log("\n=== こむぎ検索テスト ===");
    const komugiResults = allFoods.filter(food => 
      food.foodName?.includes("こむぎ") ||
      food.foodName?.includes("小麦")
    );
    
    console.log(`こむぎ関連: ${komugiResults.length}件（上位5件表示）`);
    komugiResults.slice(0, 5).forEach((food, index) => {
      console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal`);
    });

    return true;
  } catch (error) {
    console.error("検索テストエラー:", error);
    return false;
  }
}

testFoodSearch().then((success) => {
  if (success) {
    console.log("\n=== テスト完了 - 成功 ===");
  } else {
    console.log("\n=== テスト完了 - エラー ===");
  }
  process.exit(0);
});