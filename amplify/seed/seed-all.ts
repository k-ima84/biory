import { log } from './common';
import { seedNutritionData } from './seed-nutrition';
import { seedMealData } from './seed-meal';

// 全てのシードデータを投入する関数
export const seedAllData = async (): Promise<void> => {
  try {
    log.info('🌱 全シードデータの投入を開始します...');
    
    // 栄養データを投入
    await seedNutritionData();
    
    // 食事データを投入
    await seedMealData();
    
    log.success('🎉 全シードデータの投入が完了しました！');
  } catch (error) {
    log.error(`シードデータ投入エラー: ${error}`);
    throw error;
  }
};

// 直接実行時の処理（デバッグ用にコンソールログ追加）
console.log('seed-all.ts: スクリプト開始');
console.log('require:', typeof require);
console.log('require.main:', typeof require !== 'undefined' ? require.main : 'undefined');
console.log('module:', typeof module !== 'undefined' ? module : 'undefined');

// 常に実行するように変更
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
