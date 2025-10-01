import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function testNutritionCalculation() {
  console.log("=== 栄養計算テスト ===");
  
  try {
    // 1. 食品検索テスト
    console.log("\n1. 食品検索テスト");
    
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
    
    console.log(`全食品データ: ${allFoodData.length}件`);
    
    // 2. 「ご飯」検索テスト
    const testFoodName = "ご飯";
    const matchedFood = allFoodData.find(food => 
      food.foodName?.includes(testFoodName) || testFoodName.includes(food.foodName || '')
    );
    
    if (matchedFood) {
      console.log(`✅ ${testFoodName}発見:`, {
        name: matchedFood.foodName,
        calories: matchedFood.energyKcal,
        protein: matchedFood.proteinG,
        fat: matchedFood.fatG,
        carbs: matchedFood.carbohydrateG
      });
    } else {
      console.log(`❌ ${testFoodName}未発見`);
      
      // 「米」を含む食品を検索
      const riceFoods = allFoodData.filter(food => 
        food.foodName?.includes("米") || food.foodName?.includes("こめ")
      );
      console.log(`米関連食品: ${riceFoods.length}件`);
      riceFoods.slice(0, 5).forEach(food => {
        console.log(`- ${food.foodName}: ${food.energyKcal}kcal`);
      });
    }
    
    // 3. 複数食品の栄養計算テスト
    console.log("\n3. 複数食品栄養計算テスト");
    const testMeals = ["ご飯", "鶏肉", "野菜"];
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    
    for (const meal of testMeals) {
      const food = allFoodData.find(f => 
        f.foodName?.includes(meal) || meal.includes(f.foodName || '')
      );
      
      if (food) {
        const calories = food.energyKcal || 0;
        const protein = food.proteinG || 0;
        const fat = food.fatG || 0;
        const carbs = food.carbohydrateG || 0;
        
        console.log(`${meal}: ${calories}kcal, P:${protein}g, F:${fat}g, C:${carbs}g`);
        
        totalCalories += calories;
        totalProtein += protein;
        totalFat += fat;
        totalCarbs += carbs;
      } else {
        console.log(`${meal}: 未発見`);
      }
    }
    
    console.log("\n合計:");
    console.log(`カロリー: ${Math.round(totalCalories)}kcal`);
    console.log(`タンパク質: ${Math.round(totalProtein * 10) / 10}g`);
    console.log(`脂質: ${Math.round(totalFat * 10) / 10}g`);
    console.log(`炭水化物: ${Math.round(totalCarbs * 10) / 10}g`);
    
  } catch (error) {
    console.error("テストエラー:", error);
  }
  
  process.exit(0);
}

testNutritionCalculation();