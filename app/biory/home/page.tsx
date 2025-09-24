"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";
import type { Schema } from "../../../amplify/data/resource";
import BioryLayout from "../components/BioryLayout";
import "./home.css";
import { getCognitoUserId, fetchCognitoUserInfo } from '../components/function';


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
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState("");
  const [userName, setUserName] = useState("");
  const [cognitoUserId, setCognitoUserId] = useState("");
  const [nutritionData, setNutritionData] = useState<NutritionData>({
    calories: 0,
    protein: { value: 0, percentage: 0 },
    fat: { value: 0, percentage: 0 },
    carbs: { value: 0, percentage: 0 },
  });

  const [mealData, setMealData] = useState<MealData>({
    breakfast: "—",
    lunch: "—",
    dinner: "—",
  });

  const [healthData, setHealthData] = useState<HealthData>({
    condition: "とても良い 😊",
    mood: "ポジティブ",
    weight: 0,
  });

  // 日本語の曜日配列
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  // 現在の日付を取得して設定する関数
  const updateCurrentDate = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 0-11 → 1-12
    const date = now.getDate();
    const dayOfWeek = dayNames[now.getDay()];
    const formattedDate = `${month}/${date} (${dayOfWeek})`;
    setCurrentDate(formattedDate);
  };

  // Cognitoユーザー情報を取得する関数
  const fetchCognitoUserData = async () => {
    try {
      const userInfo = await fetchCognitoUserInfo();
      setCognitoUserId(userInfo.userId);
      
      console.log('Home - Cognito User Info:', {
        userId: userInfo.userId,
        email: userInfo.email
      });
    } catch (error) {
      console.error('ホーム画面でのCognitoユーザー情報取得エラー:', error);
      // 認証エラーの場合はログイン画面へリダイレクト
      router.push("/biory/login");
    }
  };

  // ユーザープロフィールを取得する関数
  const fetchUserProfile = async () => {
    if (!cognitoUserId) {
      console.log('User ID not available yet');
      return;
    }

    try {
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: cognitoUserId } }
      });

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        // データベースに名前があればそれを使用
        setUserName(profile.name || "ユーザー");

        // Null合体演算子を使用してデフォルト値を設定
        setHealthData(prev => ({
          ...prev,
          weight: profile.weight ?? 0  // null または undefined の場合は 0
        }));
      } else {
        // 該当するUserProfileがない場合はデフォルト名を使用
        setUserName("ユーザー");
      }
    } catch (error) {
      console.error("ユーザープロフィール取得エラー:", error);
      setUserName("ゲスト");
    }
  };
 

  // 栄養データを取得する関数
  const fetchNutritionData = async (dateString: string) => {
    try {
      const { data: nutritions } = await client.models.Nutrition.list();
      const todayNutrition = nutritions?.find(n => n.date === dateString);

      if (todayNutrition) {
        setNutritionData({
          calories: todayNutrition.calories || 0,
          protein: { 
            value: todayNutrition.protein || 0, 
            percentage: Math.round(((todayNutrition.protein || 0) * 4 / (todayNutrition.calories || 1)) * 100)
          },
          fat: { 
            value: todayNutrition.fat || 0, 
            percentage: Math.round(((todayNutrition.fat || 0) * 9 / (todayNutrition.calories || 1)) * 100)
          },
          carbs: { 
            value: todayNutrition.carbs || 0, 
            percentage: Math.round(((todayNutrition.carbs || 0) * 4 / (todayNutrition.calories || 1)) * 100)
          },
        });
      }
    } catch (error) {
      console.error("栄養データ取得エラー:", error);
    }
  };

  // 食事データを取得する関数
  const fetchMealData = async (dateString: string) => {
    try {
      const { data: meals } = await client.models.Meal.list();
      const todayMeals = meals?.filter(m => m.date === dateString);

      const mealsByType = {
        breakfast: "—",
        lunch: "—",
        dinner: "—",
      };

      todayMeals?.forEach(meal => {
        if (meal.mealType === "breakfast") mealsByType.breakfast = meal.content || "—";
        if (meal.mealType === "lunch") mealsByType.lunch = meal.content || "—";
        if (meal.mealType === "dinner") mealsByType.dinner = meal.content || "—";
      });

      setMealData(mealsByType);
    } catch (error) {
      console.error("食事データ取得エラー:", error);
    }
  };

  // 挨拶メッセージを生成する関数
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 10) return "おはようございます！";
    if (hour < 17) return "こんにちは！";
    return "こんばんは！";
  };

  // データベースから今日のデータを取得するヘルパー関数
  const getCurrentDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  useEffect(() => {
    // 初期化処理
    updateCurrentDate();
    fetchCognitoUserData();
  }, []);

  // cognitoUserIdが取得できた後にプロフィールを取得
  useEffect(() => {
    if (cognitoUserId) {
      fetchUserProfile();
    }
  }, [cognitoUserId]);

  useEffect(() => {
    // 今日の日付文字列を取得してデータを取得
    const dateString = getCurrentDateString();
    fetchNutritionData(dateString);
    fetchMealData(dateString);

    // 1分ごとに日付を更新（日付が変わった場合のため）
    const dateUpdateInterval = setInterval(() => {
      const newDateString = getCurrentDateString();
      updateCurrentDate();

      // 日付が変わった場合はデータも再取得
      if (newDateString !== dateString) {
        fetchNutritionData(newDateString);
        fetchMealData(newDateString);
      }
    }, 60000); // 1分間隔

    return () => {
      clearInterval(dateUpdateInterval);
    };
  }, []);

  const handleEditClick = () => {
    console.log("編集ボタンがクリックされました");
  };

  const handleNavClick = (section: string) => {
    console.log(`${section}がクリックされました`);
    if (section === "settings") {
      router.push("/biory/settings");
    }
  };

  return (
    <BioryLayout>
      {/* 日付・挨拶セクション */}
      <section className="date-greeting">
        <div className="date">{currentDate}</div>
        <div className="greeting">{getGreeting()} {userName}さん</div>
        {cognitoUserId && (
          <div className="cognito-info">
            <div className="cognito-id">CognitoID: {cognitoUserId}</div>
          </div>
        )}
      </section>

      {/* 栄養情報セクション */}
      <section className="nutrition-section">
        <h3 className="section-title-highlight">食事バランス</h3>
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
        <h3 className="section-title-highlight">本日の食事</h3>
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
        <h3 className="section-title-highlight">本日の調子</h3>
        <div className="health-content">
          <div className="health-row">
            <span className="health-label">体調：</span>
            <span className="health-value">{healthData.condition}</span>
            <span className="health-emoji"></span>
          </div>
          <div className="health-row">
            <span className="health-label">気分：</span>
            <span className="health-value">{healthData.mood}</span>
          </div>
          <div className="health-row">
            <span className="health-label">体重：</span>
            <span className="health-value">―.―kg</span>
          </div>
        </div>
      </section>

      {/* 編集ボタン */}
      <button className="edit-button" onClick={handleEditClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </BioryLayout>
  );
}
 