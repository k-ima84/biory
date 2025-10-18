import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../data/resource';
import * as fs from 'fs';
import * as path from 'path';

// JSONファイルを読み込み
const outputsPath = path.join(process.cwd(), 'amplify_outputs.json');
const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));

// Amplify設定を初期化
Amplify.configure(outputs);

const client = generateClient<Schema>();

export const clearData = async () => {
  try {
    console.log('データ削除を開始します...');

    // 既存のNutritionデータを全て取得
    const { data: nutritions } = await client.models.Nutrition.list();
    
    console.log(`削除対象のNutritionデータ: ${nutritions?.length || 0}件`);

    // 各データを削除
    if (nutritions && nutritions.length > 0) {
      for (let i = 0; i < nutritions.length; i++) {
        const nutrition = nutritions[i];
        console.log(`データ ${i + 1}/${nutritions.length} を削除中... ID: ${nutrition.id}`);
        
        await client.models.Nutrition.delete({ id: nutrition.id });
        console.log(`✅ データ ${i + 1} の削除完了`);
      }
    }

    // 既存のDailyRecordデータを削除
    const { data: meals } = await client.models.DailyRecord.list();
    console.log(`削除対象のDailyRecordデータ: ${meals?.length || 0}件`);

    if (meals && meals.length > 0) {
      for (let i = 0; i < meals.length; i++) {
        const meal = meals[i];
        console.log(`DailyRecordデータ ${i + 1}/${meals.length} を削除中... ID: ${meal.id}`);
        
        await client.models.DailyRecord.delete({ id: meal.id });
        console.log(`✅ DailyRecordデータ ${i + 1} の削除完了`);
      }
    }

    // 既存のUserProfileデータを削除
    const { data: profiles } = await client.models.UserProfile.list();
    console.log(`削除対象のUserProfileデータ: ${profiles?.length || 0}件`);

    if (profiles && profiles.length > 0) {
      for (let i = 0; i < profiles.length; i++) {
        const profile = profiles[i];
        console.log(`UserProfileデータ ${i + 1}/${profiles.length} を削除中... ID: ${profile.id}`);
        
        await client.models.UserProfile.delete({ id: profile.id });
        console.log(`✅ UserProfileデータ ${i + 1} の削除完了`);
      }
    }

    console.log('🎉 全データの削除が完了しました！');
  } catch (error) {
    console.error('データ削除エラー:', error);
    throw error;
  }
};

// スクリプトとして実行された場合の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('clear-data.ts')) {
  console.log('データクリア処理を開始...');
  clearData()
    .then(() => {
      console.log('✅ データクリア処理が正常に完了しました！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ データクリア処理が失敗しました:', error);
      process.exit(1);
    });
}
