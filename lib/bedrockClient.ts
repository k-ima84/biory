/**
 * Bedrock APIクライアント
 * フロントエンドから直接Amazon Bedrockを呼び出すためのユーティリティ
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { fetchAuthSession } from "aws-amplify/auth";

/**
 * Bedrockクライアントを取得
 */
async function getBedrockClient(): Promise<BedrockRuntimeClient> {
  try {
    console.log('🔧 Fetching auth session...');
    // Amplifyの認証セッションから認証情報を取得
    const session = await fetchAuthSession();
    
    console.log('🔐 Auth session retrieved:', {
      hasCredentials: !!session.credentials,
      hasIdentityId: !!(session.identityId),
      identityId: session.identityId,
      tokens: !!session.tokens,
    });
    
    if (session.credentials) {
      console.log('🔐 Credentials details:', {
        accessKeyId: session.credentials.accessKeyId?.substring(0, 10) + '...',
        hasSecretAccessKey: !!session.credentials.secretAccessKey,
        hasSessionToken: !!session.credentials.sessionToken,
      });
    }
    
    if (!session.credentials) {
      console.error('❌ No credentials in session');
      throw new Error('認証情報が取得できません。ログインしてください。');
    }
    
    console.log('🔧 Creating Bedrock client with credentials...');
    // Nova Microは東京リージョンでInference Profile未提供のため、us-east-1を使用
    const client = new BedrockRuntimeClient({
      region: "us-east-1", // Nova Micro Inference Profile用
      credentials: session.credentials,
    });
    console.log('✅ Bedrock client created successfully (region: us-east-1)');
    
    return client;
  } catch (error) {
    console.error('❌ Failed to get Bedrock client:', error);
    console.error('❌ Error details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}

/**
 * ユーザープロファイルの型定義
 */
interface UserProfile {
  allergies?: string;
  gender?: string;
  weight?: number;
  height?: number;
  age?: number;
  exerciseFrequency?: string;
}

/**
 * 献立データの型定義
 */
export interface MealData {
  mealType: string;
  calories: number;
  dishes: string[];
  color: string;
  isFallback?: boolean;
}

/**
 * 献立提案のプロンプトを作成
 */
function createMealPrompt(
  userPreferences: UserProfile,
  targetCalories: number
): string {
  // アレルギー制約を設定
  const allergies = userPreferences.allergies || '';
  let allergyConstraints = "";
  if (allergies && allergies.trim() && allergies !== "なし") {
    allergyConstraints = `\n【重要】アレルギー食材は使用禁止: ${allergies}`;
  }

  // カロリー範囲を設定
  const targetMin = Math.max(1200, targetCalories - 150);
  const targetMax = targetCalories + 150;

  const prompt = `あなたは管理栄養士です。以下の条件で1日の献立を作成してください。

目標カロリー: ${targetMin}から${targetMax}kcal${allergyConstraints}

JSON形式で回答してください。例:
{"meals":[{"mealType":"朝食","calories":500,"dishes":["ご飯","焼き魚","味噌汁"]},{"mealType":"昼食","calories":700,"dishes":["ご飯","鶏の唐揚げ","サラダ","味噌汁"]},{"mealType":"夕食","calories":800,"dishes":["ご飯","豚の生姜焼き","野菜炒め","味噌汁"]}]}

制約:
- 具体的な日本料理名を使用
- 朝食、昼食、夕食の3食を含める
- 各食事に3-4品を含める

JSONのみで回答してください。`;

  return prompt;
}

/**
 * Bedrock APIレスポンスをパース
 */
function parseMealSuggestion(text: string, targetCalories: number): MealData[] {
  console.log('🔍 PARSING BEDROCK RESPONSE');
  console.log('🔍 Response text:', text);
  console.log('🔍 Response length:', text?.length || 0);

  try {
    // 空チェック
    if (!text || text.trim().length === 0) {
      console.log('❌ Empty text provided to parser');
      return createDefaultMeals(targetCalories);
    }

    // テキストのクリーニング（不要な文字を削除）
    let cleanedText = text.trim();
    
    // 先頭の不要な文字を削除（【、改行、空白など）
    cleanedText = cleanedText.replace(/^[^{[]+/, '');
    // 末尾の不要な文字を削除
    cleanedText = cleanedText.replace(/[^}\]]+$/, '');
    
    console.log('🔍 Cleaned text length:', cleanedText.length);
    console.log('🔍 Cleaned text (first 200 chars):', cleanedText.substring(0, 200));

    // JSONブロックの抽出
    const jsonCandidates: string[] = [];

    // 方法0: クリーニング済みテキストをそのまま試行
    if (cleanedText.startsWith('{') || cleanedText.startsWith('[')) {
      console.log('🔍 Method 0 - Using cleaned text directly');
      jsonCandidates.push(cleanedText);
    }

    // 方法1: 通常のJSONブロック抽出
    if (cleanedText.includes('{') && cleanedText.includes('}')) {
      const startIdx = cleanedText.indexOf('{');
      const endIdx = cleanedText.lastIndexOf('}') + 1;
      if (startIdx !== -1 && endIdx > startIdx) {
        const candidate = cleanedText.substring(startIdx, endIdx);
        console.log('🔍 Method 1 - Found JSON candidate:', candidate.substring(0, 100) + '...');
        if (!jsonCandidates.includes(candidate)) {
          jsonCandidates.push(candidate);
        }
      }
    }

    // 方法2: ```json ブロックの抽出
    const jsonBlockPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
    const jsonBlockMatches = cleanedText.match(jsonBlockPattern);
    if (jsonBlockMatches) {
      console.log('🔍 Method 2 - Found', jsonBlockMatches.length, 'JSON block matches');
      const cleaned = jsonBlockMatches.map(m => m.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim());
      cleaned.forEach(c => {
        if (!jsonCandidates.includes(c)) {
          jsonCandidates.push(c);
        }
      });
    }

    console.log('🔍 Total JSON candidates:', jsonCandidates.length);

    // 各JSON候補をパース
    for (let i = 0; i < jsonCandidates.length; i++) {
      const jsonStr = jsonCandidates[i];
      console.log(`🔍 Trying JSON candidate ${i + 1}:`, jsonStr.substring(0, 200) + '...');

      try {
        console.log(`🔍 Attempting to parse JSON (length: ${jsonStr.length})`);
        const data = JSON.parse(jsonStr);
        console.log(`✅ JSON parsed successfully:`, data);
        const meals = data.meals;
        console.log(`📋 Meals array:`, meals);

        if (meals && Array.isArray(meals) && meals.length > 0) {
          console.log(`✅ JSON candidate ${i + 1} parsed successfully: ${meals.length} meals`);

          // データを正規化
          const validMeals: MealData[] = [];
          for (let mealIdx = 0; mealIdx < meals.length; mealIdx++) {
            const meal = meals[mealIdx];
            if (typeof meal === 'object' && meal !== null) {
              // 必要な要素を確保
              const normalizedMeal: MealData = {
                mealType: meal.mealType || `食事${mealIdx + 1}`,
                calories: typeof meal.calories === 'number' ? meal.calories : 400,
                color: '#FF8C42',
                dishes: [],
                isFallback: false,
              };

              // dishesの処理
              const dishes = meal.dishes;
              if (Array.isArray(dishes)) {
                const cleanedDishes: string[] = [];
                for (const dish of dishes) {
                  if (typeof dish === 'string' && dish.trim()) {
                    // カロリー表記などを削除
                    let cleanDish = dish.replace(/\(\d+kcal\)/g, '').trim();
                    cleanDish = cleanDish.replace(/\d+kcal/g, '').trim();
                    if (cleanDish && !['主菜', '副菜', '汁物', '主食'].includes(cleanDish)) {
                      cleanedDishes.push(cleanDish);
                    }
                  }
                }
                normalizedMeal.dishes = cleanedDishes.length > 0 ? cleanedDishes : [`和食${mealIdx + 1}`];
              } else {
                normalizedMeal.dishes = [`和食${mealIdx + 1}`];
              }

              validMeals.push(normalizedMeal);
              console.log(`   - ${normalizedMeal.mealType}: ${normalizedMeal.dishes.join(', ')}`);
            }
          }

          if (validMeals.length > 0) {
            console.log(`✅ Successfully parsed ${validMeals.length} valid meals from AI`);
            return validMeals;
          }
        }
      } catch (parseError) {
        console.error(`❌ JSON candidate ${i + 1} parsing failed:`, parseError);
        console.error(`❌ Failed JSON string:`, jsonStr.substring(0, 500));
        console.error(`❌ Error message:`, (parseError as Error).message);
        continue;
      }
    }

    // すべてのパースが失敗した場合
    console.log('❌ All JSON parsing attempts failed');
    console.log('🔄 Falling back to default meals');
    return createDefaultMeals(targetCalories);

  } catch (error) {
    console.error('❌ Parse error:', error);
    return createDefaultMeals(targetCalories);
  }
}

/**
 * デフォルト献立を生成（フォールバック用）
 */
function createDefaultMeals(targetCalories: number): MealData[] {
  const breakfastCal = Math.round(targetCalories * 0.25);
  const lunchCal = Math.round(targetCalories * 0.4);
  const dinnerCal = targetCalories - breakfastCal - lunchCal;

  // バリエーション豊かなフォールバック献立
  const breakfastOptions = [
    ["ご飯", "納豆", "ほうれん草のお浸し"],
    ["食パン", "目玉焼き", "野菜サラダ"],
    ["ご飯", "焼き鮭", "きんぴらごぼう"],
    ["オートミール", "ヨーグルト", "バナナ"]
  ];

  const lunchOptions = [
    ["ご飯", "鶏の照り焼き", "野菜炒め", "わかめの味噌汁"],
    ["ご飯", "豚の生姜焼き", "きゅうりの酢の物", "豆腐の味噌汁"],
    ["ご飯", "鮭の塩焼き", "ひじきの煮物", "卵スープ"],
    ["ご飯", "ハンバーグ", "コールスロー", "コンソメスープ"]
  ];

  const dinnerOptions = [
    ["ご飯", "鮭の西京焼き", "きんぴらごぼう", "わかめの味噌汁"],
    ["ご飯", "鶏肉と野菜の煮物", "切り干し大根", "豆腐の味噌汁"],
    ["ご飯", "ぶりの照り焼き", "ほうれん草のごま和え", "なめこの味噌汁"],
    ["ご飯", "豚肉と茄子の味噌炒め", "もやしのナムル", "わかめスープ"]
  ];

  // ランダムに選択
  const selectedBreakfast = breakfastOptions[Math.floor(Math.random() * breakfastOptions.length)];
  const selectedLunch = lunchOptions[Math.floor(Math.random() * lunchOptions.length)];
  const selectedDinner = dinnerOptions[Math.floor(Math.random() * dinnerOptions.length)];

  return [
    {
      mealType: '朝食',
      calories: breakfastCal,
      dishes: selectedBreakfast,
      color: '#FF8C42',
      isFallback: true,
    },
    {
      mealType: '昼食',
      calories: lunchCal,
      dishes: selectedLunch,
      color: '#FF8C42',
      isFallback: true,
    },
    {
      mealType: '夕食',
      calories: dinnerCal,
      dishes: selectedDinner,
      color: '#FF8C42',
      isFallback: true,
    }
  ];
}

/**
 * 献立提案のメイン関数
 */
export async function getMealSuggestion(
  userPreferences: UserProfile,
  targetCalories: number
): Promise<{ meals: MealData[]; debug: any }> {
  console.log('🤖 BEDROCK REQUEST START');
  console.log('User preferences:', userPreferences);
  console.log('Target calories:', targetCalories);

  try {
    // プロンプト作成
    console.log('🔧 Creating prompt...');
    const prompt = createMealPrompt(userPreferences, targetCalories);
    console.log('📝 PROMPT created, length:', prompt.length);
    console.log('📝 PROMPT content:', prompt.substring(0, 200) + '...');

    // Bedrockクライアントを取得
    console.log('🔧 Getting Bedrock client...');
    const client = await getBedrockClient();
    console.log('✅ Bedrock client obtained');

    // Bedrock リクエスト（Amazon Nova Micro用の正しいフォーマット）
    const bedrockRequest = {
      messages: [
        {
          role: 'user',
          content: [
            {
              text: prompt
            }
          ]
        }
      ],
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.7,
        topP: 0.9,
      },
    };

    console.log('🔧 BEDROCK REQUEST BODY:', JSON.stringify(bedrockRequest, null, 2));

    // Bedrock API呼び出し（Nova Micro Inference Profile）
    const command = new InvokeModelCommand({
      modelId: 'us.amazon.nova-micro-v1:0', // Inference Profileを使用
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(bedrockRequest),
    });

    const response = await client.send(command);
    console.log('✅ BEDROCK RESPONSE RECEIVED');
    console.log('Raw response:', response);
    console.log('Raw response body type:', typeof response.body);

    // レスポンスの解析
    let responseBody;
    try {
      const decodedBody = new TextDecoder().decode(response.body);
      console.log('📦 Decoded body:', decodedBody);
      responseBody = JSON.parse(decodedBody);
      console.log('📦 Parsed Bedrock response body:', JSON.stringify(responseBody, null, 2));
      console.log('📦 Response body keys:', Object.keys(responseBody));
      console.log('📦 Results array:', responseBody.results);
    } catch (parseError) {
      console.error('❌ Failed to parse response body:', parseError);
      throw parseError;
    }

    // Amazon Nova Microのレスポンス構造に対応
    // レスポンス構造: { output: { message: { content: [{ text: string }] } } }
    let mealSuggestionText = '';

    // 複数のレスポンス構造に対応
    if (responseBody.output && responseBody.output.message && responseBody.output.message.content) {
      // Nova形式
      const content = responseBody.output.message.content;
      if (Array.isArray(content) && content.length > 0 && content[0].text) {
        mealSuggestionText = content[0].text;
        console.log('✅ Found text in output.message.content[0].text (Nova format)');
      }
    } else if (responseBody.results && responseBody.results.length > 0) {
      // Titan形式（後方互換性）
      mealSuggestionText = responseBody.results[0].outputText;
      console.log('✅ Found outputText in results[0].outputText (Titan format)');
    } else if (responseBody.outputText) {
      // 代替構造1
      mealSuggestionText = responseBody.outputText;
      console.log('✅ Found outputText in root level');
    } else if (responseBody.completion) {
      // 代替構造2
      mealSuggestionText = responseBody.completion;
      console.log('✅ Found text in completion');
    } else if (responseBody.generated_text) {
      // 代替構造3
      mealSuggestionText = responseBody.generated_text;
      console.log('✅ Found text in generated_text');
    } else {
      console.log('❌ BEDROCK ERROR: Unknown response structure');
      console.log('❌ Full response body:', JSON.stringify(responseBody, null, 2));
      const meals = createDefaultMeals(targetCalories);
      return {
        meals,
        debug: {
          promptSent: prompt,
          aiResponse: 'Unknown response structure from Bedrock',
          usingFallback: true,
          mealSource: 'FALLBACK_UNKNOWN_STRUCTURE',
          bedrockStatus: 'UNKNOWN_STRUCTURE',
          bedrockResponseBody: responseBody,
        },
      };
    }

    console.log('🎯 BEDROCK RAW RESPONSE TEXT:', mealSuggestionText);
    console.log('🎯 Response text length:', mealSuggestionText?.length || 0);
    console.log('🎯 Response text type:', typeof mealSuggestionText);

    // 空のレスポンスチェック
    if (!mealSuggestionText || mealSuggestionText.trim().length === 0) {
      console.error('❌ BEDROCK ERROR: Empty response text');
      console.error('❌ Response details:', {
        completionReason: responseBody.results[0]?.completionReason,
        tokenCount: responseBody.results[0]?.tokenCount,
        inputTextTokenCount: responseBody.inputTextTokenCount,
      });
      console.error('❌ This might indicate:');
      console.error('   - Content filter blocking the response');
      console.error('   - Invalid request format');
      console.error('   - Model reached token limit before generating output');
      
      const meals = createDefaultMeals(targetCalories);
      return {
        meals,
        debug: {
          promptSent: prompt,
          aiResponse: `Empty response from Bedrock (completionReason: ${responseBody.results[0]?.completionReason}, tokenCount: ${responseBody.results[0]?.tokenCount})`,
          usingFallback: true,
          mealSource: 'FALLBACK_EMPTY_RESPONSE',
          bedrockStatus: 'EMPTY_RESPONSE',
          bedrockResponseBody: responseBody,
        },
      };
    }

    // AIの応答をパース
    const meals = parseMealSuggestion(mealSuggestionText, targetCalories);
    const isUsingFallback = meals.length === 0 || meals.some(m => m.isFallback);

    console.log(`📊 Parse result: ${isUsingFallback ? 'FALLBACK' : 'AI_GENERATED'} (${meals.length} meals)`);

    return {
      meals,
      debug: {
        promptSent: prompt,
        aiResponse: mealSuggestionText,
        usingFallback: isUsingFallback,
        mealSource: isUsingFallback ? 'FALLBACK' : 'AI_GENERATED',
        bedrockStatus: 'SUCCESS',
      },
    };

  } catch (error) {
    console.error('❌ BEDROCK API ERROR:', error);
    const meals = createDefaultMeals(targetCalories);
    return {
      meals,
      debug: {
        promptSent: '',
        aiResponse: `Bedrock API Error: ${error}`,
        usingFallback: true,
        mealSource: 'FALLBACK_BEDROCK_ERROR',
        bedrockStatus: 'API_ERROR',
        bedrockError: String(error),
      },
    };
  }
}
