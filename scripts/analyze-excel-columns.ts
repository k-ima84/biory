import * as XLSX from 'xlsx';

const analyzeExcelColumns = () => {
  try {
    console.log('=== Excel列構造解析 ===');
    
    const excelFilePath = './biory_work/20230428-mxt_kagsei-mext_00001_012_食品データ全量.xlsx';
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // データ行（13行目）を詳細確認
    console.log('実データ行の詳細確認:');
    const dataRow = jsonData[12] as any[]; // 13行目（インデックス12）
    
    console.log(`データ行の列数: ${dataRow?.length || 0}`);
    
    if (dataRow) {
      for (let col = 0; col < Math.min(15, dataRow.length); col++) {
        console.log(`列${col}: "${dataRow[col]}" (型: ${typeof dataRow[col]})`);
      }
    }
    
    // ヘッダー行も確認
    console.log('\nヘッダー行の確認:');
    const headerRow1 = jsonData[1] as any[]; // 2行目
    const headerRow2 = jsonData[2] as any[]; // 3行目
    
    for (let col = 0; col < Math.min(15, Math.max(headerRow1?.length || 0, headerRow2?.length || 0)); col++) {
      console.log(`列${col}: "${headerRow1?.[col] || ''}" / "${headerRow2?.[col] || ''}"`);
    }
    
    // 次の数行も確認
    console.log('\n次のデータ行:');
    for (let row = 13; row < Math.min(18, jsonData.length); row++) {
      const dataRow = jsonData[row] as any[];
      console.log(`行${row + 1}: 食品名="${dataRow?.[3]}" エネルギー="${dataRow?.[5]}"`);
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
};

analyzeExcelColumns();