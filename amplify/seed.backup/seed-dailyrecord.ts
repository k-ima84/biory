import { client, log } from './common';

// 日次記録データの型定義
interface DailyRecordInput {
  userId: string;
  date: string;
  mealType: string;
  content: string;
  condition?: string;
  mood?: string;
  weight?: number;
}

// 日次記録データのサンプル
const dailyRecordDataList: DailyRecordInput[] = [
  {
    userId: 'user1',
    date: '2025-08-27',
    mealType: 'breakfast',
    content: '食パン・コーヒー・バター',
    condition: '良好',
    mood: '元気',
    weight: 70.5
  },
  {
    userId: 'user1',
    date: '2025-08-27',
    mealType: 'lunch',
    content: 'チキンサラダ・玄米・味噌汁',
    condition: '良好',
    mood: '普通',
    weight: 70.3
  },
  {
    userId: 'user1',
    date: '2025-08-27',
    mealType: 'dinner',
    content: 'サーモン・ブロッコリー・さつまいも',
    condition: '普通',
    mood: '良い',
    weight: 70.0
  },
  {
    userId: 'user2',
    date: '2025-09-17',
    mealType: 'breakfast',
    content: 'トースト・バナナ・コーヒー',
    condition: '普通',
    mood: '普通',
    weight: 68.2
  },
  {
    userId: 'user2',
    date: '2025-09-17',
    mealType: 'lunch',
    content: 'サラダボウル・スープ・パン',
    condition: '良好',
    mood: '普通',
    weight: 68.0
  },
  {
    userId: 'user2',
    date: '2025-09-17',
    mealType: 'dinner',
    content: 'グリルチキン・野菜炒め・ご飯',
    condition: '普通',
    mood: '良い',
    weight: 68.0
  },
  {
    userId: 'user1',
    date: '2025-09-17',
    mealType: 'breakfast',
    content: 'オートミール・フルーツ・ヨーグルト',
    condition: '良好',
    mood: '元気',
    weight: 70.0
  },
  {
    userId: 'user1',
    date: '2025-09-17',
    mealType: 'lunch',
    content: 'パスタ・サラダ・コーンスープ',
    condition: '普通',
    mood: '普通',
    weight: 70.0
  }
];

export const seedDailyRecordData = async (): Promise<void> => {
  try {
    log.info('日次記録データの投入を開始します...');
    log.data(`投入するデータ数`, `${dailyRecordDataList.length}件`);

    for (let i = 0; i < dailyRecordDataList.length; i++) {
      const dailyRecordData = dailyRecordDataList[i];
      log.info(`日次記録データ ${i + 1}/${dailyRecordDataList.length} を投入中...`);
      log.data('投入データ', dailyRecordData);

      const result = await client.models.DailyRecord.create(dailyRecordData);
      
      if (result.data) {
        log.success(`日次記録データ ${i + 1} の投入完了: ID=${result.data.id}`);
      } else if (result.errors) {
        log.error(`日次記録データ ${i + 1} の投入エラー: ${JSON.stringify(result.errors)}`);
      }
    }

    log.success('🎉 日次記録データの投入が完了しました！');
  } catch (error) {
    log.error(`日次記録データ投入エラー: ${error}`);
    throw error;
  }
};

// 直接実行時の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed-dailyrecord.ts')) {
  console.log('seed-dailyrecord.ts: スクリプト開始');
  log.info('日次記録データシード開始...');
  seedDailyRecordData()
    .then(() => {
      log.success('日次記録データシード完了');
      process.exit(0);
    })
    .catch((error) => {
      log.error(`日次記録データシード失敗: ${error}`);
      process.exit(1);
    });
}