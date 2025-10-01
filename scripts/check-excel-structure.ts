const XLSX = require('xlsx');

const checkExcelStructure = () => {
  try {
    console.log('=== Excel構造確認 ===');
    
    const excelFilePath = './biory_work/20230428-mxt_kagsei-mext_00001_012_食品データ全量.xlsx';
    const workbook = XLSX.readFile(excelFilePath);
    
    console.log('利用可能なシート:', workbook.SheetNames);
    
    // 表全体_修正対応シートを使用
    const sheetName = '表全体_修正対応';
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      console.error('表全体_修正対応シートが見つかりません');
      return;
    }
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`シート名: ${sheetName}`);
    console.log(`総行数: ${jsonData.length}`);
    
    // 最初の5行を詳細確認
    console.log('\n=== 最初の5行の詳細 ===');
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      console.log(`\n行${i + 1}:`);
      console.log(`  A-D: [${row?.slice(0, 4).map(v => v || '').join(', ')}]`);
      console.log(`  E-M: [${row?.slice(4, 13).map(v => v || '').join(', ')}]`);
      console.log(`  全体長: ${row?.length || 0}`);
    }
    
    // 列のヘッダー情報を詳細確認
    console.log('\n=== 各行の役割分析 ===');
    const row1 = jsonData[0] as any[]; // 項目名
    const row2 = jsonData[1] as any[]; // 単位
    const row3 = jsonData[2] as any[]; // 英語略称
    
    console.log('1行目(項目名):');
    for (let i = 0; i < Math.min(20, row1?.length || 0); i++) {
      if (row1[i]) {
        console.log(`  ${String.fromCharCode(65 + i)}列: ${row1[i]}`);
      }
    }
    
    console.log('\n2行目(単位):');
    for (let i = 4; i < Math.min(20, row2?.length || 0); i++) {
      if (row2[i]) {
        console.log(`  ${String.fromCharCode(65 + i)}列: ${row2[i]}`);
      }
    }
    
    console.log('\n3行目(英語略称):');
    for (let i = 4; i < Math.min(20, row3?.length || 0); i++) {
      if (row3[i]) {
        console.log(`  ${String.fromCharCode(65 + i)}列: ${row3[i]}`);
      }
    }
    
    // 実際のデータ行を探す（4行目以降）
    console.log('\n=== 実データサンプル ===');
    for (let i = 3; i < Math.min(8, jsonData.length); i++) {
      const row = jsonData[i] as any[];
      if (row && row[0]) {
        console.log(`\n行${i + 1}:`);
        console.log(`  食品名: ${row[0]}`);
        console.log(`  A-D: [${row.slice(0, 4).join(', ')}]`);
        console.log(`  エネルギー(E): ${row[4]}`);
        console.log(`  たんぱく質(F): ${row[5]}`);
        console.log(`  脂質(G): ${row[6]}`);
        console.log(`  炭水化物(H): ${row[7]}`);
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
};

checkExcelStructure();