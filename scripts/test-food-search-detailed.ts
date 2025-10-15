import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function testFoodSearch() {
  console.log("=== 食品検索テスト ===");
  
  try {
    const { data: allFoods } = await client.models.FoodNutrition.list();
    console.log(`全食品データ件数: ${allFoods.length}件`);
    
    // 最初の5件のデータ詳細を確認
    console.log("\n=== データ詳細（最初の5件） ===");
    allFoods.slice(0, 5).forEach((food, index) => {
      console.log(`${index + 1}. ${food.foodName}`);
      console.log(`   カロリー: ${food.energyKcal}kcal`);
      /*
      console.log(`   タンパク質: ${food.proteinG}g`);
      console.log(`   脂質: ${food.fatG}g`);
      console.log(`   炭水化物: ${food.carbohydrateG}g`);
      console.log(`   カテゴリ: ${food.category}`);
      */
      console.log(`   タンパク質: ${food.protein}g`);
      console.log(`   脂質: ${food.fat}g`);
      console.log(`   炭水化物: ${food.carbs}g`);
      console.log('');
    });
    
    // 「コッペパン」の検索テスト
    console.log("=== コッペパン検索テスト ===");
    const searchTerm = "コッペパン";
    const matchedFood = allFoods.find(food => 
      food.foodName?.includes(searchTerm) || searchTerm.includes(food.foodName || '')
    );
    
    if (matchedFood) {
      console.log("✅ 検索成功:");
      console.log(`   食品名: ${matchedFood.foodName}`);
      console.log(`   カロリー: ${matchedFood.energyKcal}kcal`);
      /*
      console.log(`   タンパク質: ${matchedFood.proteinG}g`);
      console.log(`   脂質: ${matchedFood.fatG}g`);
      console.log(`   炭水化物: ${matchedFood.carbohydrateG}g`);
      */
      console.log(`   タンパク質: ${matchedFood.protein}g`);
      console.log(`   脂質: ${matchedFood.fat}g`);
      console.log(`   炭水化物: ${matchedFood.carbs}g`);
    } else {
      console.log("❌ 検索結果なし");
    }
    
    // 「パン」を含む食品を検索
    console.log("\n=== パン関連食品検索 ===");
    const breadFoods = allFoods.filter(food => 
      food.foodName?.includes("パン") || food.foodName?.includes("ぱん")
    );
    
    console.log(`パン関連食品: ${breadFoods.length}件`);
    breadFoods.slice(0, 10).forEach((food, index) => {
      console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal`);
    });
    
  } catch (error) {
    console.error("テストエラー:", error);
  }
}

testFoodSearch().then(() => {
  console.log("\n=== テスト完了 ===");
  process.exit(0);
});