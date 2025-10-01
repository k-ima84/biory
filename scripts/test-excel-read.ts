import * as XLSX from 'xlsx';
import path from 'path';

// Excelファイルを読み取る関数（テスト用の簡易版）
const readExcelFile = (filePath: string) => {
  try {
    console.log(`Excelファイルを読み取り中: ${filePath}`);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSONに変換
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`読み取り行数: ${jsonData.length}`);
    console.log('最初の5行:', jsonData.slice(0, 5));
    
    // データを変換
    const nutritionData = [];
    
    for (let i = 1; i < Math.min(jsonData.length, 20); i++) { // 最初の20行のみテスト
      const row = jsonData[i] as any[];
      
      if (row && row.length > 0 && row[0]) {
        const item = {
          foodName: String(row[0] || '').trim(),
          calories: parseFloat(row[1]) || 0,
          protein: parseFloat(row[2]) || 0,
          fat: parseFloat(row[3]) || 0,
          carbs: parseFloat(row[4]) || 0,
          category: String(row[5] || '').trim(),
          unit: String(row[6] || '100g').trim()
        };
        
        if (item.foodName && item.foodName !== '') {
          nutritionData.push(item);
        }
      }
    }
    
    return nutritionData;
    
  } catch (error) {
    console.error('Excelファイル読み取りエラー:', error);
    return [];
  }
};

const testExcelRead = () => {
  console.log('=== Excelファイル読み取りテスト ===');
  console.log('現在のディレクトリ:', process.cwd());
  console.log('__dirname:', __dirname);
  
  // biory_workフォルダの確認
  const fs = require('fs');
  try {
    const workFiles = fs.readdirSync('./biory_work/');
    console.log('biory_workフォルダの内容:', workFiles);
  } catch (error) {
    console.log('biory_workフォルダの読み取りエラー:', error);
  }
  
  // 複数のファイルパスを試す
  const possiblePaths = [
    './biory_work/20230428-mxt_kagsei-mext_00001_012_食品データ全量.xlsx',
    './biory_work/20230428-mxt_kagsei-mext_00001_012 (1).xlsx',
    path.join(__dirname, '../biory_work/20230428-mxt_kagsei-mext_00001_012_食品データ全量.xlsx'),
    path.join(__dirname, '../biory_work/20230428-mxt_kagsei-mext_00001_012 (1).xlsx')
  ];
  
  for (const filePath of possiblePaths) {
    console.log(`\n試行中: ${filePath}`);
    
    try {
      const data = readExcelFile(filePath);
      
      if (data.length > 0) {
        console.log(`✅ 成功: ${filePath}`);
        console.log(`読み取りデータ数: ${data.length}`);
        console.log('最初の5件:');
        console.table(data.slice(0, 5));
        
        // カテゴリ別集計
        const categories = data.reduce((acc, item) => {
          acc[item.category || 'その他'] = (acc[item.category || 'その他'] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log('カテゴリ別件数:');
        console.table(categories);
        
        return; // 成功したら終了
      }
    } catch (error) {
      console.log(`❌ 失敗: ${filePath} - ${error}`);
    }
  }
  
  console.log('❌ すべてのファイルパスで読み取りに失敗しました。');
};

// ファイルが直接実行された場合のみテストを実行
if (require.main === module) {
  testExcelRead();
}