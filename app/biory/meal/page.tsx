"use client";
 
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import BioryLayout from "../components/BioryLayout";
import styles from "./meal.module.css";
import { fetchCognitoUserInfo } from '../components/function';
import { useRouter } from "next/navigation";
import { getMealSuggestion } from "@/lib/bedrockClient";

const client = generateClient<Schema>();

//const API_ENDPOINT = "https://5obkiuclsb.execute-api.ap-northeast-1.amazonaws.com/prod/meal/suggestion";
// 注意: API Gateway経由ではなく、直接Bedrockを呼び出すため、以下のエンドポイントは使用しません
//const API_ENDPOINT = "https://u1a3a1qi9h.execute-api.ap-northeast-1.amazonaws.com/prod/meal/suggestion";

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

  // カロリー計算
  const currentCalories = meals.reduce((total, meal) => total + meal.calories, 0);
  const maxCalories = userProfile ? calculateTDEE(userProfile) : 2000; // TDEEに基づく推奨カロリー
  const percentage = Math.min((currentCalories / maxCalories) * 100, 100);
 
  useEffect(() => {
    // 認証状態を確認してからユーザー情報を読み込む
    const checkAuthAndLoad = async () => {
      try {
        console.log('🔍 Checking authentication status...');
        const session = await fetchAuthSession();
        console.log('🔍 Session:', {
          hasTokens: !!session.tokens,
          hasCredentials: !!session.credentials,
          hasIdentityId: !!session.identityId,
        });

        if (!session.tokens) {
          console.warn('⚠️ No authentication tokens found, redirecting to login...');
          router.push("/biory/login");
          return;
        }

        console.log('✅ User is authenticated, loading user info...');
        await loadUserInfo();
        loadMealsFromStorage(); // 保存された献立データを復元
      } catch (error) {
        console.error('❌ Auth check failed:', error);
        router.push("/biory/login");
      }
    };

    checkAuthAndLoad();

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
      console.log('🔍 Meal Page - Loading user info...');
      
      // まず認証状態を確認
      const session = await fetchAuthSession();
      if (!session.tokens) {
        console.warn('⚠️ No tokens in session, user not authenticated');
        throw new Error('User not authenticated');
      }
      
      const userInfo = await fetchCognitoUserInfo();
      setCognitoUserId(userInfo.userId);
      
      console.log('✅ Meal Page - Cognito User ID:', userInfo.userId);

      // ユーザープロファイルを取得
      const profile = await getUserProfile(userInfo.userId);
      setUserProfile(profile);
      console.log('✅ Meal Page - User profile loaded:', profile);

    } catch (error) {
      console.error('❌ Meal画面でのCognitoユーザー情報取得エラー:', error);
      const errorObj = error as any;
      console.error('Error details:', {
        name: errorObj?.name,
        message: errorObj?.message,
        stack: errorObj?.stack
      });
      
      // 認証エラーの場合はログイン画面へリダイレクト
      if (errorObj?.name === 'UserUnAuthenticatedException' || 
          errorObj?.message?.includes('not authenticated') ||
          errorObj?.message?.includes('User not authenticated')) {
        console.log('🔄 Redirecting to login due to auth error...');
        router.push("/biory/login");
      } else {
        // その他のエラーの場合は、エラーログを出すがリダイレクトしない
        console.warn('⚠️ Non-auth error occurred, staying on page');
      }
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
    if (!meals || meals.length === 0) {
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

      console.log('献立保存開始:', { userId: currentUserId, date: today, meals });

      // 既存の記録があるかチェック
      const { data: existingRecords } = await client.models.DailyRecord.list({
        filter: {
          and: [
            { userId: { eq: currentUserId } },
            { date: { eq: today } }
          ]
        }
      });

      // 各食事の内容を準備（カロリー情報は含めない）
      const mealData: any = {
        breakfast: '',
        lunch: '',
        dinner: ''
      };

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

  // 献立再生成ボタン押下時の処理（Bedrock直接呼び出し版）
  const generateMeals = async () => {
    setLoading(true);
    setShowMeals(false);
    try {
      // ユーザープロファイル取得
      const userProfile = await getUserProfile();
      
      // 推奨カロリーを計算
      const recommendedCalories = userProfile ? calculateTDEE(userProfile) : 2000;
      
      console.log('🚀 献立生成開始（Bedrock直接呼び出し）');
      console.log('Target calories:', recommendedCalories);
      console.log('User profile:', userProfile);
      
      // Bedrock APIを直接呼び出し（API Gateway、Lambdaを経由しない）
      const result = await getMealSuggestion(
        {
          allergies: userProfile?.allergies || undefined,
          gender: userProfile?.gender || undefined,
          weight: userProfile?.weight || undefined,
          height: userProfile?.height || undefined,
          age: userProfile?.age || undefined,
          exerciseFrequency: userProfile?.exerciseFrequency || undefined,
        },
        recommendedCalories
      );
      
      console.log('✅ Bedrock result:', result);
      
      // AI質問内容とレスポンスをコンソールに表示
      if (result.debug) {
        console.log('🤖 AI PROMPT SENT:', result.debug.promptSent);
        console.log('📝 AI RESPONSE:', result.debug.aiResponse);
        console.log('📊 MEAL SOURCE:', result.debug.mealSource);
        console.log('🔍 DEBUG INFO:', result.debug);
        
        // 献立ソースによる警告表示
        if (result.debug.usingFallback || result.debug.mealSource === 'FALLBACK') {
          console.warn('⚠️ NOTICE: Using fallback meals (AI generation failed)');
          alert('⚠️ 注意: AIによる献立生成に失敗しました。テンプレート献立を表示しています。');
        } else {
          console.log('✅ SUCCESS: Using AI-generated meals');
        }
        
        setDebugInfo(result.debug); // デバッグ情報を状態に保存
      }
      
      // 献立データがある場合
      if (result.meals && Array.isArray(result.meals) && result.meals.length > 0) {
        console.log('Processing meals data:', result.meals);
        
        // データを正規化（既にbedrockClient.tsで正規化されているが、念のため追加チェック）
        const normalizedMeals = result.meals.map((meal: any, index: number) => {
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
      } else {
        console.error('献立データがありません');
        alert('献立の生成に失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('献立生成エラー:', error);
      alert('献立生成中にエラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
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
 
        {showMeals && (
          <div className={styles.mealsContainer}>
            {meals.map((meal, index) => {
              console.log(`Meal ${index}:`, meal, 'dishes type:', typeof meal.dishes, 'is array:', Array.isArray(meal.dishes));
              return (
              <div key={index} className={styles.mealCard}>
              <div
                className={styles.mealHeader}
                style={{ backgroundColor: meal.color }}
              >
                <span className={styles.mealType}>{meal.mealType}</span>
                <span className={styles.calories}>{meal.calories} kcal</span>
              </div>
             
              <div className={styles.mealContent}>
                <div className={styles.dishImage}>
                  {/* 料理画像の表示 */}
                  {meal.imageUrl ? (
                    <img 
                      src={meal.imageUrl} 
                      alt={`${meal.mealType}の料理`}
                      className={styles.actualImage}
                      onError={(e) => {
                        // 画像読み込みエラー時はプレースホルダーを表示
                        e.currentTarget.style.display = 'none';
                        const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                        if (nextElement) {
                          nextElement.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className={styles.imagePlaceholder}
                    style={{ display: meal.imageUrl ? 'none' : 'flex' }}
                  >
                    <span>🍽️</span>
                  </div>
                </div>
               
                <div className={styles.dishList}>
                  {Array.isArray(meal.dishes) ? (
                    meal.dishes.map((dish, dishIndex) => (
                      <div key={dishIndex} className={styles.dishItem}>
                        {typeof dish === 'string' ? dish : (dish as any).dish || (dish as any).name || JSON.stringify(dish)}
                      </div>
                    ))
                  ) : (
                    <div className={styles.dishItem}>
                      料理情報を取得中...
                    </div>
                  )}
                </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
 
        <div className={styles.bottomSection}>
          <div className={styles.caloriesMeter}>
            <div className={styles.circularProgress}>
              <svg className={styles.progressRing} width="150" height="150">
                {/* 背景の円 */}
                <circle
                  className={styles.progressRingBg}
                  stroke="#E5E5E5"
                  strokeWidth="10"
                  fill="transparent"
                  r="65"
                  cx="75"
                  cy="75"
                />
                {/* 進捗の円 */}
                <circle
                  className={styles.progressRingProgress}
                  stroke="#FF6B35"
                  strokeWidth="10"
                  fill="transparent"
                  r="65"
                  cx="75"
                  cy="75"
                  strokeDasharray={`${2 * Math.PI * 65}`}
                  strokeDashoffset={`${2 * Math.PI * 65 * (1 - percentage / 100)}`}
                  transform="rotate(0 75 75)"
                />
              </svg>
              <div className={styles.progressText}>
                <div className={styles.currentCalories}>{currentCalories}</div>
                <div className={styles.caloriesUnit}>kcal</div>
                <div className={styles.maxCalories}>/ {maxCalories} kcal</div>
              </div>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button className={styles.regenerateButton} onClick={generateMeals} disabled={loading}>
              <span className={styles.buttonIcon}>↻</span>
              {loading ? '生成中...' : '献立を生成！'}
            </button>
            <button 
              className={styles.saveButton}
              onClick={saveMealPlan}
              disabled={!meals || meals.length === 0 || loading}
            >
              💾 献立を保存
            </button>
          </div>

          {/* デバッグ情報表示エリア（開発時のみ） */}
          {debugInfo && (
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: debugInfo.usingFallback || debugInfo.mealSource === 'FALLBACK' ? '#ffebee' : '#e8f5e8',
              borderLeft: `5px solid ${debugInfo.usingFallback || debugInfo.mealSource === 'FALLBACK' ? '#ff5722' : '#4caf50'}`,
              borderRadius: '8px',
              fontSize: '12px',
              color: '#666'
            }}>
              <h4 style={{ 
                margin: '0 0 10px 0', 
                color: debugInfo.usingFallback || debugInfo.mealSource === 'FALLBACK' ? '#d32f2f' : '#2e7d32' 
              }}>
                {debugInfo.usingFallback || debugInfo.mealSource === 'FALLBACK' ? '⚠️ フォールバック献立' : '✅ AI生成献立'} - デバッグ情報
              </h4>
              <div><strong>献立ソース:</strong> <span style={{fontWeight: 'bold', color: debugInfo.usingFallback || debugInfo.mealSource === 'FALLBACK' ? '#d32f2f' : '#2e7d32'}}>{debugInfo.mealSource || (debugInfo.usingFallback ? 'FALLBACK' : 'AI_GENERATED')}</span></div>
              <div><strong>Bedrock状態:</strong> {debugInfo.bedrockStatus || 'UNKNOWN'}</div>
              <div><strong>AI応答長:</strong> {debugInfo.textLength || 0} 文字</div>
              <div><strong>プロンプト長:</strong> {debugInfo.promptLength || 0} 文字</div>
              <div><strong>献立数:</strong> {debugInfo.mealsCount || 0} 件</div>
              {debugInfo.aiResponse && (
                <details style={{ marginTop: '10px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>AI応答を表示</summary>
                  <pre style={{ 
                    backgroundColor: '#fff', 
                    padding: '10px', 
                    margin: '5px 0', 
                    borderRadius: '4px',
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}>
                    {debugInfo.aiResponse}
                  </pre>
                </details>
              )}
              {debugInfo.promptSent && (
                <details style={{ marginTop: '10px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>AIへの質問を表示</summary>
                  <pre style={{ 
                    backgroundColor: '#fff', 
                    padding: '10px', 
                    margin: '5px 0', 
                    borderRadius: '4px',
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '300px'
                  }}>
                    {debugInfo.promptSent}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </BioryLayout>
  );
}
 