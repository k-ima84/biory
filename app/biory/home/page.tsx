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
    condition: "とても良い 😊",
    mood: "ポジティブ",
    weight: 0,
  });

  // 「本日の調子」編集機能用のstate
  const [isHealthEditMode, setIsHealthEditMode] = useState(false);
  const [healthEditData, setHealthEditData] = useState<HealthData>({
    condition: "とても良い 😊",
    mood: "ポジティブ",
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

  // 推奨カロリーを計算
  const recommendedCalories = userProfile ? calculateTDEE(userProfile) : 2000;

  // 現在の日付を取得して設定する関数
  const updateCurrentDate = () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 0-11 → 1-12
    const date = now.getDate();
    const dayOfWeek = dayNames[now.getDay()];
    const formattedDate = `${month}/${date} (${dayOfWeek})`;
    setCurrentDate(formattedDate);
  };

  // FoodNutritionデータベース確認用の関数
  const checkFoodNutritionData = async () => {
    try {
      console.log('=== FoodNutrition データベース確認開始 ===');
      const { data: foods } = await client.models.FoodNutrition.list();
      
      if (foods && foods.length > 0) {
        console.log(`✅ FoodNutrition レコード数: ${foods.length}件`);
        console.log('サンプルデータ（最初の3件）:');
        foods.slice(0, 3).forEach((food, index) => {
          console.log(`${index + 1}. ${food.foodName}: ${food.energyKcal}kcal, P:${food.protein}g, F:${food.fat}g, C:${food.carbs}g`);
        });
        
        // 検索テスト
        const testSearch = foods.filter(f => f.foodName.includes('コッペパン'));
        console.log(`"コッペパン"検索結果: ${testSearch.length}件`);
        if (testSearch.length > 0) {
          console.log(`例: ${testSearch[0].foodName} (${testSearch[0].energyKcal}kcal)`);
        }
      } else {
        console.log('❌ FoodNutrition データが見つかりません');
        console.log('CSVインポートが必要です');
      }
    } catch (error) {
      console.error('❌ FoodNutrition データ確認エラー:', error);
    }
  };

  // CSVインポート機能（開発用）
  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      console.log('CSVファイルインポート開始:', file.name);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvData = e.target?.result as string;
          const lines = csvData.split('\n').filter(line => line.trim() !== '');
          const foods = [];
          
          // ヘッダー行をスキップ（1行目）
          for (let i = 1; i < lines.length && i < 51; i++) { // 最初の50件のみテスト
            const line = lines[i].trim();
            if (line) {
              const columns = line.split(',');
              if (columns.length >= 6) {
                const food = {
                  foodName: columns[1].replace(/"/g, '').trim(),
                  energyKcal: parseInt(columns[2]) || 0,
                  protein: parseFloat(columns[3]) || 0,
                  fat: parseFloat(columns[4]) || 0,
                  carbs: parseFloat(columns[5]) || 0,
                };
                
                if (food.foodName && food.energyKcal > 0) {
                  foods.push(food);
                }
              }
            }
          }
          
          console.log(`テスト用に${foods.length}件のデータを処理`);
          
          // DynamoDBに保存
          let successCount = 0;
          let errorCount = 0;
          
          for (const food of foods) {
            try {
              await client.models.FoodNutrition.create({
                foodName: food.foodName,
                energyKcal: food.energyKcal,
                protein: food.protein,
                fat: food.fat,
                carbs: food.carbs,
                per100g: true,
              });
              successCount++;
              console.log(`✅ 保存成功: ${food.foodName}`);
            } catch (error) {
              errorCount++;
              console.error(`❌ 保存エラー - ${food.foodName}:`, error);
            }
            
            // 進捗表示
            if ((successCount + errorCount) % 10 === 0) {
              console.log(`進捗: ${successCount + errorCount}/${foods.length} (成功: ${successCount}, エラー: ${errorCount})`);
            }
          }
          
          console.log(`インポート完了: 成功 ${successCount}件, エラー ${errorCount}件`);
          alert(`CSVインポート完了\n成功: ${successCount}件\nエラー: ${errorCount}件`);
          
          // データ確認を再実行
          await checkFoodNutritionData();
          
        } catch (error) {
          console.error('CSVインポートエラー:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert('CSVインポートでエラーが発生しました: ' + errorMessage);
        }
      };
      
      reader.readAsText(file, 'utf-8');
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      alert('ファイル読み込みでエラーが発生しました');
    }
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
      
      // ユーザー認証成功後にデータベース確認を実行
      await checkFoodNutritionData();
      
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
          condition: todayHealthRecord.condition || "とても良い 😊",
          mood: todayHealthRecord.mood || "ポジティブ",
          // 体重はUserProfileから取得するのでここでは更新しない
        }));
      } else {
        // デフォルト値を設定（体重は除く）
        setHealthData(prev => ({
          ...prev,
          condition: "とても良い 😊",
          mood: "ポジティブ",
        }));
      }
    } catch (error) {
      console.error("健康データ取得エラー:", error);
      // エラー時はデフォルト値を設定（体重は除く）
      setHealthData(prev => ({
        ...prev,
        condition: "とても良い 😊",
        mood: "ポジティブ",
      }));
    }
  };
 

  // FoodNutritionから食品を検索する関数
  const searchFoodNutrition = async (foodName: string) => {
    try {
      // 全件取得（ページネーション対応）
      let allFoodData: any[] = [];
      let nextToken: string | null = null;
      
      do {
        const result: any = await client.models.FoodNutrition.list({
          limit: 1000,
          nextToken: nextToken || undefined
        });
        
        if (result.data) {
          allFoodData = allFoodData.concat(result.data);
        }
        
        nextToken = result.nextToken;
      } while (nextToken);
      
      // あいまい検索（部分一致）
      const matchedFood = allFoodData.find(food => 
        food.foodName?.includes(foodName) || foodName.includes(food.foodName || '')
      );
      
      if (matchedFood) {
        console.log(`食品発見: ${matchedFood.foodName} -> カロリー:${matchedFood.energyKcal}, P:${matchedFood.protein}g`);
        return {
          calories: matchedFood.energyKcal || 0,
          protein: matchedFood.protein || 0,
          fat: matchedFood.fat || 0,
          carbs: matchedFood.carbs || 0,
        };
      }
    } catch (error) {
      console.error(`食品検索エラー (${foodName}):`, error);
    }
    
    console.log(`食品未発見: ${foodName}`);
    // デフォルト値
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  };

  // 食事記録から栄養価を自動計算する関数
  const calculateNutritionFromMeals = async (meals: string[]) => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;
    
    for (const mealContent of meals) {
      if (mealContent && mealContent !== "—" && mealContent.trim() !== "") {
        // 複数の食材が含まれている場合は分割
        const foods = mealContent.split(/[、,，]+/).map(food => food.trim());
        
        for (const food of foods) {
          if (food) {
            const nutrition = await searchFoodNutrition(food);
            totalCalories += nutrition.calories;
            totalProtein += nutrition.protein;
            totalFat += nutrition.fat;
            totalCarbs += nutrition.carbs;
          }
        }
      }
    }
    
    return {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
    };
  };

  // 栄養データを取得する関数（手動記録と自動計算の両方対応）
  const fetchNutritionData = async (dateString: string) => {
    try {
      // まず手動記録されたNutritionテーブルを確認
      const { data: nutritions } = await client.models.Nutrition.list();
      const todayNutrition = nutritions?.find(n => n.date === dateString);

      if (todayNutrition) {
        // 手動記録がある場合はそれを使用
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
      } else {
        // 手動記録がない場合は食事記録から自動計算
        if (cognitoUserId) {
          const { data: dailyRecords } = await client.models.DailyRecord.list();
          const todayMeals = dailyRecords?.filter(m => 
            m.date === dateString && m.userId === cognitoUserId
          );

          const mealContents = ['breakfast', 'lunch', 'dinner'].map(mealType => {
            const meal = todayMeals?.find(m => m[mealType as keyof typeof m]);
            const mealContent = meal?.[mealType as keyof typeof meal] || '';
            return typeof mealContent === 'string' ? mealContent : String(mealContent);
          });

          const calculatedNutrition = await calculateNutritionFromMeals(mealContents);
          
          setNutritionData({
            calories: calculatedNutrition.calories,
            protein: { 
              value: calculatedNutrition.protein, 
              percentage: calculatedNutrition.calories > 0 ? 
                Math.round((calculatedNutrition.protein * 4 / calculatedNutrition.calories) * 100) : 0
            },
            fat: { 
              value: calculatedNutrition.fat, 
              percentage: calculatedNutrition.calories > 0 ? 
                Math.round((calculatedNutrition.fat * 9 / calculatedNutrition.calories) * 100) : 0
            },
            carbs: { 
              value: calculatedNutrition.carbs, 
              percentage: calculatedNutrition.calories > 0 ? 
                Math.round((calculatedNutrition.carbs * 4 / calculatedNutrition.calories) * 100) : 0
            },
          });
        }
      }
    } catch (error) {
      console.error("栄養データ取得エラー:", error);
    }
  };

  // 食事データを取得する関数
  const fetchMealData = async (dateString: string) => {
    if (!cognitoUserId) return;
    
    try {
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      // 食事データ専用レコード
      const todayMeals = dailyRecords?.filter(m => 
        m.date === dateString && m.userId === cognitoUserId
      );

      const mealsByType = {
        breakfast: "—",
        lunch: "—",
        dinner: "—",
      };

      todayMeals?.forEach(meal => {
        if (meal.breakfast) mealsByType.breakfast = meal.breakfast || "—";
        if (meal.lunch) mealsByType.lunch = meal.lunch || "—";
        if (meal.dinner) mealsByType.dinner = meal.dinner || "—";
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
    fetchHealthDataFromDailyRecord(dateString);

    // 1分ごとに日付を更新（日付が変わった場合のため）
    const dateUpdateInterval = setInterval(() => {
      const newDateString = getCurrentDateString();
      updateCurrentDate();

      // 日付が変わった場合はデータも再取得
      if (newDateString !== dateString) {
        fetchNutritionData(newDateString);
        fetchMealData(newDateString);
        fetchHealthDataFromDailyRecord(newDateString);
      }
    }, 60000); // 1分間隔

    // ページフォーカス時にユーザープロフィールと健康データを再取得
    const handleFocus = () => {
      fetchUserProfile();
      const currentDateString = getCurrentDateString();
      fetchHealthDataFromDailyRecord(currentDateString);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(dateUpdateInterval);
    };
  }, []);

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

  const handleMealSave = async () => {
    try {
      const dateString = getCurrentDateString();
      
      // DailyRecordテーブルから今日の食事データを検索
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      const todayMealRecord = dailyRecords?.find(record => 
        record.userId === cognitoUserId && record.date === dateString
      );

      if (todayMealRecord) {
        // 既存のレコードを更新
        await client.models.DailyRecord.update({
          id: todayMealRecord.id,
          breakfast: mealEditData.breakfast,
          lunch: mealEditData.lunch,
          dinner: mealEditData.dinner,
        });
        console.log("食事データを更新しました:", mealEditData);
      } else {
        // 新しいレコードを作成
        await client.models.DailyRecord.create({
          userId: cognitoUserId,
          date: dateString,
          breakfast: mealEditData.breakfast,
          lunch: mealEditData.lunch,
          dinner: mealEditData.dinner,
        });
        console.log("新しい食事データを作成しました:", mealEditData);
      }

      // 画面の状態を更新
      setMealData(mealEditData);
      setIsMealEditMode(false);
      
      // 栄養価を再計算
      await fetchNutritionData(dateString);
      
      console.log("「本日の食事」が保存されました:", mealEditData);
    } catch (error) {
      console.error("食事データ保存エラー:", error);
      alert("保存に失敗しました。もう一度お試しください。");
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
          <span className="calories-value">{nutritionData.calories} kcal / {recommendedCalories} kcal</span>
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
          {!isMealEditMode && (
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
        
        {isMealEditMode ? (
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
          {!isHealthEditMode && (
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
        
        {isHealthEditMode ? (
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

      {/* 開発用CSVインポート機能 */}
      <div style={{
        position: 'fixed',
        bottom: '90px',
        right: '20px',
        zIndex: 1000,
        padding: '10px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        fontSize: '12px'
      }}>
        <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>開発用CSVインポート</div>
        <input
          type="file"
          accept=".csv"
          onChange={handleCSVImport}
          style={{ fontSize: '12px' }}
        />
        <div style={{ marginTop: '5px', color: '#6c757d' }}>
          nutrition-data.csvを選択してください
        </div>
      </div>

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
 