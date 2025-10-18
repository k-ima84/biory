import { client, log } from './common';

async function clearDatabase(): Promise<void> {
  try {
    log.info('データベースのクリアを開始します...');
    
    // 既存のNutritionデータを削除
    const { data: nutritions } = await client.models.Nutrition.list();
    if (nutritions && nutritions.length > 0) {
      log.info(`${nutritions.length}件のNutritionデータを削除中...`);
      for (const nutrition of nutritions) {
        await client.models.Nutrition.delete({ id: nutrition.id });
      }
      log.success('Nutritionデータの削除完了');
    }

    // 既存のDailyRecordデータを削除
    const { data: meals } = await client.models.DailyRecord.list();
    if (meals && meals.length > 0) {
      log.info(`${meals.length}件のDailyRecordデータを削除中...`);
      for (const meal of meals) {
        await client.models.DailyRecord.delete({ id: meal.id });
      }
      log.success('DailyRecordデータの削除完了');
    }

    log.success('🧹 データベースのクリア完了');

  } catch (error) {
    log.error(`データベースクリアエラー: ${error}`);
    throw error;
  }
}

// 直接実行時の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('clear-db.ts')) {
  clearDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      log.error(`クリア失敗: ${error}`);
      process.exit(1);
    });
}
