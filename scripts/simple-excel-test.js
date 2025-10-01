// 簡易版のExcelテストスクリプト
console.log('=== 簡易Excelテスト開始 ===');

// 1. 現在のディレクトリ確認
console.log('現在のディレクトリ:', process.cwd());

// 2. 必要なモジュールの確認
try {
  const XLSX = require('xlsx');
  console.log('✅ xlsxモジュールが正常に読み込まれました');
  console.log('XLSXバージョン:', XLSX.version);
} catch (error) {
  console.error('❌ xlsxモジュールの読み込みエラー:', error);
  process.exit(1);
}

// 3. biory_workフォルダの確認
const fs = require('fs');
const path = require('path');

try {
  const bioryWorkPath = './biory_work/';
  const files = fs.readdirSync(bioryWorkPath);
  console.log('✅ biory_workフォルダが見つかりました');
  console.log('ファイル一覧:');
  files.forEach(file => {
    const fullPath = path.join(bioryWorkPath, file);
    const stats = fs.statSync(fullPath);
    console.log(`  - ${file} (${stats.size} bytes)`);
  });
  
  // 4. Excelファイルの存在確認
  const excelFiles = files.filter(file => file.endsWith('.xlsx'));
  console.log(`\n✅ Excelファイル数: ${excelFiles.length}`);
  
  if (excelFiles.length > 0) {
    // 5. 最初のExcelファイルを読み取りテスト
    const firstExcelFile = path.join(bioryWorkPath, excelFiles[0]);
    console.log(`\n最初のExcelファイルをテスト: ${firstExcelFile}`);
    
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(firstExcelFile);
    console.log('✅ Excelファイルの読み取り成功');
    console.log('シート名:', workbook.SheetNames);
    
    // 最初のシートの内容を少し確認
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    console.log(`データ行数: ${jsonData.length}`);
    console.log('最初の3行:');
    jsonData.slice(0, 3).forEach((row, index) => {
      console.log(`  行${index + 1}:`, row);
    });
    
  } else {
    console.log('❌ Excelファイルが見つかりません');
  }
  
} catch (error) {
  console.error('❌ ファイル確認エラー:', error);
}

console.log('\n=== 簡易テスト完了 ===');