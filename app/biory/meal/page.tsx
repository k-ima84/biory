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

//const API_ENDPOINT = "https://5obkiuclsb.execute-api.ap-northeast-1.amazonaws.com/prod/meal/suggestion";
const API_ENDPOINT = "https://u1a3a1qi9h.execute-api.ap-northeast-1.amazonaws.com/prod/meal/suggestion";

interface MealData {
  mealType: string;
  calories: number;
  dishes: string[];
  color: string;
  imageUrl?: string;
}
 
export default function MealPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [meals, setMeals] = useState<MealData[]>([]); // 初期値は空
  const [showMeals, setShowMeals] = useState(false); // 献立表示フラグ
  const [cognitoUserId, setCognitoUserId] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null); // ユーザープロファイル
  const [debugInfo, setDebugInfo] = useState<any>(null); // デバッグ情報

  // 🆕 kondateAI関連のstate　小澤
  const [kondateResult, setKondateResult] = useState<string>('');
  const [kondateLoading, setKondateLoading] = useState<boolean>(false);
  const [showKondateResult, setShowKondateResult] = useState<boolean>(false);
  
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
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // タイトルから名前を抽出
        if (trimmedLine.startsWith('# ') && trimmedLine.includes('さんの1日献立プラン')) {
          result.userName = trimmedLine.replace('# ', '').replace('さんの1日献立プラン', 'さん');
        }
        
        // セクションの判定
        if (trimmedLine.startsWith('## ')) {
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
        }
        
        // データの抽出
        if (currentMeal) {
          if (trimmedLine.startsWith('- **メニュー**:')) {
            currentMeal.menu = trimmedLine.replace('- **メニュー**:', '').trim();
          } else if (trimmedLine.startsWith('- **カロリー**:')) {
            currentMeal.calories = trimmedLine.replace('- **カロリー**:', '').trim();
          } else if (trimmedLine.startsWith('- **栄養バランス**:')) {
            const nutritionText = trimmedLine.replace('- **栄養バランス**:', '').trim();
            const proteinMatch = nutritionText.match(/タンパク質([\d.]+)g/);
            const carbsMatch = nutritionText.match(/炭水化物([\d.]+)g/);
            const fatMatch = nutritionText.match(/脂質([\d.]+)g/);
            
            if (proteinMatch) currentMeal.nutrition!.protein = proteinMatch[1];
            if (carbsMatch) currentMeal.nutrition!.carbs = carbsMatch[1];
            if (fatMatch) currentMeal.nutrition!.fat = fatMatch[1];
          } else if (trimmedLine.startsWith('  - ')) {
            const ingredient = trimmedLine.replace('  - ', '').trim();
            if (ingredient) {
              currentMeal.ingredients!.push(ingredient);
            }
          } else if (trimmedLine.startsWith('- **簡単な調理手順**:')) {
            currentMeal.cookingSteps = trimmedLine.replace('- **簡単な調理手順**:', '').trim();
          } else if (trimmedLine.startsWith('- **栄養ポイント**:')) {
            currentMeal.nutritionPoint = trimmedLine.replace('- **栄養ポイント**:', '').trim();
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
      
      // 最後の食事を追加
      if (currentMeal && currentMeal.mealType) {
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
      
      // ユーザー名を決定（ユーザープロファイルから取得、なければデフォルト）
      const userName = userProfile.name;
      
      const result = await client.queries.kondateAI({
        name: userName
      });
      
      console.log('🤖 kondateAI結果:', result);
      
      if (result.data) {
        setKondateResult(result.data);
        setShowKondateResult(true);
        
        // Markdownをパースして構造化データに変換
        const parsed = parseKondateMarkdown(result.data);
        if (parsed) {
          setParsedKondate(parsed);
          console.log('🍽️ パース結果:', parsed);
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
  const currentCalories = meals.reduce((total, meal) => total + meal.calories, 0);
  const maxCalories = userProfile ? calculateTDEE(userProfile) : 2000; // TDEEに基づく推奨カロリー
  const percentage = Math.min((currentCalories / maxCalories) * 100, 100);
 
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
      const storageKey = `meals_${today}`;
      
      // 古いデータをクリア（過去3日より古いデータを削除）
      clearOldMealData();
      
      const savedMeals = localStorage.getItem(storageKey);
      
      if (savedMeals) {
        const parsedMeals = JSON.parse(savedMeals);
        setMeals(parsedMeals);
        setShowMeals(true);
        console.log('保存された献立データを復元しました:', parsedMeals);
      }
    } catch (error) {
      console.error('献立データの復元エラー:', error);
    }
  };

  // localStorageに献立データを保存する関数
  const saveMealsToStorage = (mealsData: MealData[]) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `meals_${today}`;
      localStorage.setItem(storageKey, JSON.stringify(mealsData));
      console.log('献立データをlocalStorageに保存しました');
    } catch (error) {
      console.error('献立データの保存エラー:', error);
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
        if (key && key.startsWith('meals_')) {
          const dateStr = key.replace('meals_', '');
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
      
      console.log('Meal Page - Cognito User ID:', userInfo.userId);

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

  // Bedrock AIの返答をMealData[]に変換する関数
  function parseAISuggestion(suggestion: string): MealData[] {
    try {
      const jsonMatch = suggestion.match(/```\s*JSON\s*\n([\s\S]*?)\n```/) || suggestion.match(/{[\s\S]*}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const data = JSON.parse(jsonStr);
        if (data.meals && Array.isArray(data.meals)) {
          return data.meals.map((meal: any) => {
            // dishesが配列でない場合の処理
            let dishes: string[] = [];
            if (Array.isArray(meal.dishes)) {
              dishes = meal.dishes.map((dish: any) => 
                typeof dish === 'string' ? dish : dish.dish || dish.name || String(dish)
              );
            } else if (meal.dishes) {
              // オブジェクトの場合は文字列に変換
              dishes = [String(meal.dishes)];
            }
            
            return {
              mealType: meal.mealType || '食事',
              calories: meal.calories || 0,
              dishes: dishes,
              color: "#FF8C42"
            };
          });
        }
      }
    } catch (error) {
      console.error('JSON parse error:', error);
    }
    return [];
  }

  // ユーザープロファイル取得または作成
  const getUserProfile = async (userId = cognitoUserId) => {
    try {
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: userId } }
      });
      
      if (profiles.length > 0) {
        return profiles[0];
      }
      
      // プロファイルが存在しない場合は基本プロファイルを作成
      console.log('ユーザープロファイルが見つからないため、基本プロファイルを作成します');
      const newProfile = await client.models.UserProfile.create({
        userId: userId,
        name: "ユーザー",
        height: 170.0,
        weight: 65.0,
        age: 30,
        gender: "未設定",
        favoriteFoods: "和食",
        allergies: "なし",
        dislikedFoods: "",
        exerciseFrequency: "週1-2回",
        exerciseFrequencyOther: ""
      });
      
      console.log('基本プロファイルを作成しました:', newProfile);
      return newProfile.data;
      
    } catch (error) {
      console.error('ユーザープロファイル取得/作成エラー:', error);
      return null;
    }
  };

  // 献立を保存する関数
  const saveMealPlan = async () => {
    // AI献立提案データまたは既存のmealsデータをチェック
    if (!parsedKondate && (!meals || meals.length === 0)) {
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

      // 各食事の内容を準備
      const mealData: any = {
        breakfast: '',
        lunch: '',
        dinner: ''
      };

      // AI献立提案データがある場合はそれを使用
      if (parsedKondate && parsedKondate.meals) {
        parsedKondate.meals.forEach((meal) => {
          // メニュー名と食材を組み合わせて保存
          let dishText = meal.menu;
          if (meal.ingredients.length > 0) {
            dishText += ` (${meal.ingredients.slice(0, 3).join(', ')})`;
          }
          
          switch (meal.mealType) {
            case '朝食':
              mealData.breakfast = dishText;
              break;
            case '昼食':
              mealData.lunch = dishText;
              break;
            case '夕食':
              mealData.dinner = dishText;
              break;
          }
        });
      } else if (meals) {
        // 既存のmealsデータを使用
        meals.forEach((meal) => {
          const dishesText = meal.dishes.join(', ');
          
          switch (meal.mealType) {
            case '朝食':
              mealData.breakfast = dishesText;
              break;
            case '昼食':
              mealData.lunch = dishesText;
              break;
            case '夕食':
              mealData.dinner = dishesText;
              break;
          }
        });
      }

      console.log('献立保存開始:', { userId: currentUserId, date: today, mealData });

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
        const updateData: any = { id: existingRecords[0].id };
        
        // 空でない食事データのみを更新
        if (mealData.breakfast) updateData.breakfast = mealData.breakfast;
        if (mealData.lunch) updateData.lunch = mealData.lunch;
        if (mealData.dinner) updateData.dinner = mealData.dinner;
        
        await client.models.DailyRecord.update(updateData);
        console.log('既存の記録を更新しました:', updateData);
      } else {
        // 新規記録を作成
        const newRecord = {
          userId: currentUserId,
          date: today,
          ...mealData
        };
        
        await client.models.DailyRecord.create(newRecord);
        console.log('新規記録を作成しました:', newRecord);
      }

      alert('献立を保存しました！');
      
    } catch (error) {
      console.error('献立保存エラー:', error);
      alert('献立の保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 献立再生成ボタン押下時の処理
  const generateMeals = async () => {
    setLoading(true);
    setShowMeals(false);
    try {
      // ユーザープロファイル取得
      const userProfile = await getUserProfile();
      
      // 推奨カロリーを計算
      const recommendedCalories = userProfile ? calculateTDEE(userProfile) : 2000;
      
      const requestBody = {
        userId: cognitoUserId,
        targetCalories: recommendedCalories,
        timestamp: new Date().toISOString()
      };
      
      console.log('送信データ:', requestBody);
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      console.log('APIレスポンス:', data);
      
      console.log('Response status:', response.status);
      console.log('Response data:', data);
      
          console.log('Full API response:', data); // デバッグ用
          
          // AI質問内容とレスポンスをコンソールに表示
          if (data.debug) {
            console.log('🤖 AI PROMPT SENT:', data.debug.promptSent);
            console.log('📝 AI RESPONSE:', data.debug.aiResponse);
            console.log('📊 MEAL SOURCE:', data.debug.mealSource || (data.debug.usingFallback ? 'FALLBACK' : 'AI_GENERATED'));
            console.log('🔍 DEBUG INFO:', data.debug);
            
            // 献立ソースによる警告表示
            if (data.debug.usingFallback || data.debug.mealSource === 'FALLBACK') {
              console.warn('⚠️ NOTICE: Using fallback meals (AI generation failed)');
              alert('⚠️ 注意: AIによる献立生成に失敗しました。テンプレート献立を表示しています。');
            } else {
              console.log('✅ SUCCESS: Using AI-generated meals');
            }
            
            setDebugInfo(data.debug); // デバッグ情報を状態に保存
          }      if (response.ok) {
        // データ構造を詳細にチェック
        console.log('data.meals:', data.meals);
        console.log('data.meals type:', typeof data.meals);
        console.log('data.meals isArray:', Array.isArray(data.meals));
        
        if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
          console.log('Processing meals data:', data.meals);
          // 料理名の詳細チェック
          data.meals.forEach((meal: any, index: number) => {
            console.log(`Meal ${index} dishes:`, meal.dishes);
            if (meal.dishes) {
              meal.dishes.forEach((dish: any, dishIndex: number) => {
                console.log(`  Dish ${dishIndex}: "${dish}" (type: ${typeof dish})`);
              });
            }
          });
          
          // データを正規化
          const normalizedMeals = data.meals.map((meal: any, index: number) => {
            console.log(`Processing meal ${index}:`, meal);
            
            // dishesの処理を強化
            let dishes: string[] = [];
            if (Array.isArray(meal.dishes)) {
              dishes = meal.dishes
                .map((dish: any) => {
                  if (typeof dish === 'string') {
                    return dish.trim();
                  } else if (dish && typeof dish === 'object') {
                    return dish.dish || dish.name || String(dish);
                  } else {
                    return String(dish);
                  }
                })
                .filter((dish: string) => dish && dish.length > 0);
            } else if (meal.dishes) {
              dishes = [String(meal.dishes)];
            }
            
            // 抽象的な名前を検出して警告
            const abstractNames = ['主菜', '副菜', '汁物', '主食'];
            const hasAbstractNames = dishes.some(dish => abstractNames.includes(dish));
            if (hasAbstractNames) {
              console.warn(`⚠️ Abstract dish names found in meal ${index}:`, dishes);
            }
            
            return {
              mealType: meal.mealType || '食事',
              calories: meal.calories || 0,
              dishes: dishes.length > 0 ? dishes : ['和食'],
              color: meal.color || "#FF8C42"
            };
          });
          
          console.log('Normalized meals:', normalizedMeals);
          setMeals(normalizedMeals);
          setShowMeals(true);
          saveMealsToStorage(normalizedMeals); // localStorageに保存
        }
        else if (data.suggestion) {
          console.log('Parsing suggestion:', data.suggestion);
          const newMeals = parseAISuggestion(data.suggestion);
          if (newMeals.length > 0) {
            setMeals(newMeals);
            setShowMeals(true);
            saveMealsToStorage(newMeals); // localStorageに保存
          } else {
            console.error('パースされた献立が空です');
            alert('AIからの献立提案が取得できませんでした。もう一度お試しください。');
          }
        }
        else {
          console.error('レスポンスに献立データがありません:', data);
          console.log('Available data keys:', Object.keys(data));
          
          // 空の配列が返された場合の処理
          if (data.meals && Array.isArray(data.meals) && data.meals.length === 0) {
            console.log('Empty meals array received');
            alert('AIからの献立提案が空でした。もう一度お試しください。');
          } else {
            alert('AIからの献立提案が取得できませんでした。もう一度お試しください。');
          }
        }
      } else {
        console.error('APIエラー - Status:', response.status, 'Data:', data);
        alert('APIエラーが発生しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('献立生成エラー:', error);
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
          {/* ↓削除予定-------------------------------- */}
          {cognitoUserId && (
            <div className={styles.cognitoInfo}>
              <div className={styles.cognitoId}>CognitoID: {cognitoUserId}</div>
            </div>
          )}
          {/* ↑削除予定-------------------------------- */}
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
                <>
                  <span className={styles.spinner}></span>
                  AI献立作成中...
                </>
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
          
          {parsedKondate && (
            <div className={styles.kondateResultContainer}>
              {/* 配慮したこと・健康アドバイスセクション */}
              <div className={styles.adviceSection}>
                {parsedKondate.considerations.length > 0 && (
                  <div className={styles.considerationsBox}>
                    <h3 className={styles.adviceTitle}>💡 配慮したこと</h3>
                    <ul className={styles.adviceList}>
                      {parsedKondate.considerations.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {parsedKondate.healthAdvice && (
                  <div className={styles.healthAdviceBox}>
                    <h3 className={styles.adviceTitle}>🏥 健康アドバイス</h3>
                    <p className={styles.adviceText}>{parsedKondate.healthAdvice}</p>
                  </div>
                )}
              </div>

              {/* 食事カードセクション */}
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
                        <div className={styles.aiDishImage}>
                          <div className={styles.aiImagePlaceholder}>
                            <span>🍽️</span>
                          </div>
                        </div>
                        
                        <div className={styles.aiMealDetails}>
                          <div className={styles.aiMenuItem}>
                            <strong>メニュー:</strong> {meal.menu}
                          </div>
                          
                          <div className={styles.aiNutritionInfo}>
                            <strong>栄養:</strong> タンパク質{meal.nutrition.protein}g、
                            炭水化物{meal.nutrition.carbs}g、脂質{meal.nutrition.fat}g
                          </div>
                          
                          {meal.ingredients.length > 0 && (
                            <div className={styles.aiIngredients}>
                              <strong>食材:</strong>
                              <ul>
                                {meal.ingredients.map((ingredient, idx) => (
                                  <li key={idx}>{ingredient}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {meal.cookingSteps && (
                            <div className={styles.aiCookingSteps}>
                              <strong>調理手順:</strong> {meal.cookingSteps}
                            </div>
                          )}
                          
                          {meal.nutritionPoint && (
                            <div className={styles.aiNutritionPoint}>
                              <strong>栄養ポイント:</strong> {meal.nutritionPoint}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      {/*ここまで*/}
      </div>
    </BioryLayout>
  );
}
 