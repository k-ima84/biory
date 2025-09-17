import { client, log } from './common';

// 食事データの型定義
interface MealInput {
  userId: string;
  date: string;
  mealType: string;
  content: string;
}

// 食事データのサンプル
const mealDataList: MealInput[] = [
  {
    userId: 'user1',
    date: '2025-08-27',
    mealType: 'breakfast',
    content: '食パン・コーヒー・バター'
  },
  {
    userId: 'user1',
    date: '2025-08-27',
    mealType: 'lunch',
    content: 'チキンサラダ・玄米・味噌汁'
  },
  {
    userId: 'user1',
    date: '2025-08-27',
    mealType: 'dinner',
    content: 'サーモン・ブロッコリー・さつまいも'
  },
  {
    userId: 'user2',
    date: '2025-09-17',
    mealType: 'breakfast',
    content: '食パン・コーヒー'
  },
  {
    userId: 'user2',
    date: '2025-09-17',
    mealType: 'lunch',
    content: 'サラダボウル・スープ・パン'
  },
  {
    userId: 'user2',
    date: '2025-09-17',
    mealType: 'dinner',
    content: 'グリルチキン・野菜炒め・ご飯'
  },
  {
    userId: 'user1',
    date: '2025-09-17',
    mealType: 'breakfast',
    content: 'オートミール・フルーツ・ヨーグルト'
  },
  {
    userId: 'user1',
    date: '2025-09-17',
    mealType: 'lunch',
    content: 'パスタ・サラダ・コーンスープ'
  }
];

export const seedMealData = async (): Promise<void> => {
  try {
    log.info('食事データの投入を開始します...');
    log.data(`投入するデータ数`, `${mealDataList.length}件`);

    for (let i = 0; i < mealDataList.length; i++) {
      const mealData = mealDataList[i];
      log.info(`食事データ ${i + 1}/${mealDataList.length} を投入中...`);
      log.data('投入データ', mealData);

      const result = await client.models.Meal.create(mealData);
      
      if (result.data) {
        log.success(`食事データ ${i + 1} の投入完了: ID=${result.data.id}`);
      } else if (result.errors) {
        log.error(`食事データ ${i + 1} の投入エラー: ${JSON.stringify(result.errors)}`);
      }
    }

    log.success('🎉 食事データの投入が完了しました！');
  } catch (error) {
    log.error(`食事データ投入エラー: ${error}`);
    throw error;
  }
};

// 直接実行時の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed-meal.ts')) {
  console.log('seed-meal.ts: スクリプト開始');
  log.info('食事データシード開始...');
  seedMealData()
    .then(() => {
      log.success('食事データシード完了');
      process.exit(0);
    })
    .catch((error) => {
      log.error(`食事データシード失敗: ${error}`);
      process.exit(1);
    });
}
