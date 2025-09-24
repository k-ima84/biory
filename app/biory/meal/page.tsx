"use client";
 
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { getCurrentUser } from "aws-amplify/auth";
import BioryLayout from "../components/BioryLayout";
import styles from "./meal.module.css";
 

const client = generateClient<Schema>();

const API_ENDPOINT = "https://5obkiuclsb.execute-api.ap-northeast-1.amazonaws.com/prod/meal-suggest";

interface MealData {
  mealType: string;
  calories: number;
  dishes: string[];
  color: string;
  imageUrl?: string;
}
 
export default function MealPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [meals, setMeals] = useState<MealData[]>([]); // 初期値は空

  // カロリー計算
  const currentCalories = meals.reduce((total, meal) => total + meal.calories, 0);
  const maxCalories = 2500; // 一日の推奨摂取カロリー
  const percentage = Math.min((currentCalories / maxCalories) * 100, 100);
 
  useEffect(() => {
    checkUser();
  }, []);
 
  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // ユーザーがログインしていない場合はログイン画面にリダイレクト
      window.location.href = "/biory/login";
    }
  }
 
  const getTodayDate = () => {
    const today = new Date();
    return today.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric'
    });
  };

  // Bedrock AIの返答をMealData[]に変換する関数
  function parseAISuggestion(suggestion: string): MealData[] {
    const mealTypes = ["朝食", "昼食", "夕食"];
    const colors = ["#FF8C42", "#4CAF50", "#2196F3"];
    return suggestion.split("\n").map((line, i) => {
      const match = line.match(/(朝食|昼食|夕食):(.+)/);
      if (match) {
        const dishes = match[2].split(/[、,・\s]+/).filter(Boolean);
        return {
          mealType: match[1],
          calories: 0, // 必要ならAI返答から抽出
          dishes,
          color: colors[i] || "#ccc"
        };
      }
      // パース失敗時はデフォルト
      return {
        mealType: mealTypes[i] || "食事",
        calories: 0,
        dishes: [line],
        color: colors[i] || "#ccc"
      };
    });
  }

  // 献立再生成ボタン押下時の処理
  const generateMeals = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: {},
          dietaryRestrictions: [],
          targetCalories: 2000
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.suggestion) {
          const newMeals = parseAISuggestion(data.suggestion);
          setMeals(newMeals);
        } else {
          console.error('No suggestion in response');
        }
      } else {
        console.error('Failed to generate meals');
      }
    } catch (error) {
      console.error('Error generating meals:', error);
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
 