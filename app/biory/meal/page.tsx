"use client";
 
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import BioryLayout from "../components/BioryLayout";
import styles from "./meal.module.css";
import { fetchCognitoUserInfo } from '../components/function';
import { useRouter } from "next/navigation";

const client = generateClient<Schema>();

export default function MealPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cognitoUserId, setCognitoUserId] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null); // ユーザープロファイル

  // 🆕 kondateAI関連のstate　小澤
  const [kondateResult, setKondateResult] = useState<string>('');
  const [kondateLoading, setKondateLoading] = useState<boolean>(false);
  const [showKondateResult, setShowKondateResult] = useState<boolean>(false);
  const [kondateDebugInfo, setKondateDebugInfo] = useState<any>(null); // AI プロンプトデバッグ情報
  
  // AI献立提案のパース結果
  interface ParsedMeal {
    mealType: string;
    menu: string;
    calories: string;
    nutrition: {
      protein: string;
      carbs: string;
      fat: string;
    };
    ingredients: string[];
    cookingSteps: string;
    nutritionPoint: string;
  }
  
  interface ParsedKondateResult {
    userName: string;
    meals: ParsedMeal[];
    totalCalories: string;
    totalNutrition: {
      protein: string;
      carbs: string;
      fat: string;
    };
    considerations: string[];
    healthAdvice: string;
  }
  
  const [parsedKondate, setParsedKondate] = useState<ParsedKondateResult | null>(null);
  

  // BMR計算（基礎代謝率）
  const calculateBMR = (profile: any) => {
    if (!profile || !profile.weight || !profile.height || !profile.age || !profile.gender) {
      return 2000; // デフォルト値
    }
    
    if (profile.gender === "男") {
      return Math.round(88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age));
    } else if (profile.gender === "女") {
      return Math.round(447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age));
    } else {
      // その他の場合は平均値を使用
      return Math.round(((88.362 + (13.397 * profile.weight) + (4.799 * profile.height) - (5.677 * profile.age)) + 
                        (447.593 + (9.247 * profile.weight) + (3.098 * profile.height) - (4.330 * profile.age))) / 2);
    }
  };

  // 活動係数を取得
  const getActivityFactor = (exerciseFrequency: string) => {
    switch (exerciseFrequency) {
      case "ほとんど運動しない":
        return 1.2;
      case "週1〜3回の軽い運動":
        return 1.375;
      case "週3〜5回の中程度の運動":
        return 1.55;
      case "週6〜7回の激しい運動":
        return 1.725;
      case "毎日2回の運動や肉体労働":
        return 1.9;
      default:
        return 1.2; // デフォルト値（ほとんど運動しない）
    }
  };

  // TDEE計算（BMR × 活動係数）
  const calculateTDEE = (profile: any) => {
    if (!profile) {
      return 2000; // デフォルト値
    }
    
    const bmr = calculateBMR(profile);
    const activityFactor = getActivityFactor(profile.exerciseFrequency || "ほとんど運動しない");
    return Math.round(bmr * activityFactor);
  };

  // Markdownをパースする関数
  const parseKondateMarkdown = (markdown: string): ParsedKondateResult | null => {
    try {
      const lines = markdown.split('\n');
      
      const result: ParsedKondateResult = {
        userName: '',
        meals: [],
        totalCalories: '',
        totalNutrition: { protein: '', carbs: '', fat: '' },
        considerations: [],
        healthAdvice: ''
      };
      
      let currentMeal: Partial<ParsedMeal> | null = null;
      let currentSection = '';
      let inCookingSteps = false; // 調理手順セクション内かどうかのフラグ
      let cookingStepsLines: string[] = []; // 調理手順の行を保存
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // タイトルから名前を抽出
        if (trimmedLine.startsWith('# ') && trimmedLine.includes('さんの1日献立プラン')) {
          result.userName = trimmedLine.replace('# ', '').replace('さんの1日献立プラン', 'さん');
        }
        
        // セクションの判定
        if (trimmedLine.startsWith('## ')) {
          // 調理手順セクション終了処理
          if (inCookingSteps && currentMeal && cookingStepsLines.length > 0) {
            currentMeal.cookingSteps = cookingStepsLines.join('\n');
            cookingStepsLines = [];
            inCookingSteps = false;
          }
          
          const section = trimmedLine.replace('## ', '');
          
          if (section === '朝食' || section === '昼食' || section === '夕食') {
            if (currentMeal && currentMeal.mealType) {
              result.meals.push(currentMeal as ParsedMeal);
            }
            currentMeal = {
              mealType: section,
              menu: '',
              calories: '',
              nutrition: { protein: '', carbs: '', fat: '' },
              ingredients: [],
              cookingSteps: '',
              nutritionPoint: ''
            };
            currentSection = section;
          } else if (section === '1日合計') {
            if (currentMeal && currentMeal.mealType) {
              result.meals.push(currentMeal as ParsedMeal);
              currentMeal = null;
            }
            currentSection = '1日合計';
          } else if (section.includes('配慮したこと')) {
            currentSection = '配慮したこと';
          } else if (section === '健康アドバイス') {
            currentSection = '健康アドバイス';
          }
          continue;
        }
        
        // データの抽出
        if (currentMeal) {
          if (trimmedLine.startsWith('- **メニュー**:')) {
            currentMeal.menu = trimmedLine.replace('- **メニュー**:', '').trim();
            inCookingSteps = false;
          } else if (trimmedLine.startsWith('- **カロリー**:')) {
            currentMeal.calories = trimmedLine.replace('- **カロリー**:', '').trim();
            inCookingSteps = false;
          } else if (trimmedLine.startsWith('- **栄養バランス**:')) {
            const nutritionText = trimmedLine.replace('- **栄養バランス**:', '').trim();
            const proteinMatch = nutritionText.match(/タンパク質([\d.]+)g/);
            const carbsMatch = nutritionText.match(/炭水化物([\d.]+)g/);
            const fatMatch = nutritionText.match(/脂質([\d.]+)g/);
            
            if (proteinMatch) currentMeal.nutrition!.protein = proteinMatch[1];
            if (carbsMatch) currentMeal.nutrition!.carbs = carbsMatch[1];
            if (fatMatch) currentMeal.nutrition!.fat = fatMatch[1];
            inCookingSteps = false;
          } else if (trimmedLine.startsWith('- **使用食材リストと分量**:')) {
            inCookingSteps = false;
            console.log('📋 使用食材リストと分量セクション検出');
            // 次の行から食材リストを読み取る
          } else if ((trimmedLine.startsWith('  - ') || trimmedLine.startsWith('- ')) && !inCookingSteps && !trimmedLine.startsWith('- **')) {
            // 食材リスト（2スペース + ハイフン、または1つのハイフン）
            let ingredient = trimmedLine;
            if (ingredient.startsWith('  - ')) {
              ingredient = ingredient.replace('  - ', '').trim();
            } else if (ingredient.startsWith('- ')) {
              ingredient = ingredient.replace('- ', '').trim();
            }
            
            if (ingredient) {
              console.log('🥗 食材追加:', ingredient);
              currentMeal.ingredients!.push(ingredient);
            }
          } else if (trimmedLine.startsWith('- **簡単な調理手順**:')) {
            inCookingSteps = true;
            cookingStepsLines = [];
            const stepText = trimmedLine.replace('- **簡単な調理手順**:', '').trim();
            if (stepText) {
              cookingStepsLines.push(stepText);
            }
          } else if (inCookingSteps) {
            // 調理手順内の行
            if (trimmedLine.startsWith('- **栄養ポイント**:')) {
              // 調理手順セクション終了
              if (cookingStepsLines.length > 0) {
                currentMeal.cookingSteps = cookingStepsLines.join('\n');
                console.log('📝 調理手順 (行数: ' + cookingStepsLines.length + '):', currentMeal.cookingSteps);
                cookingStepsLines = [];
              }
              inCookingSteps = false;
              currentMeal.nutritionPoint = trimmedLine.replace('- **栄養ポイント**:', '').trim();
            } else if (trimmedLine.startsWith('- **')) {
              // 次のセクション開始（調理手順終了）
              if (cookingStepsLines.length > 0) {
                currentMeal.cookingSteps = cookingStepsLines.join('\n');
                console.log('📝 調理手順 (行数: ' + cookingStepsLines.length + '):', currentMeal.cookingSteps);
                cookingStepsLines = [];
              }
              inCookingSteps = false;
              // この行は次のセクションなので、再処理のため何もしない
            } else if (trimmedLine.match(/^\d+\./) || trimmedLine.startsWith('  ') || trimmedLine.length > 0) {
              // 番号付きリスト、インデントされた行、または空でない行
              cookingStepsLines.push(trimmedLine);
              console.log('🔪 調理手順行追加:', trimmedLine);
            } else if (trimmedLine === '') {
              // 空行も保持（改行として）
              if (cookingStepsLines.length > 0) {
                cookingStepsLines.push('');
              }
            }
          } else if (trimmedLine.startsWith('- **栄養ポイント**:')) {
            currentMeal.nutritionPoint = trimmedLine.replace('- **栄養ポイント**:', '').trim();
            inCookingSteps = false;
          }
        }
        
        // 1日合計セクション
        if (currentSection === '1日合計') {
          if (trimmedLine.startsWith('- **総カロリー**:')) {
            result.totalCalories = trimmedLine.replace('- **総カロリー**:', '').trim();
          } else if (trimmedLine.startsWith('- **栄養バランス**:')) {
            const nutritionText = trimmedLine.replace('- **栄養バランス**:', '').trim();
            const proteinMatch = nutritionText.match(/タンパク質([\d.]+)g/);
            const carbsMatch = nutritionText.match(/炭水化物([\d.]+)g/);
            const fatMatch = nutritionText.match(/脂質([\d.]+)g/);
            
            if (proteinMatch) result.totalNutrition.protein = proteinMatch[1];
            if (carbsMatch) result.totalNutrition.carbs = carbsMatch[1];
            if (fatMatch) result.totalNutrition.fat = fatMatch[1];
          }
        }
        
        // 配慮したことセクション
        if (currentSection === '配慮したこと' && trimmedLine.startsWith('- ')) {
          const consideration = trimmedLine.replace('- ', '').trim();
          if (consideration) {
            result.considerations.push(consideration);
          }
        }
        
        // 健康アドバイスセクション
        if (currentSection === '健康アドバイス' && trimmedLine.startsWith('- ')) {
          result.healthAdvice += trimmedLine.replace('- ', '').trim() + ' ';
        }
      }
      
      // 最後の食事を追加（調理手順が残っている場合も処理）
      if (currentMeal && currentMeal.mealType) {
        if (inCookingSteps && cookingStepsLines.length > 0) {
          currentMeal.cookingSteps = cookingStepsLines.join('\n');
        }
        result.meals.push(currentMeal as ParsedMeal);
      }
      
      return result;
    } catch (error) {
      console.error('Markdownパースエラー:', error);
      return null;
    }
  };

  // 🆕 kondateAI呼び出し関数 小澤
  const callKondateAI = async () => {
    setKondateLoading(true);
    setKondateResult('');
    setShowKondateResult(false);
    setParsedKondate(null);
    
    try {
      console.log('🤖 kondateAI呼び出し開始...');
      
      // DynamoDBからユーザープロファイルを取得してアレルギー情報を取得
      let allergiesInfo = "なし";
      let userName = "ユーザー";
      let recommendedCalories = 2000; // デフォルト値
      let conditionInfo = ""; // 体調情報
      let moodInfo = ""; // 気分情報
      
      if (cognitoUserId) {
        try {
          console.log('🔍 DynamoDB UserProfile取得開始... userId:', cognitoUserId);
          
          const { data: profiles } = await client.models.UserProfile.list({
            filter: { userId: { eq: cognitoUserId } }
          });
          
          console.log('📊 取得したプロファイル数:', profiles?.length || 0);
          
          if (profiles && profiles.length > 0) {
            const profile = profiles[0];
            allergiesInfo = profile.allergies || "なし";
            userName = profile.name || "ユーザー";
            
            // 推奨カロリー（TDEE）を計算
            recommendedCalories = calculateTDEE(profile);
            
            console.log('✅ DynamoDBからユーザー情報を取得:', {
              userName: userName,
              allergies: allergiesInfo,
              recommendedCalories: recommendedCalories,
              profileData: profile
            });
          } else {
            console.log('⚠️ UserProfileが見つかりませんでした');
          }

          // DailyRecordから本日の体調・気分を取得
          console.log('🔍 DynamoDB DailyRecord取得開始...');
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
          
          const { data: dailyRecords } = await client.models.DailyRecord.list({
            filter: {
              userId: { eq: cognitoUserId },
              date: { eq: today }
            }
          });
          
          console.log('📊 取得したDailyRecord数:', dailyRecords?.length || 0);
          
          if (dailyRecords && dailyRecords.length > 0) {
            const dailyRecord = dailyRecords[0];
            
            // 有効な体調・気分のみを設定（絵文字付き）
            const validConditions = ['とても良い 😊', '良い 😌', '普通 😐', '少し悪い 😟', '悪い 😵'];
            const validMoods = ['ポジティブ', '普通', 'ネガティブ', 'リラックス', 'やる気満々', '疲れ気味'];
            
            if (dailyRecord.condition && validConditions.includes(dailyRecord.condition)) {
              conditionInfo = dailyRecord.condition;
            }
            
            if (dailyRecord.mood && validMoods.includes(dailyRecord.mood)) {
              moodInfo = dailyRecord.mood;
            }
            
            console.log('✅ DailyRecordから体調・気分を取得:', {
              condition: conditionInfo || '未設定',
              mood: moodInfo || '未設定',
              rawCondition: dailyRecord.condition,
              rawMood: dailyRecord.mood,
              dailyRecordData: dailyRecord
            });
          } else {
            console.log('⚠️ 本日のDailyRecordが見つかりませんでした');
          }
          
        } catch (dbError) {
          console.error('❌ DynamoDB取得エラー:', dbError);
          // エラーの場合はデフォルト値を使用
        }
      } else {
        console.log('⚠️ cognitoUserIdが設定されていません');
      }
      
      // デバッグ情報を作成
      const debugData = {
        userName: userName,
        userId: cognitoUserId,
        allergies: allergiesInfo,
        recommendedCalories: recommendedCalories,
        condition: conditionInfo || "未設定",
        mood: moodInfo || "未設定",
        timestamp: new Date().toISOString(),
        source: 'DynamoDB UserProfile & DailyRecord'
      };
      
      setKondateDebugInfo(debugData);
      console.log('🔍 デバッグ情報を設定:', debugData);
      
      console.log('🤖 呼び出しパラメータ:', { 
        userName, 
        allergies: allergiesInfo, 
        recommendedCalories,
        condition: conditionInfo || "未設定",
        mood: moodInfo || "未設定"
      });
      
      const result = await client.queries.kondateAI({
        name: userName,
        allergies: allergiesInfo,
        recommendedCalories: recommendedCalories,
        condition: conditionInfo,
        mood: moodInfo
      });
      
      console.log('🤖 kondateAI結果:', result);
      
      if (result.data) {
        console.log('📝 AIからのRawデータ (文字列長):', result.data.length);
        console.log('📝 AIからのRawデータ (最初の500文字):', result.data.substring(0, 500));
        
        // JSONレスポンスをパース
        let responseData;
        let markdownContent;
        try {
          responseData = JSON.parse(result.data);
          markdownContent = responseData.response;
          
          // デバッグ情報を保存
          if (responseData.debug) {
            setKondateDebugInfo(responseData.debug);
            console.log('🔍 デバッグ情報:', responseData.debug);
          }
        } catch (e) {
          // JSON形式でない場合は、そのままMarkdownとして扱う（後方互換性）
          console.log('📝 JSON形式ではないため、直接Markdownとして扱います');
          markdownContent = result.data;
          responseData = { response: markdownContent, debug: null };
        }
        
        setKondateResult(markdownContent);
        setShowKondateResult(true);
        
        // Markdownをパースして構造化データに変換
        const parsed = parseKondateMarkdown(markdownContent);
        if (parsed) {
          setParsedKondate(parsed);
          console.log('🍽️ パース結果:', parsed);
          console.log('🍽️ パース結果 - 食事数:', parsed.meals.length);
          parsed.meals.forEach((meal, index) => {
            console.log(`🍽️ 食事 ${index + 1} (${meal.mealType}):`, {
              menu: meal.menu,
              calories: meal.calories,
              ingredientsCount: meal.ingredients.length,
              ingredients: meal.ingredients,
              cookingSteps: meal.cookingSteps,
              nutritionPoint: meal.nutritionPoint
            });
          });
          
          // AI献立提案の結果をlocalStorageに保存
          saveAIKondateToStorage(parsed, markdownContent, responseData?.debug);
        } else {
          console.error('❌ パース失敗: parseKondateMarkdownがnullを返しました');
        }
      } else if (result.errors) {
        setKondateResult(`エラー: ${JSON.stringify(result.errors)}`);
        setShowKondateResult(true);
      }
    } catch (error) {
      console.error('🤖 kondateAI呼び出しエラー:', error);
      setKondateResult(`エラー: ${error}`);
      setShowKondateResult(true);
    } finally {
      setKondateLoading(false);
    }
  };
  // ここまで

  // カロリー計算
  const maxCalories = userProfile ? calculateTDEE(userProfile) : 2000; // TDEEに基づく推奨カロリー
 
  useEffect(() => {
    loadUserInfo();
    loadMealsFromStorage(); // 保存された献立データを復元

    // ページフォーカス時にユーザー情報を再取得（セッション維持のため）
    const handleFocus = () => {
      loadUserInfo();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // localStorageから献立データを復元する関数
  const loadMealsFromStorage = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const aiKondateKey = `ai_kondate_${today}`;
      
      // 古いデータをクリア（過去3日より古いデータを削除）
      clearOldMealData();
      
      // AI献立提案データの復元
      const savedAIKondate = localStorage.getItem(aiKondateKey);
      if (savedAIKondate) {
        try {
          const parsed = JSON.parse(savedAIKondate);
          setParsedKondate(parsed.parsedKondate);
          setKondateResult(parsed.kondateResult);
          setShowKondateResult(true);
          if (parsed.kondateDebugInfo) {
            setKondateDebugInfo(parsed.kondateDebugInfo);
          }
          console.log('保存されたAI献立データを復元しました:', parsed);
        } catch (parseError) {
          console.error('AI献立データのパースエラー:', parseError);
        }
      }
    } catch (error) {
      console.error('献立データの復元エラー:', error);
    }
  };

  // AI献立提案データをlocalStorageに保存する関数
  const saveAIKondateToStorage = (parsedData: ParsedKondateResult, rawMarkdown: string, debugInfo?: any) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `ai_kondate_${today}`;
      const dataToSave = {
        parsedKondate: parsedData,
        kondateResult: rawMarkdown,
        kondateDebugInfo: debugInfo,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      console.log('AI献立データをlocalStorageに保存しました:', dataToSave);
    } catch (error) {
      console.error('AI献立データの保存エラー:', error);
    }
  };

  // 古い献立データをlocalStorageから削除する関数
  const clearOldMealData = () => {
    try {
      const today = new Date();
      const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      // localStorageの全キーをチェック
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ai_kondate_')) {
          const dateStr = key.replace('ai_kondate_', '');
          const itemDate = new Date(dateStr);
          
          // 3日より古いデータは削除
          if (itemDate < threeDaysAgo) {
            localStorage.removeItem(key);
            console.log('古い献立データを削除しました:', key);
          }
        }
      }
    } catch (error) {
      console.error('古いデータの削除エラー:', error);
    }
  };
 


  // Cognitoユーザー情報を取得する関数（共通関数を使用）
  const loadUserInfo = async () => {
    try {
      const userInfo = await fetchCognitoUserInfo();
      setCognitoUserId(userInfo.userId);
      
      console.log('Meal - Cognito User Info:', {
        userId: userInfo.userId,
        email: userInfo.email
      });

      // ユーザープロファイルを取得
      const profile = await getUserProfile(userInfo.userId);
      setUserProfile(profile);

    } catch (error) {
      console.error('Meal画面でのCognitoユーザー情報取得エラー:', error);
      // 認証されていない場合はログイン画面へ
      router.push("/biory/login");
    } 
  };
 
  const getTodayDate = () => {
    const today = new Date();
    return today.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric'
    });
  };

  // ユーザープロファイル取得または作成
  const getUserProfile = async (userId = cognitoUserId) => {
    try {
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: userId } }
      });
      
      if (profiles.length > 0) {
        return profiles[0];
      }
      
    } catch (error) {
      console.error('ユーザープロファイル取得/作成エラー:', error);
      return null;
    }
  };

  // 献立を保存する関数（PFCデータ対応版）
  const saveMealPlan = async () => {
    // AI献立提案データをチェック
    if (!parsedKondate) {
      alert('保存する献立がありません');
      return;
    }

    try {
      setLoading(true);
      
      // 現在の日付を取得
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
      
      // 現在のユーザーIDを取得
      const user = await getCurrentUser();
      const currentUserId = user.userId;

      // 各食事の内容と栄養価を準備
      const mealData: any = {
        breakfast: '',
        lunch: '',
        dinner: '',
        // 朝食栄養データ
        calories_bre: 0,
        protein_bre: 0,
        fat_bre: 0,
        carbs_bre: 0,
        // 昼食栄養データ
        calories_lun: 0,
        protein_lun: 0,
        fat_lun: 0,
        carbs_lun: 0,
        // 夕食栄養データ
        calories_din: 0,
        protein_din: 0,
        fat_din: 0,
        carbs_din: 0,
      };

      // AI献立提案データがある場合はそれを使用
      if (parsedKondate && parsedKondate.meals) {
        console.log("AI献立データから食事内容と栄養価を抽出中...");
        
        parsedKondate.meals.forEach((meal) => {
          // 料理名のみを保存（食材名は含めない）
          const dishText = meal.menu;
          
          // カロリーと栄養価を数値に変換
          const calories = parseFloat(meal.calories.replace(/[^\d.]/g, '')) || 0;
          const protein = parseFloat(meal.nutrition.protein) || 0;
          const fat = parseFloat(meal.nutrition.fat) || 0;
          const carbs = parseFloat(meal.nutrition.carbs) || 0;
          
          console.log(`${meal.mealType} 栄養価:`, { calories, protein, fat, carbs });
          
          switch (meal.mealType) {
            case '朝食':
              mealData.breakfast = dishText;
              mealData.calories_bre = Math.round(calories);
              mealData.protein_bre = Math.round(protein * 10) / 10;
              mealData.fat_bre = Math.round(fat * 10) / 10;
              mealData.carbs_bre = Math.round(carbs * 10) / 10;
              break;
            case '昼食':
              mealData.lunch = dishText;
              mealData.calories_lun = Math.round(calories);
              mealData.protein_lun = Math.round(protein * 10) / 10;
              mealData.fat_lun = Math.round(fat * 10) / 10;
              mealData.carbs_lun = Math.round(carbs * 10) / 10;
              break;
            case '夕食':
              mealData.dinner = dishText;
              mealData.calories_din = Math.round(calories);
              mealData.protein_din = Math.round(protein * 10) / 10;
              mealData.fat_din = Math.round(fat * 10) / 10;
              mealData.carbs_din = Math.round(carbs * 10) / 10;
              break;
          }
        });
      }

      console.log('保存予定データ:', mealData);

      // 既存の記録があるかチェック
      const { data: existingRecords } = await client.models.DailyRecord.list({
        filter: {
          and: [
            { userId: { eq: currentUserId } },
            { date: { eq: today } }
          ]
        }
      });

      if (existingRecords && existingRecords.length > 0) {
        // 既存記録を更新
        console.log("既存記録を更新します");
        
        const updateData: any = { id: existingRecords[0].id };
        
        // 食事データを更新
        if (mealData.breakfast) updateData.breakfast = mealData.breakfast;
        if (mealData.lunch) updateData.lunch = mealData.lunch;
        if (mealData.dinner) updateData.dinner = mealData.dinner;
        
        // 栄養データを更新
        updateData.calories_bre = mealData.calories_bre;
        updateData.protein_bre = mealData.protein_bre;
        updateData.fat_bre = mealData.fat_bre;
        updateData.carbs_bre = mealData.carbs_bre;
        updateData.calories_lun = mealData.calories_lun;
        updateData.protein_lun = mealData.protein_lun;
        updateData.fat_lun = mealData.fat_lun;
        updateData.carbs_lun = mealData.carbs_lun;
        updateData.calories_din = mealData.calories_din;
        updateData.protein_din = mealData.protein_din;
        updateData.fat_din = mealData.fat_din;
        updateData.carbs_din = mealData.carbs_din;
        
        await client.models.DailyRecord.update(updateData);
        console.log("既存記録の更新完了:", updateData);
      } else {
        // 新規記録を作成
        const newRecord = {
          userId: currentUserId,
          date: today,
          ...mealData
        };
        console.log("新規記録を作成します:", newRecord);
        
        await client.models.DailyRecord.create(newRecord);
        console.log("新規記録の作成完了");
      }

      // 保存成功の詳細表示
      const totalCalories = mealData.calories_bre + mealData.calories_lun + mealData.calories_din;
      const totalProtein = mealData.protein_bre + mealData.protein_lun + mealData.protein_din;
      const totalFat = mealData.fat_bre + mealData.fat_lun + mealData.fat_din;
      const totalCarbs = mealData.carbs_bre + mealData.carbs_lun + mealData.carbs_din;
      
      alert(`献立を保存しました！\n\n` +
            `📊 保存された栄養価:\n` +
            `カロリー: ${totalCalories}kcal\n` +
            `たんぱく質: ${Math.round(totalProtein * 10) / 10}g\n` +
            `脂質: ${Math.round(totalFat * 10) / 10}g\n` +
            `炭水化物: ${Math.round(totalCarbs * 10) / 10}g\n\n` +
            `ホーム画面で確認できます。`);
      
    } catch (error) {
      console.error('献立保存エラー:', error);
      alert('献立の保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <BioryLayout>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>今日のあなたにぴったりの献立</h1>
          <p className={styles.date}>{getTodayDate()}</p>
        </header>


        {/* 🆕 kondateAIセクション　小澤 */}
        <div className={styles.kondateAISection}>
          <div className={styles.topButtonsContainer}>
            <button
              onClick={callKondateAI}
              disabled={kondateLoading}
              className={styles.aiButton}
            >
              {kondateLoading ? (
                <div className={styles.loadingRiceContainer}>
                  <img 
                    src="/riceicon.png" 
                    alt="献立作成中" 
                    className={styles.loadingRiceIcon}
                  />
                  <span className={styles.loadingText}>AI献立作成中...</span>
                </div>
              ) : (
                <>
                  🍽️ AI献立を作成
                </>
              )}
            </button>
            
            <button 
              className={styles.saveButton}
              onClick={saveMealPlan}
              disabled={!parsedKondate || kondateLoading}
            >
              💾 献立を保存
            </button>
          </div>

          {/* 🆕 ボタン下の範囲内でのローディング表示 */}
          {kondateLoading && (
            <div className={styles.inlineLoadingContainer}>
              <div className={styles.inlineLoadingContent}>
                <img 
                  src="/riceicon.png" 
                  alt="献立作成中" 
                  className={styles.inlineLoadingRice}
                />
                <h3 className={styles.inlineLoadingTitle}>
                  あなたにぴったりの献立を作成中...
                </h3>
                <div className={styles.inlineLoadingDots}>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            </div>
          )}
          
          {parsedKondate && (
            <div className={styles.kondateResultContainer}>
              {/* 食事カードと円形カロリー表示セクション */}
              <div className={styles.mealAndCalorieSection}>
                {/* 食事カードコンテナ */}
                <div className={styles.aiMealsContainer}>
                {parsedKondate.meals.map((meal, index) => {
                  const colors = ['#FF8C42', '#FFA500', '#FF6B35'];
                  const mealColor = colors[index % colors.length];
                  
                  return (
                    <div key={index} className={styles.aiMealCard}>
                      <div
                        className={styles.aiMealHeader}
                        style={{ backgroundColor: mealColor }}
                      >
                        <span className={styles.aiMealType}>{meal.mealType}</span>
                        <span className={styles.aiCalories}>{meal.calories}</span>
                      </div>
                      
                      <div className={styles.aiMealContent}>
                        
                        <div className={styles.aiMealDetails}>
                          <div className={styles.aiMenuItem}>
                            <strong>{meal.menu || '未設定'}</strong>
                          </div>
                          
                          <div className={styles.aiNutritionInfo}>
                            <strong>栄養バランス:</strong> タンパク質{meal.nutrition.protein}g、
                            炭水化物{meal.nutrition.carbs}g、脂質{meal.nutrition.fat}g
                          </div>
                          
                          <div className={styles.aiIngredients}>
                            <strong>使用食材リストと分量:</strong>
                            {meal.ingredients.length > 0 ? (
                              <ul>
                                {meal.ingredients.map((ingredient, idx) => (
                                  <li key={idx}>{ingredient}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className={styles.noData}>食材情報なし</p>
                            )}
                          </div>
                          
                          <div className={styles.aiCookingSteps}>
                            <details>
                              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                簡単な調理手順
                              </summary>
                              {meal.cookingSteps ? (
                                <div style={{ whiteSpace: 'pre-line', marginTop: '8px', paddingLeft: '10px' }}>
                                  {meal.cookingSteps}
                                </div>
                              ) : (
                                <p style={{ marginTop: '8px', paddingLeft: '10px' }}>調理手順情報なし</p>
                              )}
                            </details>
                          </div>
                          
                          <div className={styles.aiNutritionPoint}>
                            <details>
                              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                栄養ポイント
                              </summary>
                              <p style={{ marginTop: '8px', paddingLeft: '10px' }}>
                                {meal.nutritionPoint || '栄養ポイント情報なし'}
                              </p>
                            </details>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
                
                {/* 円形カロリー表示 */}
                <div className={styles.circularCalorieDisplay}>
                  {(() => {
                    const totalCaloriesNum = parseInt(parsedKondate.totalCalories.replace(/[^\d]/g, ''));
                    const percentage = Math.min((totalCaloriesNum / maxCalories) * 100, 100);
                    const radius = 80;
                    const circumference = 2 * Math.PI * radius;
                    const offset = circumference - (percentage / 100) * circumference;
                    
                    return (
                      <div className={styles.circularProgressWrapper}>
                        <svg width="200" height="200" className={styles.progressRing}>
                          <circle
                            className={styles.progressRingBg}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                          />
                          <circle
                            className={styles.progressRingProgress}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            transform="rotate(-90 100 100)"
                          />
                        </svg>
                        <div className={styles.progressText}>
                          <div className={styles.calorieRatioText}>
                            {parsedKondate.totalCalories}<br />
                            / {maxCalories} kcal
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 配慮したこと・健康アドバイスセクション - 吹き出し形式 */}
              <div className={styles.adviceSection}>
                {parsedKondate.considerations.length > 0 && (
                  <div className={styles.chatContainer}>
                    <div className={styles.chatMessage}>
                      <div className={styles.onigiriIcon}>
                        <img src="/riceicon.png" alt="おにぎり" />
                      </div>
                      <div className={styles.speechBubble}>
                        <div className={styles.speechBubbleContent}>
                          <strong>配慮したこと</strong>
                          <ul className={styles.chatList}>
                            {parsedKondate.considerations.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className={styles.speechTail}></div>
                      </div>
                    </div>
                  </div>
                )}
                
                {parsedKondate.healthAdvice && (
                  <div className={styles.chatContainer}>
                    <div className={styles.chatMessage}>
                      <div className={styles.humanIcon}>
                        <img src="/exercise.png" alt="エクササイズ" />
                      </div>
                      <div className={styles.speechBubble}>
                        <div className={styles.speechBubbleContent}>
                          <strong>健康アドバイス</strong>
                          <p className={styles.chatText}>{parsedKondate.healthAdvice}</p>
                        </div>
                        <div className={styles.speechTail}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* デバッグ情報: AIからのRawデータ */}
          {kondateResult && (
            <div style={{
              marginTop: '30px',
              padding: '20px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              border: '2px solid #ddd'
            }}>
              <h3 style={{
                margin: '0 0 15px 0',
                color: '#333',
                fontSize: '1.1rem',
                fontWeight: 'bold'
              }}>
                🔍 デバッグ情報: AIからの回答 (Raw Data)
              </h3>
              <details>
                <summary style={{
                  cursor: 'pointer',
                  padding: '10px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  marginBottom: '10px'
                }}>
                  クリックして表示
                </summary>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  backgroundColor: '#fff',
                  padding: '15px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  maxHeight: '500px',
                  overflow: 'auto',
                  margin: '10px 0 0 0'
                }}>
{kondateResult}
                </pre>
              </details>
              
              {kondateDebugInfo && (
                <details style={{ marginTop: '15px' }} open>
                  <summary style={{
                    cursor: 'pointer',
                    padding: '10px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    marginBottom: '10px'
                  }}>
                    �️ DynamoDBから取得した情報
                  </summary>
                  <div style={{
                    backgroundColor: '#fff',
                    padding: '15px',
                    borderRadius: '4px',
                    border: '2px solid #2196f3',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    margin: '10px 0 0 0'
                  }}>
                    <h4 style={{ marginTop: 0, color: '#2196f3' }}>📋 ユーザープロファイル情報</h4>
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      backgroundColor: '#f9f9f9', 
                      padding: '15px', 
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      fontSize: '0.9rem'
                    }}>
{`ユーザー名: ${kondateDebugInfo.userName || '不明'}
ユーザーID: ${kondateDebugInfo.userId || '不明'}
アレルギー情報: ${kondateDebugInfo.allergies || 'なし'}
データ取得元: ${kondateDebugInfo.source || 'N/A'}
取得日時: ${kondateDebugInfo.timestamp ? new Date(kondateDebugInfo.timestamp).toLocaleString('ja-JP') : 'N/A'}`}
                    </pre>
                    
                    <div style={{
                      marginTop: '15px',
                      padding: '10px',
                      backgroundColor: kondateDebugInfo.allergies && kondateDebugInfo.allergies !== 'なし' ? '#fff3e0' : '#e8f5e9',
                      borderRadius: '4px',
                      border: `2px solid ${kondateDebugInfo.allergies && kondateDebugInfo.allergies !== 'なし' ? '#ff9800' : '#4caf50'}`
                    }}>
                      <strong style={{ color: kondateDebugInfo.allergies && kondateDebugInfo.allergies !== 'なし' ? '#e65100' : '#2e7d32' }}>
                        {kondateDebugInfo.allergies && kondateDebugInfo.allergies !== 'なし' 
                          ? `⚠️ アレルギー情報: ${kondateDebugInfo.allergies}`
                          : '✅ アレルギーなし'}
                      </strong>
                    </div>
                    
                    {/* Lambda関数からのデバッグ情報（もし存在すれば） */}
                    {kondateDebugInfo.systemPrompt && (
                      <>
                        <h4 style={{ marginTop: '20px', color: '#ff9800' }}>� システムプロンプト</h4>
                        <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '4px', maxHeight: '300px', overflow: 'auto' }}>
{kondateDebugInfo.systemPrompt}
                        </pre>
                        
                        <h4 style={{ color: '#ff9800' }}>💬 ユーザーメッセージ</h4>
                        <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '4px' }}>
{kondateDebugInfo.userMessage}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}
              
              {parsedKondate && (
                <>
                  <details style={{ marginTop: '15px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      padding: '10px',
                      backgroundColor: '#e0e0e0',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      marginBottom: '10px'
                    }}>
                      パース結果 (JSON)
                    </summary>
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      backgroundColor: '#fff',
                      padding: '15px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      fontSize: '0.85rem',
                      lineHeight: '1.5',
                      maxHeight: '500px',
                      overflow: 'auto',
                      margin: '10px 0 0 0'
                    }}>
{JSON.stringify(parsedKondate, null, 2)}
                    </pre>
                  </details>
                  
                  <details style={{ marginTop: '15px' }}>
                    <summary style={{
                      cursor: 'pointer',
                      padding: '10px',
                      backgroundColor: '#e0e0e0',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      marginBottom: '10px'
                    }}>
                      パース結果の詳細 (各食事)
                    </summary>
                    <div style={{
                      backgroundColor: '#fff',
                      padding: '15px',
                      borderRadius: '4px',
                      border: '1px solid #ccc',
                      marginTop: '10px'
                    }}>
                      {parsedKondate.meals.map((meal, index) => (
                        <div key={index} style={{
                          marginBottom: '20px',
                          padding: '15px',
                          backgroundColor: '#f9f9f9',
                          borderRadius: '8px',
                          border: '1px solid #ddd'
                        }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>
                            {meal.mealType} ({meal.calories})
                          </h4>
                          <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                            <p><strong>メニュー:</strong> {meal.menu || '(なし)'}</p>
                            <p><strong>栄養:</strong> タンパク質{meal.nutrition.protein}g、炭水化物{meal.nutrition.carbs}g、脂質{meal.nutrition.fat}g</p>
                            <p><strong>食材数:</strong> {meal.ingredients.length}個</p>
                            <div style={{ marginLeft: '20px' }}>
                              {meal.ingredients.length > 0 ? (
                                <ul style={{ margin: '5px 0' }}>
                                  {meal.ingredients.map((ing, idx) => (
                                    <li key={idx}>{ing}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ color: '#999', fontStyle: 'italic' }}>食材情報なし</p>
                              )}
                            </div>
                            <p><strong>調理手順:</strong></p>
                            <pre style={{
                              whiteSpace: 'pre-wrap',
                              backgroundColor: '#fff',
                              padding: '10px',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              border: '1px solid #ddd'
                            }}>
{meal.cookingSteps || '(なし)'}
                            </pre>
                            <p><strong>栄養ポイント:</strong> {meal.nutritionPoint || '(なし)'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </div>
          )}
        </div>
      {/*ここまで*/}
      </div>
    </BioryLayout>
  );
}
 