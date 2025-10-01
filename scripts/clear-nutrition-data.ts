import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function clearNutritionData() {
  console.log("=== 栄養データ全削除 ===");
  console.log("⚠️  この操作は元に戻せません！");
  
  try {
    // 全件取得
    const { data: allFoods } = await client.models.FoodNutrition.list();
    console.log(`削除対象: ${allFoods.length}件`);
    
    if (allFoods.length === 0) {
      console.log("削除するデータがありません。");
      return;
    }
    
    // コマンドライン引数で確認をスキップ
    const forceDelete = process.argv.includes('--confirm');
    
    if (!forceDelete) {
      console.log("\n削除を実行するには --confirm オプションを付けて実行してください:");
      console.log("npx tsx scripts/clear-nutrition-data.ts --confirm");
      return;
    }
    
    console.log("削除を開始します...");
    let deleteCount = 0;
    
    for (const food of allFoods) {
      try {
        await client.models.FoodNutrition.delete({ id: food.id });
        deleteCount++;
        
        if (deleteCount % 50 === 0) {
          console.log(`進捗: ${deleteCount}/${allFoods.length}件削除完了`);
        }
      } catch (error) {
        console.error(`削除エラー - ${food.foodName}:`, error);
      }
    }
    
    console.log(`削除完了: ${deleteCount}件`);
    
  } catch (error) {
    console.error("削除処理エラー:", error);
  }
}

clearNutritionData().then(() => {
  console.log("\n=== 削除処理完了 ===");
  process.exit(0);
});