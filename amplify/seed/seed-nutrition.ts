import { client, log } from './common';

// 栄養データの型定義
interface NutritionInput {
  userId: string;
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// 栄養データのサンプル
const nutritionDataList: NutritionInput[] = [
  {
    calories: 1200,
    carbs: 150,
    date: '2025-08-27',
    fat: 30,
    protein: 50,
    userId: 'user1'
  },
  {
    calories: 1300,
    carbs: 160,
    date: '2025-09-17',
    fat: 70,
    protein: 80,
    userId: 'user2'
  },
  {
    calories: 1250,
    carbs: 155,
    date: '2025-09-17',
    fat: 35,
    protein: 60,
    userId: 'user1'
  }
];

export const seedNutritionData = async (): Promise<void> => {
  try {
    log.info('栄養データの投入を開始します...');
    log.data(`投入するデータ数`, `${nutritionDataList.length}件`);

    for (let i = 0; i < nutritionDataList.length; i++) {
      const nutritionData = nutritionDataList[i];
      log.info(`データ ${i + 1}/${nutritionDataList.length} を投入中...`);
      log.data('投入データ', nutritionData);

      const result = await client.models.Nutrition.create(nutritionData);
      
      if (result.data) {
        log.success(`データ ${i + 1} の投入完了: ID=${result.data.id}`);
      } else if (result.errors) {
        log.error(`データ ${i + 1} の投入エラー: ${JSON.stringify(result.errors)}`);
      }
    }

    log.success('🎉 栄養データの投入が完了しました！');
  } catch (error) {
    log.error(`栄養データ投入エラー: ${error}`);
    throw error;
  }
};

// 直接実行時の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed-nutrition.ts')) {
  console.log('seed-nutrition.ts: スクリプト開始');
  log.info('栄養データシード開始...');
  seedNutritionData()
    .then(() => {
      log.success('栄養データシード完了');
      process.exit(0);
    })
    .catch((error) => {
      log.error(`栄養データシード失敗: ${error}`);
      process.exit(1);
    });
}
