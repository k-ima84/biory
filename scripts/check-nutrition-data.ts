import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function checkNutritionData() {
  console.log("=== 栄養データ確認 ===");
  
  try {
    // 全件数確認
    const { data: allFoods } = await client.models.FoodNutrition.list();
    console.log(`登録済み食品数: ${allFoods.length}件`);
    
    if (allFoods.length === 0) {
      console.log("データが登録されていません。");
      return;
    }
    
    // 高カロリー食品トップ10
    console.log("\n=== 高カロリー食品トップ10 ===");
    const highCalorieFoods = allFoods
      .filter(food => food.energyKcal && food.energyKcal > 0)
      .sort((a, b) => (b.energyKcal || 0) - (a.energyKcal || 0))
      .slice(0, 10);
      
    highCalorieFoods.forEach((food, index) => {
      console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal`);
    });
    
    // サンプルデータ表示
    console.log("\n=== サンプルデータ（最初の5件） ===");
    allFoods.slice(0, 5).forEach((food, index) => {
      console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal, P:${food.protein}g, F:${food.fat}g, C:${food.carbs}g`);
    });
    
  } catch (error) {
    console.error("データベース接続エラー:", error);
  }
}

checkNutritionData().then(() => {
  console.log("\n=== 確認完了 ===");
  process.exit(0);
});