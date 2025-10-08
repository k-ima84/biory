
import * as XLSX from 'xlsx';
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource";

// Amplify設定
console.log('Amplify設定開始...');
Amplify.configure(outputs);
console.log('Amplify設定完了');

// クライアント生成を関数内で行う
const getClient = () => {
  try {
    const client = generateClient<Schema>();
    console.log('GraphQLクライアント生成成功');
    return client;
  } catch (error) {
    console.error('GraphQLクライアント生成エラー:', error);
    throw error;
  }
};

interface NutritionItem {
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  category?: string;
  unit?: string;
}

// Excelファイルを読み取る関数（表全体_修正対応シート対応）
const readExcelFile = (filePath: string): NutritionItem[] => {
  try {
    console.log(`Excelファイルを読み取り中: ${filePath}`);
    
    const workbook = XLSX.readFile(filePath);
    console.log('利用可能なシート:', workbook.SheetNames);
    
    // 表全体_修正対応シートを使用
    const sheetName = '表全体_修正対応';
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('表全体_修正対応シートが見つかりません');
    }
    
    // JSONに変換（ヘッダー行を含む）
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`読み取り行数: ${jsonData.length}`);
    console.log('ヘッダー構造確認:');
    console.log('1行目:', (jsonData[0] as any[])?.slice(0, 10));
    console.log('2行目:', (jsonData[1] as any[])?.slice(0, 10));
    console.log('3行目:', (jsonData[2] as any[])?.slice(0, 10));
    
    // データを変換（ヘッダー3行をスキップして4行目から開始）
    const nutritionData: NutritionItem[] = [];
    
    for (let i = 3; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      
      // 行が空でない場合、かつ食品名（D列）が存在する場合のみ処理
      if (row && row.length > 3 && row[3] && typeof row[3] === 'string') {
        const item: NutritionItem = {
          foodName: String(row[3]).trim(),        // D列: 食品名
          calories: parseFloat(row[6]) || 0,      // G列: エネルギー(kcal)
          protein: parseFloat(row[9]) || 0,       // J列: たんぱく質(g)
          fat: parseFloat(row[12]) || 0,          // M列: 脂質(g)
          carbs: parseFloat(row[18]) || 0,        // S列: 炭水化物(g)
          category: String(row[0] || '').trim(),  // A列: 食品群
          unit: '100g'                            // 固定値
        };
        
        // 食品名が存在し、有効なデータの場合のみ追加
        if (item.foodName && item.foodName !== '' && item.foodName !== 'undefined') {
          nutritionData.push(item);
        }
      }
    }
    
    console.log(`変換完了: ${nutritionData.length}件の食品データ`);
    
    // サンプルデータ表示
    if (nutritionData.length > 0) {
      console.log('サンプルデータ:');
      nutritionData.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.foodName}: ${item.calories}kcal, P:${item.protein}g, F:${item.fat}g, C:${item.carbs}g`);
      });
    }
    
    return nutritionData;
    
  } catch (error) {
    console.error('Excelファイル読み取りエラー:', error);
    return [];
  }
};

// 既存データの件数をチェックする関数
const checkExistingData = async (): Promise<number> => {
  try {
    const client = getClient();
    const { data: existingFoods } = await client.models.FoodNutrition.list();
    return existingFoods.length;
  } catch (error) {
    console.error('既存データ確認エラー:', error);
    return 0;
  }
};

// DynamoDBにデータを保存する関数
const saveToDatabase = async (nutritionData: NutritionItem[]) => {
  console.log(`DynamoDBに${nutritionData.length}件のデータを保存開始`);
  
  // クライアントを取得
  const client = getClient();
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const item of nutritionData) {
    try {
      await client.models.FoodNutrition.create({
        foodName: item.foodName,
        energyKcal: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        per100g: true,
      });
      
      successCount++;
      
      // 100件ごとに進捗表示
      if (successCount % 100 === 0) {
        console.log(`進捗: ${successCount}/${nutritionData.length}件完了`);
      }
      
    } catch (error) {
      console.error(`保存エラー - ${item.foodName}:`, error);
      errorCount++;
    }
    
    // APIレート制限を避けるため少し待機
    if (successCount % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`保存完了: 成功${successCount}件、エラー${errorCount}件`);
};

// メイン実行関数
const main = async (forceImport: boolean = false) => {
  try {
    console.log('=== 栄養素データインポート開始 ===');
    
    // 既存データをチェック
    console.log('既存データを確認中...');
    const existingCount = await checkExistingData();
    console.log(`既存データ件数: ${existingCount}件`);
    
    if (existingCount > 0 && !forceImport) {
      console.log('⚠️  データベースに既存データが見つかりました。');
      console.log('重複を避けるため、インポートをスキップします。');
      console.log('既存データを削除してから再実行するか、強制実行オプション --force を使用してください。');
      console.log('\n使用方法:');
      console.log('  - 通常実行: npm run import-nutrition');
      console.log('  - 強制実行: node scripts/import-nutrition-data.ts --force');
      return;
    }
    
    if (forceImport && existingCount > 0) {
      console.log('🚨 強制実行モード: 既存データがありますが、追加でインポートします。');
    }
    
    // Excelファイルのパス（実際のファイル名に合わせて調整）
    const excelFilePath = './biory_work/20230428-mxt_kagsei-mext_00001_012_食品データ全量.xlsx';
    
    // Excelファイルを読み取り
    const nutritionData = readExcelFile(excelFilePath);
    
    if (nutritionData.length === 0) {
      console.log('データが見つかりませんでした。Excelファイルの内容を確認してください。');
      return;
    }
    
    // サンプルデータを表示
    console.log('=== サンプルデータ ===');
    console.log(nutritionData.slice(0, 3));
    
    // ユーザー確認
    console.log(`\n${nutritionData.length}件のデータをDynamoDBに保存します。`);
    
    // データベースに保存
    await saveToDatabase(nutritionData);
    
    console.log('=== インポート完了 ===');
    
  } catch (error) {
    console.error('インポート処理でエラーが発生:', error);
  }
};

// スクリプトとして実行された場合のみmain関数を呼び出し
if (require.main === module) {
  const forceImport = process.argv.includes('--force');
  main(forceImport);
}

export { readExcelFile, saveToDatabase };