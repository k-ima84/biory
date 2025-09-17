"use client";
 
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { getCurrentUser } from "aws-amplify/auth";
import BioryLayout from "../components/BioryLayout";
import styles from "./meal.module.css";
 
const client = generateClient<Schema>();
 
interface MealData {
  mealType: string;
  calories: number;
  dishes: string[];
  color: string;
  imageUrl?: string; // 画像URLを追加（オプション）
}
 
export default function MealPage() {
  const [user, setUser] = useState<any>(null);
  const [meals, setMeals] = useState<MealData[]>([
    {
      mealType: "朝食",
      calories: 550,
      dishes: [
        "納豆ごはん",
        "わかめと豆腐の味噌汁",
        "ゆで卵",
        "バナナ"
      ],
      color: "#FF8C42",
      imageUrl: "https://example.com/breakfast.jpg" // サンプル画像URL
    },
    {
      mealType: "昼食",
      calories: 600,
      dishes: [
        "ブロッコリー",
        "あさりのパスタ",
        "ほたてと野菜のサラダ",
        "カフェオレ（無糖）"
      ],
      color: "#FF8C42",
      imageUrl: "https://example.com/lunch.jpg" // サンプル画像URL
    },
    {
      mealType: "夕食",
      calories: 800,
      dishes: [
        "照り焼きチキン",
        "マッシュルームのハンバーグ",
        "クレソンとにんじんの玉子炒め",
        "キャベツときゅうりのサラダ"
      ],
      color: "#FF8C42",
      imageUrl: "https://example.com/dinner.jpg" // サンプル画像URL
    }
  ]);

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
            <button className={styles.regenerateButton}>
              <span className={styles.buttonIcon}>↻</span>献立を生成！
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
 