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
  const [userProfile, setUserProfile] = useState<any>(null); // ユーザープロファイル
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
    condition: "今日の体調を入力しよう 📝",
    mood: "今日の気分を入力しよう 💭",
    weight: 0,
  });

  // 「本日の調子」編集機能用のstate
  const [isHealthEditMode, setIsHealthEditMode] = useState(false);
  const [healthEditData, setHealthEditData] = useState<HealthData>({
    condition: "今日の体調を入力しよう 📝",
    mood: "今日の気分を入力しよう 💭",
    weight: 0,
  });

  // 体重入力のエラー状態
  const [weightError, setWeightError] = useState<string>("");

  // 「本日の食事」編集機能用のstate
  const [isMealEditMode, setIsMealEditMode] = useState(false);
  const [mealEditData, setMealEditData] = useState<MealData>({
    breakfast: "—",
    lunch: "—",
    dinner: "—",
  });

  // 栄養価計算中フラグ
  const [isCalculatingNutrition, setIsCalculatingNutrition] = useState(false);

  // 初期データロード中フラグ
  const [isLoading, setIsLoading] = useState(true);

  // 日本語の曜日配列
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

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
      case "週1〜3回の運動":
        return 1.375;
      case "週3〜5回の運動":
        return 1.55;
      case "週6〜7回の運動":
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

  // 推奨カロリーを計算
  const recommendedCalories = userProfile ? calculateTDEE(userProfile) : 2000;

  // 目標PFCバランスを計算（推奨カロリーから算出）
  const calculateTargetPFC = (totalCalories: number) => {
    // 理想的なPFCバランス比率
    const proteinRatio = 0.15; // 15% (13-20%の中央値)
    const fatRatio = 0.25; // 25% (20-30%の中央値)
    const carbsRatio = 0.60; // 60% (50-65%の中央値)

    return {
      protein: Math.round((totalCalories * proteinRatio / 4) * 10) / 10, // タンパク質 (4kcal/g)
      fat: Math.round((totalCalories * fatRatio / 9) * 10) / 10, // 脂質 (9kcal/g)
      carbs: Math.round((totalCalories * carbsRatio / 4) * 10) / 10, // 炭水化物 (4kcal/g)
    };
  };

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
        // ユーザープロファイルを設定
        setUserProfile(profile);
        // データベースに名前があればそれを使用
        setUserName(profile.name || "ユーザー");

        // UserProfileから体重を取得してhealthDataに設定
        setHealthData(prev => ({
          ...prev,
          weight: profile.weight ?? 0  // null または undefined の場合は 0
        }));
      } else {
        // 該当するUserProfileがない場合はデフォルト名を使用
        setUserName("ユーザー");

        setHealthData(prev => ({
          ...prev,
          weight: 0
        }));

      }
    } catch (error) {
      console.error("ユーザープロフィール取得エラー:", error);
      setUserName("ゲスト");

      setHealthData(prev => ({
        ...prev,
        weight: 0
      }));

    }
  };

  // DailyRecordから健康データを取得する関数（体重以外）
  const fetchHealthDataFromDailyRecord = async (dateString: string) => {
    try {
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      // 健康データのレコードを検索
      const todayHealthRecord = dailyRecords?.find(record => 
        record.userId === cognitoUserId && record.date === dateString
      );

      if (todayHealthRecord) {
        setHealthData(prev => ({
          ...prev,
          condition: todayHealthRecord.condition || "今日の体調を入力しよう 📝",
          mood: todayHealthRecord.mood || "今日の気分を入力しよう 💭",
          // 体重はUserProfileから取得するのでここでは更新しない
        }));
      } else {
        // デフォルト値を設定（体重は除く）
        setHealthData(prev => ({
          ...prev,
          condition: "今日の体調を入力しよう 📝",
          mood: "今日の気分を入力しよう 💭",
        }));
      }
    } catch (error) {
      console.error("健康データ取得エラー:", error);
      // エラー時はデフォルト値を設定（体重は除く）
      setHealthData(prev => ({
        ...prev,
        condition: "今日の体調を入力しよう 📝",
        mood: "今日の気分を入力しよう 💭",
      }));
    }
  };
 



  // 栄養データを取得する関数（分割データから合算値を計算）
  const fetchNutritionData = async (dateString: string) => {
    try {
      if (!cognitoUserId) {
        console.log("cognitoUserId がまだ設定されていません");
        return;
      }

      // まずDailyRecordテーブルから今日のデータを取得
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      const todayRecord = dailyRecords?.find(record => 
        record.userId === cognitoUserId && record.date === dateString
      );

      // 目標PFCを計算
      const targetPFC = calculateTargetPFC(recommendedCalories);
      console.log("目標PFC:", targetPFC);

      if (todayRecord) {
        // 分割データが存在するかチェック
        const hasNewSplitData = (
          todayRecord.calories_bre !== null || todayRecord.calories_lun !== null || todayRecord.calories_din !== null ||
          todayRecord.protein_bre !== null || todayRecord.protein_lun !== null || todayRecord.protein_din !== null ||
          todayRecord.fat_bre !== null || todayRecord.fat_lun !== null || todayRecord.fat_din !== null ||
          todayRecord.carbs_bre !== null || todayRecord.carbs_lun !== null || todayRecord.carbs_din !== null
        );

        if (hasNewSplitData) {
          // 新しい分割データから合算値を計算
          console.log("分割データから栄養値を合算計算:", todayRecord);
          
          const totalCalories = (todayRecord.calories_bre || 0) + (todayRecord.calories_lun || 0) + (todayRecord.calories_din || 0);
          const totalProtein = (todayRecord.protein_bre || 0) + (todayRecord.protein_lun || 0) + (todayRecord.protein_din || 0);
          const totalFat = (todayRecord.fat_bre || 0) + (todayRecord.fat_lun || 0) + (todayRecord.fat_din || 0);
          const totalCarbs = (todayRecord.carbs_bre || 0) + (todayRecord.carbs_lun || 0) + (todayRecord.carbs_din || 0);

          setNutritionData({
            calories: Math.round(totalCalories),
            protein: { 
              value: Math.round(totalProtein * 10) / 10, 
              percentage: Math.round((totalProtein / targetPFC.protein) * 100)
            },
            fat: { 
              value: Math.round(totalFat * 10) / 10, 
              percentage: Math.round((totalFat / targetPFC.fat) * 100)
            },
            carbs: { 
              value: Math.round(totalCarbs * 10) / 10, 
              percentage: Math.round((totalCarbs / targetPFC.carbs) * 100)
            },
          });
        } else {
          // 栄養データがない場合はゼロで初期化
          setNutritionData({
            calories: 0,
            protein: { value: 0, percentage: 0 },
            fat: { value: 0, percentage: 0 },
            carbs: { value: 0, percentage: 0 },
          });
        }
      } else {
        // データがない場合はゼロで初期化
        setNutritionData({
          calories: 0,
          protein: { value: 0, percentage: 0 },
          fat: { value: 0, percentage: 0 },
          carbs: { value: 0, percentage: 0 },
        });
      }
    } catch (error) {
      console.error("栄養データ取得エラー:", error);
    }
  };

  // 食事データを取得する関数
  const fetchMealData = async (dateString: string) => {
    if (!cognitoUserId) {
      console.log("fetchMealData: cognitoUserId がありません");
      return;
    }
    
    try {
      console.log("=== fetchMealData 開始 ===");
      console.log("検索条件 - dateString:", dateString, "cognitoUserId:", cognitoUserId);
      
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      console.log("DailyRecord全件数:", dailyRecords?.length || 0);
      console.log("DailyRecord全データ:", dailyRecords);
      
      // 食事データ専用レコード
      const todayMeals = dailyRecords?.filter(m => 
        m.date === dateString && m.userId === cognitoUserId
      );
      
      console.log("フィルター後の今日の食事データ:", todayMeals);
      console.log("フィルター後の件数:", todayMeals?.length || 0);

      const mealsByType = {
        breakfast: "—",
        lunch: "—",
        dinner: "—",
      };

      todayMeals?.forEach((meal, index) => {
        console.log(`食事レコード ${index}:`, meal);
        console.log(`  breakfast: "${meal.breakfast}"`);
        console.log(`  lunch: "${meal.lunch}"`);
        console.log(`  dinner: "${meal.dinner}"`);
        
        if (meal.breakfast && meal.breakfast.trim() !== "") {
          mealsByType.breakfast = meal.breakfast;
          console.log(`  breakfast 設定: "${meal.breakfast}"`);
        }
        if (meal.lunch && meal.lunch.trim() !== "") {
          mealsByType.lunch = meal.lunch;
          console.log(`  lunch 設定: "${meal.lunch}"`);
        }
        if (meal.dinner && meal.dinner.trim() !== "") {
          mealsByType.dinner = meal.dinner;
          console.log(`  dinner 設定: "${meal.dinner}"`);
        }
      });

      console.log("最終的な食事データ:", mealsByType);
      setMealData(mealsByType);
      console.log("=== fetchMealData 完了 ===");
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

  // cognitoUserIdが取得できた後にプロフィール、食事データ、栄養データを取得
  useEffect(() => {
    if (cognitoUserId) {
      console.log("cognitoUserId が取得できました:", cognitoUserId);
      
      // 初期データ取得処理
      const loadInitialData = async () => {
        try {
          setIsLoading(true);
          
          // ユーザープロフィールを取得
          await fetchUserProfile();
          
          // 食事データと栄養データを取得
          const dateString = getCurrentDateString();
          console.log("食事データと栄養データを取得します。日付:", dateString);
          await Promise.all([
            fetchMealData(dateString),
            fetchHealthDataFromDailyRecord(dateString),
            fetchNutritionData(dateString)
          ]);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadInitialData();
    }
  }, [cognitoUserId]);

  useEffect(() => {
    // 1分ごとに日付を更新（日付が変わった場合のため）
    const dateUpdateInterval = setInterval(() => {
      const newDateString = getCurrentDateString();
      updateCurrentDate();

      // 日付が変わった場合はデータも再取得
      const currentDateString = getCurrentDateString();
      if (cognitoUserId) {
        fetchNutritionData(currentDateString);
        fetchMealData(currentDateString);
        fetchHealthDataFromDailyRecord(currentDateString);
      }
    }, 60000); // 1分間隔

    // ページフォーカス時にユーザープロフィールと健康データを再取得
    const handleFocus = () => {
      if (cognitoUserId) {
        fetchUserProfile();
        const currentDateString = getCurrentDateString();
        fetchHealthDataFromDailyRecord(currentDateString);
        fetchMealData(currentDateString);
        fetchNutritionData(currentDateString);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(dateUpdateInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [cognitoUserId]);

  // healthDataが変更された時に編集データも同期
  useEffect(() => {
    setHealthEditData(healthData);
  }, [healthData]);

  // mealDataが変更された時に編集データも同期
  useEffect(() => {
    setMealEditData(mealData);
  }, [mealData]);

  const handleEditClick = () => {
    console.log("編集ボタンがクリックされました");
  };

  // 「本日の調子」編集機能
  const handleHealthEditToggle = () => {
    if (isHealthEditMode) {
      // 編集をキャンセルして元のデータに戻す
      setHealthEditData(healthData);
      setWeightError(""); // エラーをクリア
    } else {
      // 編集モードに入る時は現在のデータをコピー
      setHealthEditData(healthData);
      setWeightError(""); // エラーをクリア
    }
    setIsHealthEditMode(!isHealthEditMode);
  };

  const handleHealthInputChange = (field: keyof HealthData, value: string | number) => {
    setHealthEditData(prev => ({
      ...prev,
      [field]: value
    }));

    // 体重の場合はエラーをクリア（リアルタイムバリデーションは行わない）
    if (field === 'weight') {
      setWeightError("");
    }
  };

  // 体重のバリデーション関数
  const validateWeight = (weight: string | number): boolean => {
    const weightString = typeof weight === 'string' ? weight : weight.toString();
    
    // 空文字チェック
    if (!weightString.trim()) {
      setWeightError("体重は必須です");
      return false;
    }
    
    // 正規表現チェック
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(weightString)) {
      setWeightError("体重は正しい形式で入力してください（例：65.50）");
      return false;
    }
    
    const weightNum = parseFloat(weightString);
    
    // 範囲チェック
    if (weightNum < 0 || weightNum > 300) {
      setWeightError("体重は0～300kgの範囲で入力してください");
      return false;
    }
    
    // エラーなし
    setWeightError("");
    return true;
  };

  const handleHealthSave = async () => {
    try {
      // 体重のバリデーションチェック（保存時に実行）
      const isWeightValid = validateWeight(healthEditData.weight);
      if (!isWeightValid) {
        return; // バリデーションエラーがある場合は保存を中止
      }

      const dateString = getCurrentDateString();
      const weightValue = typeof healthEditData.weight === 'string' ? parseFloat(healthEditData.weight) : healthEditData.weight;
      
      // 1. UserProfileの体重を更新
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: cognitoUserId } }
      });

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        await client.models.UserProfile.update({
          id: profile.id,
          weight: weightValue,
        });
        console.log("UserProfileの体重を更新しました:", weightValue);
      }

      // 2. DailyRecordの健康データ（体調・気分・体重）を更新
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      const existingHealthRecord = dailyRecords?.find(record => 
        record.userId === cognitoUserId && record.date === dateString
      );

      if (existingHealthRecord) {
        // 既存のレコードを更新
        await client.models.DailyRecord.update({
          id: existingHealthRecord.id,
          condition: healthEditData.condition,
          mood: healthEditData.mood,
          weight: weightValue,
        });
        console.log("DailyRecordの健康データを更新しました:", healthEditData);
      } else {
        // 新しいレコードを作成
        await client.models.DailyRecord.create({
          userId: cognitoUserId,
          date: dateString,
          condition: healthEditData.condition,
          mood: healthEditData.mood,
          weight: weightValue,
        });
        console.log("新しいDailyRecord健康データを作成しました:", healthEditData);
      }

      // 画面の状態を更新（数値として保存）
      setHealthData({
        ...healthEditData,
        weight: weightValue
      });
      setIsHealthEditMode(false);
      console.log("「本日の調子」が保存されました:", healthEditData);
    } catch (error) {
      console.error("健康データ保存エラー:", error);
      alert("保存に失敗しました。もう一度お試しください。");
    }
  };

  // 「本日の食事」編集機能
  const handleMealEditToggle = () => {
    if (isMealEditMode) {
      // 編集をキャンセルして元のデータに戻す
      setMealEditData(mealData);
    } else {
      // 編集モードに入る時は現在のデータをコピー
      setMealEditData(mealData);
    }
    setIsMealEditMode(!isMealEditMode);
  };

  const handleMealInputChange = (field: keyof MealData, value: string) => {
    setMealEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 食事分析API呼び出し関数
  const analyzeMealWithAPI = async (mealType: string, mealContent: string) => {
    try {
      if (!mealContent || mealContent.trim() === "" || mealContent === "—") {
        return { calories: 0, protein: 0, fat: 0, carbs: 0 };
      }

      // 食材を分割
      const mealItems = mealContent.split(/[、,，]+/).map(item => item.trim()).filter(item => item);
      
      console.log(`${mealType}の分析開始:`, mealItems);
      
      // GraphQL mealAnalysis クエリを呼び出し
      const result = await client.queries.mealAnalysis({ mealItems });
      
      console.log(`${mealType}のAPI応答:`, result);
      
      if (result.data) {
        console.log(`${mealType}の生データ:`, result.data);
        console.log(`データ型: ${typeof result.data}`);
        
        // 文字列の場合は最初の100文字を表示
        if (typeof result.data === 'string') {
          console.log(`${mealType}の文字列データ（最初の100文字）:`, result.data.substring(0, 100));
        }
        
        let analysisResult;
        
        // result.dataが文字列の場合はJSON.parse、オブジェクトの場合はそのまま使用
        if (typeof result.data === 'string') {
          console.log(`${mealType}: 文字列をパース中...`);
          try {
            analysisResult = JSON.parse(result.data);
            console.log(`${mealType}: パース成功`);
          } catch (parseError) {
            console.error(`${mealType}: JSON.parseエラー:`, parseError);
            console.error(`${mealType}: パース失敗した文字列:`, result.data);
            throw parseError;
          }
        } else if (typeof result.data === 'object') {
          console.log(`${mealType}: オブジェクトをそのまま使用`);
          analysisResult = result.data;
        } else {
          console.error(`${mealType}: 予期しないデータ型:`, typeof result.data);
          throw new Error(`予期しないデータ型: ${typeof result.data}`);
        }
        
        console.log(`${mealType}の分析結果:`, analysisResult);
        
        // エラーチェック
        if (analysisResult.error) {
          console.error(`${mealType}でAPIエラー:`, analysisResult.error);
          alert(`栄養分析エラー\n\n${mealType}の栄養価計算に失敗しました。\n\nエラー詳細: ${analysisResult.error}\n\n栄養価は0として保存されます。`);
          return { calories: 0, protein: 0, fat: 0, carbs: 0 };
        }
        
        return {
          calories: Math.round(analysisResult.totalCalories || 0),
          protein: Math.round((analysisResult.totalProtein || 0) * 10) / 10,
          fat: Math.round((analysisResult.totalFat || 0) * 10) / 10,
          carbs: Math.round((analysisResult.totalCarbs || 0) * 10) / 10,
        };
      }
    } catch (error) {
      console.error(`${mealType}のmealAnalysis呼び出しエラー:`, error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      alert(`栄養分析エラー\n\n${mealType}の栄養価計算に失敗しました。\n\nエラー詳細: ${errorMessage}\n\n栄養価は0として保存されます。`);
      return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    }
    
    // データがない場合はデフォルト値
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  };

  const handleMealSave = async () => {
    try {
      console.log("=== handleMealSave 開始 ===");
      console.log("cognitoUserId:", cognitoUserId);
      console.log("保存する食事データ:", mealEditData);
      
      const dateString = getCurrentDateString();
      console.log("保存対象日付:", dateString);
      
      // 既存レコード取得
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      const todayMealRecord = dailyRecords?.find(record => 
        record.userId === cognitoUserId && record.date === dateString
      );
      
      // 変更検出
      const changedMeals: { type: 'breakfast' | 'lunch' | 'dinner', content: string }[] = [];
      
      if (mealEditData.breakfast !== mealData.breakfast) {
        changedMeals.push({ type: 'breakfast', content: mealEditData.breakfast });
      }
      if (mealEditData.lunch !== mealData.lunch) {
        changedMeals.push({ type: 'lunch', content: mealEditData.lunch });
      }
      if (mealEditData.dinner !== mealData.dinner) {
        changedMeals.push({ type: 'dinner', content: mealEditData.dinner });
      }
      
      console.log("既存レコード:", todayMealRecord);

      // Step 1: まず食事内容だけを保存（栄養価は既存値を保持）
      if (todayMealRecord) {
        // 既存のレコードを更新（食事内容のみ、栄養価は既存値を保持）
        console.log("既存レコードを更新します（食事内容のみ）:", {
          id: todayMealRecord.id,
          breakfast: mealEditData.breakfast,
          lunch: mealEditData.lunch,
          dinner: mealEditData.dinner,
        });
        
        const { data: updatedRecord, errors } = await client.models.DailyRecord.update({
          id: todayMealRecord.id,
          breakfast: mealEditData.breakfast,
          lunch: mealEditData.lunch,
          dinner: mealEditData.dinner,
        });
        
        if (errors) {
          console.error("更新エラー:", errors);
          throw new Error("更新に失敗しました");
        }
        
        console.log("食事データを更新しました:", updatedRecord);
      } else {
        // 新しいレコードを作成（食事内容のみ、栄養価は0）
        const newRecord = {
          userId: cognitoUserId,
          date: dateString,
          breakfast: mealEditData.breakfast,
          lunch: mealEditData.lunch,
          dinner: mealEditData.dinner,
          calories_bre: 0,
          calories_lun: 0,
          calories_din: 0,
          protein_bre: 0,
          protein_lun: 0,
          protein_din: 0,
          fat_bre: 0,
          fat_lun: 0,
          fat_din: 0,
          carbs_bre: 0,
          carbs_lun: 0,
          carbs_din: 0,
        };
        console.log("新規レコードを作成します:", newRecord);
        
        const { data: createdRecord, errors } = await client.models.DailyRecord.create(newRecord);
        
        if (errors) {
          console.error("作成エラー:", errors);
          throw new Error("作成に失敗しました");
        }
        
        console.log("新しい食事データを作成しました:", createdRecord);
      }

      // 画面の状態を更新（先に編集モードを終了してユーザーに保存完了を知らせる）
      setMealData(mealEditData);
      setIsMealEditMode(false);
      
      console.log("「本日の食事」が保存されました:", mealEditData);
      
      // Step 2: バックグラウンドで栄養価を計算して更新
      if (changedMeals.length > 0) {
        console.log("バックグラウンドで栄養価を計算中...");
        
        // ローディング表示を開始
        setIsCalculatingNutrition(true);
        
        // 非同期で栄養価計算を実行（await不要）
        (async () => {
          try {
            // 再度レコードを取得（先ほど保存したレコードを取得）
            const { data: updatedDailyRecords } = await client.models.DailyRecord.list();
            const currentRecord = updatedDailyRecords?.find(record => 
              record.userId === cognitoUserId && record.date === dateString
            );

            if (!currentRecord) {
              console.error("保存後のレコードが見つかりません");
              setIsCalculatingNutrition(false);
              return;
            }

            // 既存栄養価を保持
            let breakfastNutrition = {
              calories: currentRecord.calories_bre || 0,
              protein: currentRecord.protein_bre || 0,
              fat: currentRecord.fat_bre || 0,
              carbs: currentRecord.carbs_bre || 0,
            };
            let lunchNutrition = {
              calories: currentRecord.calories_lun || 0,
              protein: currentRecord.protein_lun || 0,
              fat: currentRecord.fat_lun || 0,
              carbs: currentRecord.carbs_lun || 0,
            };
            let dinnerNutrition = {
              calories: currentRecord.calories_din || 0,
              protein: currentRecord.protein_din || 0,
              fat: currentRecord.fat_din || 0,
              carbs: currentRecord.carbs_din || 0,
            };

            // 変更された食事のみ栄養価を計算
            for (const meal of changedMeals) {
              const nutrition = await analyzeMealWithAPI(meal.type, meal.content);
              
              if (meal.type === 'breakfast') breakfastNutrition = nutrition;
              else if (meal.type === 'lunch') lunchNutrition = nutrition;
              else if (meal.type === 'dinner') dinnerNutrition = nutrition;
            }

            console.log("計算された栄養価:", {
              breakfast: breakfastNutrition,
              lunch: lunchNutrition,
              dinner: dinnerNutrition
            });

            // 栄養価をデータベースに保存
            await client.models.DailyRecord.update({
              id: currentRecord.id,
              calories_bre: breakfastNutrition.calories,
              calories_lun: lunchNutrition.calories,
              calories_din: dinnerNutrition.calories,
              protein_bre: breakfastNutrition.protein,
              protein_lun: lunchNutrition.protein,
              protein_din: dinnerNutrition.protein,
              fat_bre: breakfastNutrition.fat,
              fat_lun: lunchNutrition.fat,
              fat_din: dinnerNutrition.fat,
              carbs_bre: breakfastNutrition.carbs,
              carbs_lun: lunchNutrition.carbs,
              carbs_din: dinnerNutrition.carbs,
            });

            console.log("栄養価の更新が完了しました");

            // 画面の栄養価表示を更新
            await fetchNutritionData(dateString);
            
            // ローディング表示を終了
            setIsCalculatingNutrition(false);
          } catch (error) {
            console.error("バックグラウンド栄養価計算エラー:", error);
            // エラーが発生してもユーザーには通知しない（保存自体は成功しているため）
            // ローディング表示を終了
            setIsCalculatingNutrition(false);
          }
        })();
      }
      
      // 食事データを再取得して表示を確実に更新
      await fetchMealData(dateString);
      
      console.log("=== handleMealSave 完了 ===");
    } catch (error) {
      console.error("=== 食事データ保存エラー ===");
      console.error("エラー詳細:", error);
      console.error("cognitoUserId:", cognitoUserId);
      console.error("mealEditData:", mealEditData);
      alert(`保存に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
    }
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
        {isLoading ? (
          <>
            <div className="skeleton skeleton-line" style={{ width: '150px', margin: '0 auto 8px' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '200px', margin: '0 auto' }}></div>
          </>
        ) : (
          <>
            <div className="date">{currentDate}</div>
            <div className="greeting">{getGreeting()} {userName}さん</div>
          </>
        )}
      </section>

      {/* 栄養情報セクション */}
      <section className="nutrition-section">
        <h3 className="section-title-highlight">食事バランス</h3>
        {isLoading ? (
          <>
            <div className="nutrition-header">
              <span className="nutrition-label">概算カロリー</span>
              <div className="skeleton skeleton-text" style={{ width: '180px', height: '16px' }}></div>
            </div>
            <div className="nutrition-details">
              <div className="nutrition-row">
                <span className="nutrition-type">P（タンパク質）</span>
                <div className="skeleton skeleton-text" style={{ width: '100px', height: '14px' }}></div>
              </div>
              <div className="nutrition-row">
                <span className="nutrition-type">F（脂質）</span>
                <div className="skeleton skeleton-text" style={{ width: '100px', height: '14px' }}></div>
              </div>
              <div className="nutrition-row">
                <span className="nutrition-type">C（炭水化物）</span>
                <div className="skeleton skeleton-text" style={{ width: '100px', height: '14px' }}></div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="nutrition-header">
              <span className="nutrition-label">概算カロリー</span>
              <span className="calories-value">
                {isCalculatingNutrition ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span className="spinner"></span> kcal / {recommendedCalories} kcal
                  </span>
                ) : (
                  `${Math.round(nutritionData.calories)} kcal / ${recommendedCalories} kcal`
                )}
              </span>
            </div>
            <div className="nutrition-details">
              <div className="nutrition-row">
                <span className="nutrition-type">P（タンパク質）</span>
                <span className="nutrition-values">
                  {isCalculatingNutrition ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="spinner"></span>g / {Math.round(calculateTargetPFC(recommendedCalories).protein)}g
                    </span>
                  ) : (
                    `${Math.round(nutritionData.protein.value)}g / ${Math.round(calculateTargetPFC(recommendedCalories).protein)}g`
                  )}
                </span>
              </div>
              <div className="nutrition-row">
                <span className="nutrition-type">F（脂質）</span>
                <span className="nutrition-values">
                  {isCalculatingNutrition ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="spinner"></span>g / {Math.round(calculateTargetPFC(recommendedCalories).fat)}g
                    </span>
                  ) : (
                    `${Math.round(nutritionData.fat.value)}g / ${Math.round(calculateTargetPFC(recommendedCalories).fat)}g`
                  )}
                </span>
              </div>
              <div className="nutrition-row">
                <span className="nutrition-type">C（炭水化物）</span>
                <span className="nutrition-values">
                  {isCalculatingNutrition ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span className="spinner"></span>g / {Math.round(calculateTargetPFC(recommendedCalories).carbs)}g
                    </span>
                  ) : (
                    `${Math.round(nutritionData.carbs.value)}g / ${Math.round(calculateTargetPFC(recommendedCalories).carbs)}g`
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 食事記録セクション */}
      <section className="meal-section">
        <div 
          className="section-title-highlight" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '15px',
            margin: '0 0 15px 0',
            padding: '8px 12px',
            borderRadius: '4px'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'white' }}>本日の食事</h3>
          {!isMealEditMode && !isLoading && (
            <button 
              className="change-button"
              onClick={handleMealEditToggle}
              style={{ 
                /*background: '#a8e6cf', */
                background: '#FDCB6E',
                color: '#070707', 
                border: 'none', 
                borderRadius: '4px', 
                padding: '5px 15px', 
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                /*e.currentTarget.style.backgroundColor = '#8ec1ae';*/
                e.currentTarget.style.backgroundColor = '#f39c12';
              }}
              onMouseLeave={(e) => {
                /*e.currentTarget.style.backgroundColor = '#a8e6cf';*/
                e.currentTarget.style.backgroundColor = '#FDCB6E';
              }}
            >
              変更
            </button>
          )}
        </div>
        
        {isLoading ? (
          <div className="meal-list">
            <div className="meal-row">
              <span className="meal-time">朝</span>
              <span className="meal-separator">：</span>
              <div className="skeleton skeleton-text" style={{ flex: 1, height: '14px' }}></div>
            </div>
            <div className="meal-row">
              <span className="meal-time">昼</span>
              <span className="meal-separator">：</span>
              <div className="skeleton skeleton-text" style={{ flex: 1, height: '14px' }}></div>
            </div>
            <div className="meal-row">
              <span className="meal-time">夜</span>
              <span className="meal-separator">：</span>
              <div className="skeleton skeleton-text" style={{ flex: 1, height: '14px' }}></div>
            </div>
          </div>
        ) : isMealEditMode ? (
          <div className="meal-list">
            <div className="meal-row">
              <span className="meal-time">朝</span>
              <span className="meal-separator">：</span>
              <input 
                type="text"
                value={mealEditData.breakfast}
                onChange={(e) => handleMealInputChange('breakfast', e.target.value)}
                placeholder="朝食を入力"
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="meal-row">
              <span className="meal-time">昼</span>
              <span className="meal-separator">：</span>
              <input 
                type="text"
                value={mealEditData.lunch}
                onChange={(e) => handleMealInputChange('lunch', e.target.value)}
                placeholder="昼食を入力"
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div className="meal-row">
              <span className="meal-time">夜</span>
              <span className="meal-separator">：</span>
              <input 
                type="text"
                value={mealEditData.dinner}
                onChange={(e) => handleMealInputChange('dinner', e.target.value)}
                placeholder="夕食を入力"
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        ) : (
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
        )}
        
        {/* 編集モード時のボタン（右下配置） */}
        {isMealEditMode && (
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginTop: '15px', 
            justifyContent: 'flex-end',
            padding: '10px 0'
          }}>
            <button 
              onClick={handleMealEditToggle}
              style={{
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9e9e9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
            >
              キャンセル
            </button>
            <button 
              onClick={handleMealSave}
              style={{
                background: '#FDCB6E',
                color: '#070707',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f39c12';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FDCB6E';
              }}
            >
              保存
            </button>
          </div>
        )}
      </section>

      {/* 体調管理セクション */}
      <section className="health-section">
        <div 
          className="section-title-highlight" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '15px',
            margin: '0 0 15px 0',
            padding: '8px 12px',
            borderRadius: '4px'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'white' }}>本日の調子</h3>
          {!isHealthEditMode && !isLoading && (
            <button 
              className="change-button"
              onClick={handleHealthEditToggle}
              style={{ 
                background: '#FDCB6E', 
                color: '#070707', 
                border: 'none', 
                borderRadius: '4px', 
                padding: '5px 15px', 
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f39c12';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FDCB6E';
              }}
            >
              変更
            </button>
          )}
        </div>
        
        {isLoading ? (
          <div className="health-content">
            <div className="health-row">
              <span className="health-label">体調：</span>
              <div className="skeleton skeleton-text" style={{ flex: 1, height: '14px', maxWidth: '200px' }}></div>
            </div>
            <div className="health-row">
              <span className="health-label">気分：</span>
              <div className="skeleton skeleton-text" style={{ flex: 1, height: '14px', maxWidth: '200px' }}></div>
            </div>
            <div className="health-row">
              <span className="health-label">体重：</span>
              <div className="skeleton skeleton-text" style={{ flex: 1, height: '14px', maxWidth: '100px' }}></div>
            </div>
          </div>
        ) : isHealthEditMode ? (
          <div className="health-content">
            <div className="health-row">
              <span className="health-label">体調：</span>
              <select 
                value={healthEditData.condition}
                onChange={(e) => handleHealthInputChange('condition', e.target.value)}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="今日の体調を入力しよう 📝">今日の体調を入力しよう 📝</option>
                <option value="とても良い 😊">とても良い 😊</option>
                <option value="良い 😌">良い 😌</option>
                <option value="普通 😐">普通 😐</option>
                <option value="少し悪い 😟">少し悪い 😟</option>
                <option value="悪い 😵">悪い 😵</option>
              </select>
            </div>
            <div className="health-row">
              <span className="health-label">気分：</span>
              <select 
                value={healthEditData.mood}
                onChange={(e) => handleHealthInputChange('mood', e.target.value)}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="今日の気分を入力しよう 💭">今日の気分を入力しよう 💭</option>
                <option value="ポジティブ">ポジティブ</option>
                <option value="普通">普通</option>
                <option value="ネガティブ">ネガティブ</option>
                <option value="リラックス">リラックス</option>
                <option value="やる気満々">やる気満々</option>
                <option value="疲れ気味">疲れ気味</option>
              </select>
            </div>
            <div className="health-row">
              <span className="health-label">体重：</span>
              <div style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
                <input 
                  type="text"
                  value={healthEditData.weight || ''}
                  onChange={(e) => handleHealthInputChange('weight', e.target.value)}
                  placeholder="体重を入力"
                  style={{
                    padding: '4px 8px',
                    border: `1px solid ${weightError ? '#e74c3c' : '#ddd'}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                    width: '80px',
                    backgroundColor: weightError ? '#fdf2f2' : 'white'
                  }}
                />
                <span style={{ marginLeft: '4px', marginRight: '8px' }}>kg</span>
                {weightError && (
                  <span style={{ 
                    color: '#e74c3c', 
                    fontSize: '12px', 
                    marginTop: '2px',
                    whiteSpace: 'nowrap'
                  }}>
                    {weightError}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
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
              <span className="health-value">{healthData.weight > 0 ? `${healthData.weight}kg` : '―.―kg'}</span>
            </div>
          </div>
        )}
        
        {/* 編集モード時のボタン（右下配置） */}
        {isHealthEditMode && (
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginTop: '15px', 
            justifyContent: 'flex-end',
            padding: '10px 0'
          }}>
            <button 
              onClick={handleHealthEditToggle}
              style={{
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9e9e9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
            >
              キャンセル
            </button>
            <button 
              onClick={handleHealthSave}
              style={{
                background: '#FDCB6E',
                color: '#070707',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f39c12';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FDCB6E';
              }}
            >
              保存
            </button>
          </div>
        )}
      </section>



      {/* 編集ボタン */}
      {/*<button className="edit-button" onClick={handleEditClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>*/}
    </BioryLayout>
  );
}
