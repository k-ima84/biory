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
  icon: string;
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
        "ぬて卵",
        "バナナ"
      ],
      color: "#FF8C42",
      icon: "🌅"
    },
    {
      mealType: "昼食",
      calories: 600,
      dishes: [
        "ブロッコリーと",
        "あさりのパスタ",
        "ほたてと野菜のサラダ",
        "カフェオレ（無糖）"
      ],
      color: "#4CAF50",
      icon: "☀️"
    },
    {
      mealType: "夕食",
      calories: 800,
      dishes: [
        "照り焼きチキン",
        "マッシュルームの",
        "ハンバーグ",
        "クレソンとにんじんの",
        "玉子炒め",
        "キャベツときゅうりのサラダ"
      ],
      color: "#2196F3",
      icon: "🌙"
    }
  ]);
 
  useEffect(() => {
    checkUser();
  }, []);
 
  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // ユーザーがログインしていない場合はログイン画面にリダイレクト
      window.location.href = "/login";
    }
  }
 
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric'
    });
  };
 
  return (
    <BioryLayout>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>明日の献立</h1>
          <p className={styles.date}>{getTomorrowDate()}</p>
        </header>
 
        <div className={styles.mealsContainer}>
          {meals.map((meal, index) => (
            <div key={index} className={styles.mealCard}>
              <div
                className={styles.mealHeader}
                style={{ backgroundColor: meal.color }}
              >
                <span className={styles.mealIcon}>{meal.icon}</span>
                <span className={styles.mealType}>{meal.mealType}</span>
                <span className={styles.calories}>{meal.calories} kcal</span>
              </div>
             
              <div className={styles.mealContent}>
                <div className={styles.dishImage}>
                  {/* 料理画像のプレースホルダー */}
                  <div className={styles.imagePlaceholder}>
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
 
        <div className={styles.totalCalories}>
          <span className={styles.totalLabel}>合計カロリー</span>
          <span className={styles.totalValue}>
            {meals.reduce((total, meal) => total + meal.calories, 0)} kcal
          </span>
        </div>
 
        <div className={styles.actionButtons}>
          <button className={styles.regenerateButton}>
            🔄 献立を再生成
          </button>
          <button className={styles.saveButton}>
            💾 献立を保存
          </button>
        </div>
      </div>
    </BioryLayout>
  );
}