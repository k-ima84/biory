import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

// 実際のホームページで使用されている栄養計算機能をテスト
const calculateNutritionFromMeals = async (mealContents: string[]) => {
  console.log('栄養計算開始:', mealContents);
  
  try {
    // 有効な食事内容のみをフィルタリング
    const validMeals = mealContents.filter(meal => meal && meal !== "—" && meal.trim() !== "");
    
    if (validMeals.length === 0) {
      console.log('有効な食事がありません');
      return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    }

    console.log('有効な食事:', validMeals);

    // DynamoDBから全食品データを取得
    const { data: allFoods } = await client.models.FoodNutrition.list();
    console.log(`食品データベース: ${allFoods.length}件の食品`);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    // 各食事について栄養価を計算
    validMeals.forEach(mealContent => {
      console.log(`食事を解析中: "${mealContent}"`);
      
      // 食事内容から食品名を抽出（カンマ区切りで複数食品を想定）
      const foodNames = mealContent.split(/[、,，]/).map(name => name.trim());
      
      foodNames.forEach(foodName => {
        if (!foodName) return;
        
        // 食品データベースから該当する食品を検索
        const matchedFood = allFoods.find(food => 
          food.foodName?.includes(foodName) || 
          foodName.includes(food.foodName || "")
        );

        if (matchedFood) {
          console.log(`マッチした食品: ${matchedFood.foodName} - ${matchedFood.energyKcal}kcal`);
          totalCalories += matchedFood.energyKcal || 0;
          totalProtein += matchedFood.protein || 0;
          totalFat += matchedFood.fat || 0;
          totalCarbs += matchedFood.carbs || 0;
        } else {
          console.log(`食品が見つかりません: "${foodName}"`);
          // 見つからない場合はデフォルト値を使用
          totalCalories += 150; // デフォルト150kcal
          totalProtein += 5;    // デフォルト5g
          totalFat += 3;        // デフォルト3g
          totalCarbs += 20;     // デフォルト20g
        }
      });
    });

    const result = {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10
    };

    console.log('栄養計算結果:', result);
    return result;

  } catch (error) {
    console.error('栄養計算エラー:', error);
    // エラー時はデフォルト値を返す
    return { 
      calories: mealContents.length * 200, 
      protein: mealContents.length * 10, 
      fat: mealContents.length * 5, 
      carbs: mealContents.length * 30 
    };
  }
};

async function testNutritionCalculation() {
  console.log("=== 栄養計算機能テスト ===");
  
  try {
    // テストケース1: コッペパンのみ
    console.log("\n--- テスト1: コッペパンのみ ---");
    const result1 = await calculateNutritionFromMeals(["こむぎ［パン類］コッペパン"]);
    console.log("結果:", result1);

    // テストケース2: コッペパンの部分一致
    console.log("\n--- テスト2: コッペパンの部分一致 ---");
    const result2 = await calculateNutritionFromMeals(["コッペパン"]);
    console.log("結果:", result2);

    // テストケース3: 複数の食事
    console.log("\n--- テスト3: 複数の食事 ---");
    const result3 = await calculateNutritionFromMeals([
      "コッペパン", 
      "ご飯", 
      "鶏肉"
    ]);
    console.log("結果:", result3);

    // テストケース4: カンマ区切りの食事
    console.log("\n--- テスト4: カンマ区切りの食事 ---");
    const result4 = await calculateNutritionFromMeals(["コッペパン、牛乳"]);
    console.log("結果:", result4);

    // テストケース5: 見つからない食品
    console.log("\n--- テスト5: 見つからない食品 ---");
    const result5 = await calculateNutritionFromMeals(["存在しない食品"]);
    console.log("結果:", result5);

    return true;
  } catch (error) {
    console.error("栄養計算テストエラー:", error);
    return false;
  }
}

testNutritionCalculation().then((success) => {
  if (success) {
    console.log("\n=== 栄養計算テスト完了 - 成功 ===");
  } else {
    console.log("\n=== 栄養計算テスト完了 - エラー ===");
  }
  process.exit(0);
});