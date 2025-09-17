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

export const seedData = async () => {
  try {
    // 複数の栄養データを作成
    const nutritionDataList = [
      {
        calories: 1200,
        carbs: 150.0,
        date: '2025-08-27',
        fat: 30.0,
        protein: 50.0,
        userId: 'user1'
      },
      {
        calories: 1300,
        carbs: 160.0,
        date: '2025-09-03',
        fat: 70.0,
        protein: 80.0,
        userId: 'user2'
      }
    ];

    console.log(`投入するデータ数: ${nutritionDataList.length}件`);

    // 各データを順次投入
    for (let i = 0; i < nutritionDataList.length; i++) {
      const nutritionData = nutritionDataList[i];
      console.log(`データ ${i + 1}/${nutritionDataList.length} を投入中...`);
      console.log('投入データ:', nutritionData);

      const result = await client.models.Nutrition.create(nutritionData);

      console.log(`✅ データ ${i + 1} の投入完了:`, result.data);
    }

    console.log('🎉 全データの投入が完了しました！');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
};

export default seedData;

// スクリプトとして実行された場合の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed.ts')) {
  console.log('Starting seed data insertion...');
  seedData()
    .then(() => {
      console.log('✅ Seed data insertion completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed data insertion failed:', error);
      process.exit(1);
    });
}
