import { client, log } from './amplify/seed/common';

async function testDatabase(): Promise<void> {
  try {
    log.info('DynamoDBへの接続をテスト中...');
    
    // Nutritionテーブルの全データを取得
    const { data: nutritions } = await client.models.Nutrition.list();
    log.data('Nutritionテーブルのデータ件数', nutritions?.length || 0);
    
    if (nutritions && nutritions.length > 0) {
      log.success('取得したNutritionデータ:');
      nutritions.forEach((nutrition, index) => {
        console.log(`  ${index + 1}. UserID: ${nutrition.userId}, Date: ${nutrition.date}, Calories: ${nutrition.calories}`);
      });
    } else {
      log.error('Nutritionテーブルにデータが存在しません');
    }

    // Mealテーブルの全データを取得
    const { data: meals } = await client.models.Meal.list();
    log.data('Mealテーブルのデータ件数', meals?.length || 0);
    
    if (meals && meals.length > 0) {
      log.success('取得したMealデータ:');
      meals.forEach((meal, index) => {
        console.log(`  ${index + 1}. UserID: ${meal.userId}, Date: ${meal.date}, Type: ${meal.mealType}, Content: ${meal.content}`);
      });
    } else {
      log.error('Mealテーブルにデータが存在しません');
    }

    log.success('データベーステスト完了');

  } catch (error) {
    log.error(`データベース接続エラー: ${error}`);
    throw error;
  }
}

// 直接実行時の処理
if (typeof require !== 'undefined' && require.main === module) {
  testDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      log.error(`テスト失敗: ${error}`);
      process.exit(1);
    });
}
