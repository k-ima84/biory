"use client";
 
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import BioryLayout from "../components/BioryLayout";
import styles from "./meal.module.css";
import { fetchCognitoUserInfo } from '../components/function';
import { useRouter } from "next/navigation";

const client = generateClient<Schema>();

const API_ENDPOINT = "https://5obkiuclsb.execute-api.ap-northeast-1.amazonaws.com/prod/meal/suggestion";

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
    loadUserInfo();

    // ページフォーカス時にユーザー情報を再取得（セッション維持のため）
    const handleFocus = () => {
      loadUserInfo();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);
 


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
      
      if (response.ok) {
        // データ構造を詳細にチェック
        console.log('data.meals:', data.meals);
        console.log('data.meals type:', typeof data.meals);
        console.log('data.meals isArray:', Array.isArray(data.meals));
        
        if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
          console.log('Processing meals data:', data.meals);
          // データを正規化
          const normalizedMeals = data.meals.map((meal: any, index: number) => {
            console.log(`Processing meal ${index}:`, meal);
            return {
              mealType: meal.mealType || '食事',
              calories: meal.calories || 0,
              dishes: Array.isArray(meal.dishes) 
                ? meal.dishes.map((dish: any) => typeof dish === 'string' ? dish : dish.dish || dish.name || String(dish))
                : meal.dishes ? [String(meal.dishes)] : [],
              color: meal.color || "#FF8C42"
            };
          });
          
          console.log('Normalized meals:', normalizedMeals);
          setMeals(normalizedMeals);
          setShowMeals(true);
        }
        else if (data.suggestion) {
          console.log('Parsing suggestion:', data.suggestion);
          const newMeals = parseAISuggestion(data.suggestion);
          if (newMeals.length > 0) {
            setMeals(newMeals);
            setShowMeals(true);
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
            <button className={styles.saveButton}>
              💾 献立を保存
            </button>
          </div>
        </div>
      </div>
    </BioryLayout>
  );
}
 