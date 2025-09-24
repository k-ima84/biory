import { log } from './common';
import { seedNutritionData } from './seed-nutrition';
import { seedUserProfileData } from './seed-userprofile';
import { seedDailyRecordData } from './seed-dailyrecord';

// 全てのシードデータを投入する関数
export const seedAllData = async (): Promise<void> => {
  try {
    log.info('🌱 全シードデータの投入を開始します...');
    
    // ユーザープロファイルデータを投入（最初に実行）
    await seedUserProfileData();
    
    // 栄養データを投入
    await seedNutritionData();
    
    // 日次記録データを投入
    await seedDailyRecordData();
    
    log.success('🎉 全シードデータの投入が完了しました！');
  } catch (error) {
    log.error(`シードデータ投入エラー: ${error}`);
    throw error;
  }
};

// 直接実行時の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed-all.ts')) {
  console.log('seed-all.ts: スクリプト開始');
  log.info('全シードデータ投入開始...');
  seedAllData()
    .then(() => {
      log.success('全シードデータ投入完了');
      process.exit(0);
    })
    .catch((error) => {
      log.error(`全シードデータ投入失敗: ${error}`);
      process.exit(1);
    });
}
