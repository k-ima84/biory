const ExcelJS = require('xlsx');
const fs = require('fs');

const exportToCSV = () => {
  try {
    console.log('=== Excel to CSV Export ===');
    
    const excelFilePath = './biory_work/20230428-mxt_kagsei-mext_00001_012_食品データ全量.xlsx';
    const workbook = ExcelJS.readFile(excelFilePath);
    
    console.log('利用可能なシート:', workbook.SheetNames);
    
    // 表全体_修正対応シートを使用
    const sheetName = '表全体_修正対応';
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error('表全体_修正対応シートが見つかりません');
    }
    
    const jsonData = ExcelJS.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`読み取り行数: ${jsonData.length}`);
    
    // CSVデータを準備
    const csvData: string[] = [];
    csvData.push('foodId,foodName,calories,protein,fat,carbs,category');
    
    let processedCount = 0;
    
    // ヘッダー3行をスキップして、4行目から実データ開始
    for (let i = 3; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      
      // 行が空でない場合、かつ食品名（D列）が存在する場合のみ処理
      if (row && row.length > 3 && row[3] && typeof row[3] === 'string') {
        const foodId = `${row[1]}_${row[2]}`; // 食品番号_索引番号
        const foodName = String(row[3]).trim().replace(/,/g, ''); // D列: 食品名（カンマを除去）
        const calories = parseFloat(row[6]) || 0; // G列: エネルギー(kcal)
        const protein = parseFloat(row[9]) || 0; // J列: たんぱく質
        const fat = parseFloat(row[12]) || 0; // M列: 脂質
        const carbs = parseFloat(row[18]) || 0; // S列: 炭水化物
        const category = String(row[0] || '').trim().replace(/,/g, ''); // A列: 食品群（カンマを除去）
        
        // 有効なデータのみ追加
        if (foodName && foodName !== 'undefined') {
          csvData.push(`${foodId},${foodName},${calories},${protein},${fat},${carbs},${category}`);
          processedCount++;
        }
      }
    }
    
    // CSVファイルに書き出し
    const csvContent = csvData.join('\n');
    const outputPath = './nutrition-data.csv';
    
    console.log(`\nCSV書き込み開始:`);
    console.log(`- データ行数: ${csvData.length}行`);
    console.log(`- ファイルサイズ: ${Math.round(csvContent.length / 1024)}KB`);
    console.log(`- 出力パス: ${outputPath}`);
    
    try {
      // BOM付きUTF-8で保存して文字化けを防ぐ
      const bomUtf8 = '\uFEFF' + csvContent;
      fs.writeFileSync(outputPath, bomUtf8, 'utf8');
      console.log('✓ CSV書き込み成功（BOM付きUTF-8）');
    } catch (writeError) {
      console.error('✗ CSV書き込みエラー:', writeError);
      throw writeError;
    }
    
    console.log(`\n処理完了:`);
    console.log(`- 処理件数: ${processedCount}件`);
    console.log(`- 出力ファイル: ${outputPath}`);
    console.log(`\nサンプルデータ (最初の5行):`);
    csvData.slice(1, 6).forEach((line, index) => {
      const parts = line.split(',');
      console.log(`${index + 1}. ${parts[1]}: ${parts[2]}kcal, P:${parts[3]}g, F:${parts[4]}g, C:${parts[5]}g`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
};

exportToCSV();