// 栄養データのAPI呼び出し関数
interface NutritionResponse {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export async function fetchNutritionFromCustomAPI(foodText: string): Promise<NutritionResponse> {
  // Oracle APEX APIのエンドポイント
  const API_BASE_URL = "https://oracleapex.com/ords/meal_biory/biory/mealname/";
  
  try {
    // Oracle APEXのパラメータ渡し方を複数パターン試行
    // パターン1: URLパスに直接埋め込み
    let url = `${API_BASE_URL}${encodeURIComponent(foodText)}`;
    
    // パターン2: 標準的なクエリパラメータ（フォールバック用）
    const fallbackUrl = `${API_BASE_URL}?MEAL=${encodeURIComponent(foodText)}`;
    
    console.log(`栄養API呼び出し: ${url}`);
    
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Oracle APEXで認証が必要な場合のみコメントアウト解除
        // 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_APEX_TOKEN}`,
      }
    });
    
    // 最初のパターンで失敗した場合、フォールバックを試行
    if (!response.ok) {
      console.log(`パターン1失敗、パターン2を試行: ${fallbackUrl}`);
      response = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Oracle APEXのレスポンス構造に対応
    // 通常、APEXは { "items": [...] } 形式でレスポンスを返します
    const items = result.items || [];
    
    if (!items || items.length === 0) {
      console.warn(`栄養データが見つかりませんでした: ${foodText}`);
      return estimateNutritionFallback(foodText);
    }

    console.log(`API レスポンス件数: ${items.length}件`, items);

    // クライアントサイドで厳密にフィルタリング
    let matchedItems = items.filter((item: any) => {
      const mealName = item.MEAL || item.meal || '';
      return mealName === foodText || mealName.includes(foodText);
    });

    // 完全一致がない場合は部分一致を試す
    if (matchedItems.length === 0) {
      matchedItems = items.filter((item: any) => {
        const mealName = item.MEAL || item.meal || '';
        return mealName.includes(foodText) || foodText.includes(mealName);
      });
    }

    // それでも見つからない場合はフォールバック
    if (matchedItems.length === 0) {
      console.warn(`フィルタリング後もデータが見つかりませんでした: ${foodText}`);
      return estimateNutritionFallback(foodText);
    }

    // 最初のマッチした結果を使用
    const data = matchedItems[0];
    console.log(`選択されたデータ:`, data);

    // DBのカラム名に合わせて調整
    return {
      calories: Math.round(data.ENERC_KCAL || data.enerc_kcal || 0), // カロリー
      protein: Math.round((data.PROT_ || data.prot_ || 0) * 10) / 10, // タンパク質
      fat: Math.round((data.FAT_ || data.fat_ || 0) * 10) / 10,       // 脂質
      carbs: Math.round((data.CHOCDF_ || data.chocdf_ || 0) * 10) / 10 // 炭水化物
    };

  } catch (error) {
    console.error('栄養API呼び出しエラー:', error);
    
    // APIエラー時のフォールバック値（推定値）
    return estimateNutritionFallback(foodText);
  }
}

// フォールバック用の簡易推定関数
function estimateNutritionFallback(foodText: string): NutritionResponse {
  // DBにある食材の推定値（添付画像のデータを参考）
  const estimations: { [key: string]: NutritionResponse } = {
    '玄米': { calories: 343, protein: 12.7, fat: 6.0, carbs: 64.9 },
    '精白米': { calories: 346, protein: 11.2, fat: 4.4, carbs: 69.7 },
    'あわもち': { calories: 210, protein: 5.1, fat: 1.3, carbs: 45.3 },
    'オートミール': { calories: 350, protein: 13.7, fat: 5.7, carbs: 69.1 },
    '七分つき押し麦': { calories: 343, protein: 10.9, fat: 2.1, carbs: 72.1 },
    '押し麦': { calories: 329, protein: 6.7, fat: 1.5, carbs: 78.3 },
    '押し麦 めし': { calories: 118, protein: 2.2, fat: 0.5, carbs: 28.5 },
    '米粒麦': { calories: 333, protein: 7.0, fat: 2.1, carbs: 76.2 },
    '大麦めん': { calories: 343, protein: 12.9, fat: 1.7, carbs: 68.0 },
    '大麦めん ゆで': { calories: 121, protein: 4.8, fat: 0.6, carbs: 24.3 },
    // 一般的な食材の推定値も追加
    'ご飯': { calories: 168, protein: 2.5, fat: 0.3, carbs: 37.1 },
    'パン': { calories: 264, protein: 9.3, fat: 4.4, carbs: 46.7 },
    '鶏肉': { calories: 200, protein: 19.5, fat: 11.6, carbs: 0.0 },
    '牛肉': { calories: 259, protein: 17.4, fat: 20.0, carbs: 0.4 },
    '豚肉': { calories: 263, protein: 17.1, fat: 20.6, carbs: 0.2 },
    '魚': { calories: 132, protein: 20.7, fat: 4.8, carbs: 0.1 },
    '卵': { calories: 151, protein: 12.3, fat: 10.3, carbs: 0.3 },
    '野菜': { calories: 20, protein: 1.0, fat: 0.1, carbs: 4.0 },
    'サラダ': { calories: 20, protein: 1.0, fat: 0.1, carbs: 4.0 }
  };

  // 完全一致する場合
  if (estimations[foodText]) {
    return estimations[foodText];
  }

  // 部分一致する場合
  for (const [key, value] of Object.entries(estimations)) {
    if (foodText.includes(key) || key.includes(foodText)) {
      return value;
    }
  }

  // デフォルト値（一般的な食品の平均値）
  return { calories: 200, protein: 8.0, fat: 5.0, carbs: 35.0 };
}

// 複数の食材を一括で処理する関数
export async function calculateNutritionFromMeals(mealContents: string[]): Promise<NutritionResponse> {
  try {
    const nutritionPromises = mealContents.map(async (mealContent) => {
      if (mealContent && mealContent !== "—" && mealContent.trim() !== "") {
        // 複数の食材が含まれている場合は分割して処理
        const foods = mealContent.split(/[、,，]+/).map(food => food.trim());
        
        const foodNutritions = await Promise.all(
          foods.map(food => fetchNutritionFromCustomAPI(food))
        );
        
        // 各食材の栄養価を合計
        return foodNutritions.reduce((acc, nutrition) => ({
          calories: acc.calories + nutrition.calories,
          protein: acc.protein + nutrition.protein,
          fat: acc.fat + nutrition.fat,
          carbs: acc.carbs + nutrition.carbs
        }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
      }
      return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    });

    // 並列処理で全ての食事の栄養価を取得
    const nutritionResults = await Promise.all(nutritionPromises);
    
    // 合計を計算
    const total = nutritionResults.reduce((acc, nutrition) => ({
      calories: acc.calories + nutrition.calories,
      protein: acc.protein + nutrition.protein,
      fat: acc.fat + nutrition.fat,
      carbs: acc.carbs + nutrition.carbs
    }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

    return {
      calories: Math.round(total.calories),
      protein: Math.round(total.protein * 10) / 10,
      fat: Math.round(total.fat * 10) / 10,
      carbs: Math.round(total.carbs * 10) / 10
    };

  } catch (error) {
    console.error('食事栄養計算エラー:', error);
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  }
}

// APIのヘルスチェック関数
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch("https://oracleapex.com/ords/meal_biory/biory/mealname/?MEAL=test", {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// デバッグ用: API呼び出し結果を詳細に確認する関数
export async function debugAPICall(foodText: string): Promise<any> {
  const API_BASE_URL = "https://oracleapex.com/ords/meal_biory/biory/mealname/";
  
  console.log('=== API Debug Info ===');
  console.log('食材名:', foodText);
  
  // パターン1: URLパスに埋め込み
  const url1 = `${API_BASE_URL}${encodeURIComponent(foodText)}`;
  console.log('URL パターン1:', url1);
  
  // パターン2: クエリパラメータ
  const url2 = `${API_BASE_URL}?MEAL=${encodeURIComponent(foodText)}`;
  console.log('URL パターン2:', url2);
  
  try {
    const response = await fetch(url2, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Response Status:', response.status);
    console.log('Response OK:', response.ok);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Response Data:', result);
      console.log('Items Count:', result.items ? result.items.length : 'No items');
      
      if (result.items) {
        result.items.forEach((item: any, index: number) => {
          console.log(`Item ${index + 1}:`, {
            MEAL: item.MEAL || item.meal,
            CALORIES: item.ENERC_KCAL || item.enerc_kcal,
            PROTEIN: item.PROT_ || item.prot_
          });
        });
      }
      
      return result;
    }
  } catch (error) {
    console.error('API Debug Error:', error);
  }
  
  console.log('=== End Debug Info ===');
  return null;
}