"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import "./home.css";

Amplify.configure(outputs);
const client = generateClient<Schema>();

interface NutritionData {
  calories: number;
  protein: { value: number; percentage: number };
  fat: { value: number; percentage: number };
  carbs: { value: number; percentage: number };
}

interface MealData {
  breakfast: string;
  lunch: string;
  dinner: string;
}

interface HealthData {
  condition: string;
  mood: string;
  weight: number;
}

export default function HomePage() {
  const [currentDate, setCurrentDate] = useState("");
  const [userName] = useState("○○");
  const [nutritionData, setNutritionData] = useState<NutritionData>({
    calories: 0,
    protein: { value: 0, percentage: 0 },
    fat: { value: 0, percentage: 0 },
    carbs: { value: 0, percentage: 0 },
  });
  const [mealData] = useState<MealData>({
    breakfast: "食パン・コーヒー",
    lunch: "ー",
    dinner: "ー",
  });
  const [healthData] = useState<HealthData>({
    condition: "とても良い",
    mood: "ポジティブ",
    weight: 0,
  });

  // データベースから栄養情報を取得する関数
  async function fetchNutritionData() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
      const { data: nutritions } = await client.models.Nutrition.list({
        filter: {
          date: { eq: today },
          userId: { eq: "user1" } // 仮のユーザーID
        }
      });

      if (nutritions && nutritions.length > 0) {
        const nutrition = nutritions[0];
        setNutritionData({
          calories: nutrition.calories || 0,
          protein: { value: nutrition.protein || 0, percentage: 0 },
          fat: { value: nutrition.fat || 0, percentage: 0 },
          carbs: { value: nutrition.carbs || 0, percentage: 0 },
        });
      } else {
        // データがない場合はサンプルデータを作成
        await createSampleNutritionData(today);
      }
    } catch (error) {
      console.error("栄養データの取得エラー:", error);
    }
  }

  // サンプルデータを作成する関数
  async function createSampleNutritionData(date: string) {
    try {
      await client.models.Nutrition.create({
        userId: "user1",
        date: date,
        calories: 1200,
        protein: 50.0,
        fat: 30.0,
        carbs: 150.0,
      });
      // 作成後に再取得
      setNutritionData({
        calories: 1200,
        protein: { value: 50.0, percentage: 20 },
        fat: { value: 30.0, percentage: 25 },
        carbs: { value: 150.0, percentage: 55 },
      });
    } catch (error) {
      console.error("サンプルデータの作成エラー:", error);
    }
  }

  useEffect(() => {
    // 日本時間で今日の日付を取得
    const today = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const todayJST = new Date(today);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const month = todayJST.getMonth() + 1;
    const date = todayJST.getDate();
    const dayOfWeek = weekdays[todayJST.getDay()];
    setCurrentDate(`${month}/${date} (${dayOfWeek})`);

    // 栄養データを取得
    fetchNutritionData();
  }, []);

  const handleEditClick = () => {
    console.log("編集ボタンがクリックされました");
  };

  const handleNavClick = (section: string) => {
    console.log(`${section}がクリックされました`);
  };

  return (
    <div className="home-container">
      {/* ヘッダー */}
      <header className="header">
        <h1 className="logo">biory</h1>
      </header>

      {/* 日付・挨拶セクション */}
      <section className="date-greeting">
        <div className="date">{currentDate}</div>
        <div className="greeting">こんにちは！{userName}さん</div>
      </section>

      {/* 栄養情報セクション */}
      <section className="nutrition-section">
        <div className="nutrition-header">
          <span className="nutrition-label">カロリー</span>
          <span className="calories-value">{nutritionData.calories} kcal</span>
        </div>
        <div className="nutrition-details">
          <div className="nutrition-row">
            <span className="nutrition-type">P（タンパク質）</span>
            <span className="nutrition-values">{nutritionData.protein.value}g　{nutritionData.protein.percentage}%</span>
          </div>
          <div className="nutrition-row">
            <span className="nutrition-type">F（脂質）</span>
            <span className="nutrition-values">{nutritionData.fat.value}g　{nutritionData.fat.percentage}%</span>
          </div>
          <div className="nutrition-row">
            <span className="nutrition-type">C（炭水化物）</span>
            <span className="nutrition-values">{nutritionData.carbs.value}g　{nutritionData.carbs.percentage}%</span>
          </div>
        </div>
      </section>

      {/* 食事記録セクション */}
      <section className="meal-section">
        <h3 className="section-title">▷本日の食事</h3>
        <div className="meal-list">
          <div className="meal-row">
            <span className="meal-time">朝</span>
            <span className="meal-separator">：</span>
            <span className="meal-content">{mealData.breakfast}</span>
          </div>
          <div className="meal-row">
            <span className="meal-time">昼</span>
            <span className="meal-separator">：</span>
            <span className="meal-content">{mealData.lunch}</span>
          </div>
          <div className="meal-row">
            <span className="meal-time">夜</span>
            <span className="meal-separator">：</span>
            <span className="meal-content">{mealData.dinner}</span>
          </div>
        </div>
      </section>

      {/* 体調管理セクション */}
      <section className="health-section">
        <div className="health-row">
          <span className="health-label">体調：</span>
          <span className="health-value">{healthData.condition}</span>
          <span className="health-emoji">😊</span>
        </div>
        <div className="health-row">
          <span className="health-label">気分：</span>
          <span className="health-value">{healthData.mood}</span>
        </div>
        <div className="health-row">
          <span className="health-label">体重：</span>
          <span className="health-value">―.―kg</span>
        </div>
      </section>

      {/* 編集ボタン */}
      <button className="edit-button" onClick={handleEditClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      {/* ボトムナビゲーション */}
      <nav className="bottom-nav">
        <button 
          className="nav-item active" 
          onClick={() => handleNavClick("home")}
        >
          <div className="nav-icon home-icon"></div>
        </button>
        <button 
          className="nav-item" 
          onClick={() => handleNavClick("meal")}
        >
          <div className="nav-icon meal-icon"></div>
        </button>
        <button 
          className="nav-item" 
          onClick={() => handleNavClick("calendar")}
        >
          <div className="nav-icon calendar-icon"></div>
        </button>
        <button 
          className="nav-item" 
          onClick={() => handleNavClick("settings")}
        >
          <div className="nav-icon settings-icon"></div>
        </button>
      </nav>
    </div>
  );
}
