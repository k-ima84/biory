import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function getAllFoods() {
  try {
    console.log("全食品データを取得中...");
    
    let allFoods: any[] = [];
    let nextToken: string | null = null;
    
    do {
      const result: any = await client.models.FoodNutrition.list({
        limit: 1000,
        nextToken: nextToken || undefined
      });
      
      if (result.data) {
        allFoods = allFoods.concat(result.data);
        console.log(`取得済み: ${allFoods.length}件`);
      }
      
      nextToken = result.nextToken;
    } while (nextToken);
    
    console.log(`\n全件数: ${allFoods.length}件`);
    
    // コッペパン検索
    const coppepan = allFoods.find(food => food.foodName?.includes("コッペパン"));
    if (coppepan) {
      console.log("✅ コッペパン見つかりました:");
      console.log(`   ${coppepan.foodName}: ${coppepan.energyKcal}kcal, P:${coppepan.proteinG}g, F:${coppepan.fatG}g, C:${coppepan.carbohydrateG}g`);
    } else {
      console.log("❌ コッペパンが見つかりません");
      
      // パンを含む食品を検索
      const breadFoods = allFoods.filter(food => 
        food.foodName?.toLowerCase().includes("パン") || 
        food.foodName?.toLowerCase().includes("ぱん") ||
        food.foodName?.toLowerCase().includes("こっぺ")
      );
      
      console.log(`\nパン関連食品: ${breadFoods.length}件`);
      breadFoods.slice(0, 10).forEach(food => {
        console.log(`- ${food.foodName}: ${food.energyKcal}kcal`);
      });
    }
    
  } catch (error) {
    console.error("エラー:", error);
  }
  process.exit(0);
}

getAllFoods();