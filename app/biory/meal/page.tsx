"use client";
 
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";
import BioryLayout from "../components/BioryLayout";
import styles from "./meal.module.css";
import { fetchCognitoUserInfo } from '../components/function';
import { useRouter } from "next/navigation";
 
//Amplify.configure(outputs);

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
  

  // カロリー計算
  const currentCalories = meals.reduce((total, meal) => total + meal.calories, 0);
  const maxCalories = 2500; // 一日の推奨摂取カロリー
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
          return data.meals.map((meal: any) => ({
            mealType: meal.mealType,
            calories: meal.calories || 0,
            dishes: Array.isArray(meal.dishes) ? meal.dishes : [],
            color: "#FF8C42"
          }));
        }
      }
    } catch (error) {
      console.error('JSON parse error:', error);
    }
    return [];
  }

  // ユーザープロファイル取得
  const getUserProfile = async () => {
    try {
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: cognitoUserId } }
      });
      return profiles[0] || null;
    } catch (error) {
      console.error('ユーザープロファイル取得エラー:', error);
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
      
      const requestBody = {
        userId: cognitoUserId,
        targetCalories: 2000,
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
      
      if (response.ok) {
        if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
          console.log('Setting meals:', data.meals);
          setMeals(data.meals);
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
          }
        }
        else {
          console.error('レスポンスに献立データがありません:', data);
        }
      } else {
        console.error('APIエラー - Status:', response.status, 'Data:', data);
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
            {meals.map((meal, index) => (
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
                  {meal.dishes.map((dish, dishIndex) => (
                    <div key={dishIndex} className={styles.dishItem}>
                      {dish}
                    </div>
                  ))}
                </div>
                </div>
              </div>
            ))}
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
 