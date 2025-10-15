import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function quickTest() {
  try {
    const { data: allFoods } = await client.models.FoodNutrition.list();
    console.log(`全件数: ${allFoods.length}件`);
    
    // コッペパン検索
    const coppepan = allFoods.find(food => food.foodName?.includes("コッペパン"));
    if (coppepan) {
      console.log("✅ コッペパン見つかりました:");
      //console.log(`   ${coppepan.foodName}: ${coppepan.energyKcal}kcal, P:${coppepan.proteinG}g, F:${coppepan.fatG}g, C:${coppepan.carbohydrateG}g`);
      console.log(`   ${coppepan.foodName}: ${coppepan.energyKcal}kcal, P:${coppepan.protein}g, F:${coppepan.fat}g, C:${coppepan.carbs}g`);
    } else {
      console.log("❌ コッペパンが見つかりません");
    }
    
    // 最新の5件を表示
    console.log("\n最新の5件:");
    allFoods.slice(-5).forEach((food, index) => {
      //console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal, P:${food.proteinG}g`);
      console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal, P:${food.protein}g`);
    });
    
  } catch (error) {
    console.error("エラー:", error);
  }
  process.exit(0);
}

quickTest();