import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json" with { type: "json" };
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function checkFoodNutritionData() {
  try {
    console.log("=== FoodNutrition データベース確認 ===");
    
    // 全てのFoodNutritionレコードを取得
    const { data: foods } = await client.models.FoodNutrition.list();
    
    if (foods && foods.length > 0) {
      console.log(`✅ FoodNutrition レコード数: ${foods.length}件`);
      
      // 最初の5件を詳細表示
      console.log("\n--- サンプルデータ（最初の5件）---");
      foods.slice(0, 5).forEach((food, index) => {
        console.log(`\n${index + 1}. ${food.foodName}`);
        console.log(`   カロリー: ${food.energyKcal}kcal`);
        console.log(`   タンパク質: ${food.protein}g`);
        console.log(`   脂質: ${food.fat}g`);
        console.log(`   炭水化物: ${food.carbs}g`);
        console.log(`   作成日: ${food.createdAt}`);
      });
      
      // 食品名での検索テスト
      console.log("\n=== 検索テスト ===");
      const searchTerms = ["コッペパン", "米", "鶏肉", "卵"];
      
      for (const term of searchTerms) {
        const matchingFoods = foods.filter(food => 
          food.foodName.includes(term)
        );
        console.log(`"${term}" で検索: ${matchingFoods.length}件`);
        if (matchingFoods.length > 0) {
          console.log(`  例: ${matchingFoods[0].foodName} (${matchingFoods[0].energyKcal}kcal)`);
        }
      }
      
      // 栄養価の統計
      console.log("\n=== 栄養価統計 ===");
      const calories = foods.map(f => f.energyKcal);
      const proteins = foods.map(f => f.protein);
      const avgCalories = calories.reduce((a, b) => a + b, 0) / calories.length;
      const avgProtein = proteins.reduce((a, b) => a + b, 0) / proteins.length;
      
      console.log(`平均カロリー: ${avgCalories.toFixed(1)}kcal`);
      console.log(`平均タンパク質: ${avgProtein.toFixed(1)}g`);
      console.log(`最高カロリー: ${Math.max(...calories)}kcal`);
      console.log(`最低カロリー: ${Math.min(...calories)}kcal`);
      
    } else {
      console.log("❌ FoodNutrition データが見つかりません");
      console.log("\n解決方法:");
      console.log("1. CSVインポートスクリプトを実行してください:");
      console.log("   npx tsx scripts/import-csv-nutrition.ts");
      console.log("2. または、既存の栄養データインポートスクリプトを実行:");
      console.log("   npx tsx scripts/import-nutrition-data.ts");
    }
    
  } catch (error) {
    console.error("❌ FoodNutrition データ確認エラー:", error);
    
    if (error instanceof Error && error.message.includes("No federated jwt")) {
      console.log("\n💡 認証エラーが発生しました。");
      console.log("   このスクリプトは認証が必要なため、ブラウザで実行してください。");
      console.log("   代わりに、ホーム画面で食事検索を試してみてください。");
    }
  }
}

checkFoodNutritionData();