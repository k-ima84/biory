"use client";
 
import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { useRouter } from "next/navigation";
import BioryLayout from "../components/BioryLayout";
import "./settings.css";
import { fetchCognitoUserInfo } from '../components/function';
 
Amplify.configure(outputs);
const client = generateClient<Schema>();
 
interface UserProfileForm {
  name: string;
  height: string;
  weight: string;
  age: string;
  gender: string;
  favoriteFoods: string;
  allergies: string;
  dislikedFoods: string;
  exerciseFrequency: string;
  exerciseFrequencyOther: string;
}
 
interface ValidationErrors {
  name?: string;
  height?: string;
  weight?: string;
  age?: string;
  gender?: string;
  exerciseFrequency?: string;
}
 
export default function SettingsPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState(""); // 現在のユーザーID
  const [userEmail, setUserEmail] = useState(""); // 現在のユーザーEmail
  const [isEditMode, setIsEditMode] = useState(false); // 編集モードフラグ
  {/* 基礎情報編集の変数削除
    const [isUserInfoEditMode, setIsUserInfoEditMode] = useState(false); // ユーザー情報編集モードフラグ
  */}
    const [userProfile, setUserProfile] = useState<UserProfileForm | null>(null); // 保存されたプロフィール
 
  const [formData, setFormData] = useState<UserProfileForm>({
    name: "",
    height: "",
    weight: "",
    age: "",
    gender: "",
    favoriteFoods: "",
    allergies: "",
    dislikedFoods: "",
    exerciseFrequency: "",
    exerciseFrequencyOther: "",
  });
 
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
 
  // 運動頻度の選択肢
  const exerciseOptions = [
    { value: "ほとんど運動しない", label: "ほとんど運動しない" },
    { value: "週1〜3回の軽い運動", label: "週1〜3回の運動" },
    { value: "週3〜5回の中程度の運動", label: "週3〜5回の運動" },
    { value: "週6〜7回の激しい運動", label: "週6〜7回の運動" },
    { value: "毎日2回の運動や肉体労働", label: "毎日2回の運動や肉体労働" },
  ];
 
  // 性別の選択肢
  const genderOptions = [
    { value: "女", label: "女" },
    { value: "男", label: "男" },
    { value: "そのほか", label: "そのほか" },
  ];
 
  // Cognitoユーザー情報を取得
  const fetchCognitoUserData = async () => {
    try {
      const userInfo = await fetchCognitoUserInfo();
      setCurrentUserId(userInfo.userId);
      setUserEmail(userInfo.email || "");
     
      console.log('Settings - Cognito User Info:', {
        userId: userInfo.userId,
        email: userInfo.email
      });
    } catch (error) {
      console.error('設定画面でのCognitoユーザー情報取得エラー:', error);
      // 認証エラーの場合はログイン画面へリダイレクト
      router.push("/biory/login");
    }
  };
 
  // 既存のユーザー情報を取得
  useEffect(() => {
    fetchCognitoUserData();
  }, []);
 
  // currentUserIdが取得できた後にプロフィールを取得
  useEffect(() => {
    if (currentUserId) {
      fetchUserProfile();
    }
  }, [currentUserId]);
 
  const fetchUserProfile = async () => {
    if (!currentUserId) {
      console.log('Settings: User ID not available yet');
      return;
    }
 
    console.log('Settings: Fetching user profile for userId:', currentUserId);
 
    try {
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: currentUserId } }
      });
 
      console.log('Settings: Found profiles:', profiles?.length || 0);
      
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        console.log('Settings: Profile data:', profile);
        
        const profileData = {
          name: profile.name || "",
          height: profile.height?.toString() || "",
          weight: profile.weight?.toString() || "",
          age: profile.age?.toString() || "",
          gender: profile.gender || "",
          favoriteFoods: profile.favoriteFoods || "",
          allergies: profile.allergies || "",
          dislikedFoods: profile.dislikedFoods || "",
          exerciseFrequency: profile.exerciseFrequency || "",
          exerciseFrequencyOther: profile.exerciseFrequencyOther || "",
        };
        console.log('Settings: Setting form data:', profileData);
        setFormData(profileData);
        setUserProfile(profileData);
      } else {
        console.log('Settings: No profile found, using default values');
        // プロフィールがない場合はデフォルト値を表示
        const defaultData = {
          name: "",
          height: "",
          weight: "",
          age: "",
          gender: "",
          favoriteFoods: "",
          allergies: "",
          dislikedFoods: "",
          exerciseFrequency: "",
          exerciseFrequencyOther: "",
        // プロフィールがない場合はサンプルデータを表示
        }
        const sampleData = {
          name: "未設定",
          height: "未設定",
          weight: "未設定",
          age: "未設定",
          gender: "未設定",
          favoriteFoods: "未設定",
          allergies: "未設定",
          dislikedFoods: "未設定",
          exerciseFrequency: "未設定",
          exerciseFrequencyOther: "未設定",
        };
        setFormData(defaultData);
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Settings: Error fetching user profile:', error);
    }
  };
 
  // バリデーション関数
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
 
    // 名前のバリデーション
    if (!formData.name.trim()) {
      newErrors.name = "名前は必須です";
    } else if (formData.name.length > 64) {
      newErrors.name = "名前は64文字以内で入力してください";
    } else if (formData.name.includes("　")) {
      newErrors.name = "全角スペースは使用できません";
    } else if (!/^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF ]+$/.test(formData.name)) {
      newErrors.name = "名前は日本語、英字、数字、半角スペースのみ使用可能です";
    }
 
    // 身長のバリデーション
    if (!formData.height.trim()) {
      newErrors.height = "身長は必須です";
    } else if (!/^\d{1,3}(\.\d{1,2})?$/.test(formData.height)) {
      newErrors.height = "身長は正しい形式で入力してください（例：170.50）";
    } else {
      const heightValue = parseFloat(formData.height);
      if (heightValue < 0 || heightValue > 300) {
        newErrors.height = "身長は0～300cmの範囲で入力してください";
      }
    }
 
    // 体重のバリデーション
    if (!formData.weight.trim()) {
      newErrors.weight = "体重は必須です";
    } else if (!/^\d{1,3}(\.\d{1,2})?$/.test(formData.weight)) {
      newErrors.weight = "体重は正しい形式で入力してください（例：65.50）";
    } else {
      const weightValue = parseFloat(formData.weight);
      if (weightValue < 0 || weightValue > 300) {
        newErrors.weight = "体重は0～300kgの範囲で入力してください";
      }
    }

    // 年齢のバリデーション
    if (!formData.age.trim()) {
      newErrors.age = "年齢は必須です";
    } else if (!/^\d{1,3}$/.test(formData.age)) {
      newErrors.age = "年齢は正しい形式で入力してください（例：30）";
    } else {
      const ageValue = parseInt(formData.age);
      if (ageValue < 1 || ageValue > 150) {
        newErrors.age = "年齢は1～150歳の範囲で入力してください";
      }
    }
 
    // 性別のバリデーション
    if (!formData.gender) {
      newErrors.gender = "性別を選択してください";
    }
 
    // 運動頻度のバリデーション
    if (!formData.exerciseFrequency) {
      newErrors.exerciseFrequency = "運動頻度を選択してください";
    }
 
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
 
  // 編集モードの切り替え
  const handleEditModeToggle = () => {
    console.log('Settings: Edit mode toggle clicked, current mode:', isEditMode);
    if (isEditMode) {
      // 編集をキャンセルして元のデータに戻す
      if (userProfile) {
        console.log('Settings: Restoring form data from userProfile:', userProfile);
        setFormData({ ...userProfile });
      }
      setErrors({});
    }
    setIsEditMode(!isEditMode);
    console.log('Settings: Edit mode set to:', !isEditMode);
  };
 
  // 保存処理（ボタンクリック用）
  const handleSave = async () => {
    if (validateForm()) {
      // フォーム送信イベントを作成
      const form = document.getElementById("user-profile-form") as HTMLFormElement;
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        await handleSubmit(event as any);
        setIsEditMode(false);
      }
    }
  };

  // 今日の日付文字列を取得するヘルパー関数
  const getCurrentDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  // DailyRecordの体重を更新する関数
  const updateDailyRecordWeight = async (newWeight: number) => {
    try {
      const dateString = getCurrentDateString();
      
      // DailyRecordテーブルから今日の健康データを検索
      const { data: dailyRecords } = await client.models.DailyRecord.list();
      const existingHealthRecord = dailyRecords?.find(record => 
        record.userId === currentUserId && record.date === dateString
      );

      if (existingHealthRecord) {
        // 既存のレコードを更新
        await client.models.DailyRecord.update({
          id: existingHealthRecord.id,
          weight: newWeight,
        });
        console.log("DailyRecordの体重を更新しました:", newWeight);
      } else {
        // 新しいレコードを作成（健康データ専用）
        await client.models.DailyRecord.create({
          userId: currentUserId,
          date: dateString,
          condition: "とても良い 😊", // デフォルト値
          mood: "ポジティブ", // デフォルト値
          weight: newWeight,
        });
        console.log("新しいDailyRecord健康データを作成しました（体重のみ）:", newWeight);
      }
    } catch (error) {
      console.error("DailyRecord体重更新エラー:", error);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
   
    if (!validateForm()) {
      return;
    }
 
    if (!currentUserId) {
      alert("ユーザー情報の取得中です。しばらくお待ちください。");
      return;
    }
 
    setIsLoading(true);
 
    try {
      // 既存のプロフィールがあるかチェック
      const { data: existingProfiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: currentUserId } }
      });
 
      const profileData = {
        userId: currentUserId,
        // email: userEmail,
        name: formData.name,
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        age: parseInt(formData.age),
        gender: formData.gender,
        favoriteFoods: formData.favoriteFoods,
        allergies: formData.allergies,
        dislikedFoods: formData.dislikedFoods,
        exerciseFrequency: formData.exerciseFrequency,
        exerciseFrequencyOther: formData.exerciseFrequency === "そのほか" ? formData.exerciseFrequencyOther : "",
      };

      // 体重が変更されたかチェック
      const oldWeight = userProfile?.weight ? parseFloat(userProfile.weight) : 0;
      const newWeight = parseFloat(formData.weight);
      const weightChanged = oldWeight !== newWeight;
 
      if (existingProfiles && existingProfiles.length > 0) {
        // 更新
        await client.models.UserProfile.update({
          id: existingProfiles[0].id,
          ...profileData
        });
      } else {
        // 新規作成
        await client.models.UserProfile.create(profileData);
      }

      // 体重が変更された場合、DailyRecordも更新
      if (weightChanged) {
        await updateDailyRecordWeight(newWeight);
        console.log(`体重が変更されました: ${oldWeight}kg → ${newWeight}kg`);
      }
 
      // 保存完了後は編集モードを終了して設定画面に留まる
      console.log('Settings: Saving completed, updating UI');
      setUserProfile(formData);
      setIsEditMode(false);
      
      // データの再取得を行って最新の状態に同期
      await fetchUserProfile();
      
      console.log("Settings: 設定を保存しました。");
      alert("設定を保存しました。");
     
    } catch (error) {
      console.error("ユーザー情報の保存エラー:", error);
      alert("保存中にエラーが発生しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };
 
  const handleInputChange = (field: keyof UserProfileForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // エラーをクリア
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };
 
{/*
  const handleBackToHome = () => {
    router.push("/biory/home");
  };
*/}
 
  return (
    <BioryLayout>
      <div className="settings-container">
        {/* 設定画面のタイトル - ホーム画面と統一 */}
        <section className="date-greeting">
          <div className="date">設定</div>
          <div className="greeting">あなたの情報</div>
        </section>
 
        {/* ユーザー情報セクション */}
        <section className="user-info-section">
          <div className="section-header">
            <h3 className="section-title-highlight">🙍 ユーザ情報</h3>
          </div>
          <div className="user-info-content">
            <div className="user-info-row">
              <span className="user-info-label">ID（メールアドレス）：</span>
              <span className="user-info-value">{userEmail || "読み込み中..."}</span>
            </div>
          </div>
        </section>
 
      {/* 基礎情報セクション */}
      <section className="basic-info-section">
        <div className="section-header">
          <h3 className="section-title-highlight">📄 基礎情報</h3>
          {!isEditMode && (
            <button
              className="change-button"
              onClick={() => {
                console.log('Settings: Change button clicked');
                setIsEditMode(true);
              }}
              disabled={isLoading}
            >
              変更
            </button>
          )}
        </div>
 
        <form id="user-profile-form" onSubmit={handleSubmit} className="profile-form">
          {/* 名前 */}
          <div className="form-group">
            <label className="form-label">氏名</label>
            {isEditMode ? (
              <div className="form-input-container">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={`form-input ${errors.name ? "error" : ""}`}
                  placeholder="山田 太郎"
                  maxLength={64}
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>
            ) : (
              <div className="info-value">{formData.name || "未設定"}</div>
            )}
          </div>
 
          {/* 身長 */}
          <div className="form-group">
            <label className="form-label">身長</label>
            {isEditMode ? (
              <>
                <div className="input-with-unit">
                  <input
                    type="text"
                    value={formData.height}
                    onChange={(e) => handleInputChange("height", e.target.value)}
                    className={`form-input ${errors.height ? "error" : ""}`}
                    placeholder="170.5"
                  />
                  <span className="unit">cm</span>
                </div>
                {errors.height && <span className="error-message">{errors.height}</span>}
              </>
            ) : (
              <div className="info-value">{formData.height ? `${formData.height} cm` : "未設定"}</div>
            )}
          </div>
 
          {/* 体重 */}
          <div className="form-group">
            <label className="form-label">体重</label>
            {isEditMode ? (
              <>
                <div className="input-with-unit">
                  <input
                    type="text"
                    value={formData.weight}
                    onChange={(e) => handleInputChange("weight", e.target.value)}
                    className={`form-input ${errors.weight ? "error" : ""}`}
                    placeholder="65.5"
                  />
                  <span className="unit">kg</span>
                </div>
                {errors.weight && <span className="error-message">{errors.weight}</span>}
              </>
            ) : (
              <div className="info-value">{formData.weight ? `${formData.weight} kg` : "未設定"}</div>
            )}
          </div>

          {/* 年齢 */}
          <div className="form-group">
            <label className="form-label">年齢</label>
            {isEditMode ? (
              <>
                <div className="input-with-unit">
                  <input
                    type="text"
                    value={formData.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    className={`form-input ${errors.age ? "error" : ""}`}
                    placeholder="30"
                  />
                  <span className="unit">歳</span>
                </div>
                {errors.age && <span className="error-message">{errors.age}</span>}
              </>
            ) : (
              <div className="info-value">{formData.age ? `${formData.age} 歳` : "未設定"}</div>
            )}
          </div>
 
          {/* 性別 */}
          <div className="form-group">
            <label className="form-label">性別</label>
            {isEditMode ? (
              <>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange("gender", e.target.value)}
                  className={`form-select ${errors.gender ? "error" : ""}`}
                >
                  <option value="">選択してください</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.gender && <span className="error-message">{errors.gender}</span>}
              </>
            ) : (
              <div className="info-value">{formData.gender || "未設定"}</div>
            )}
          </div>
 
          {/* 好きな食べ物 */}
          <div className="form-group">
            <label className="form-label">好きな食べ物</label>
            {isEditMode ? (
              <input
                type="text"
                value={formData.favoriteFoods}
                onChange={(e) => handleInputChange("favoriteFoods", e.target.value)}
                className="form-input"
                placeholder="寿司、ラーメン"
              />
            ) : (
              <div className="info-value">{formData.favoriteFoods || "未設定"}</div>
            )}
          </div>
 
          {/* 嫌いな食べ物 */}
          <div className="form-group">
            <label className="form-label">嫌いな食べ物</label>
            {isEditMode ? (
              <input
                type="text"
                value={formData.dislikedFoods}
                onChange={(e) => handleInputChange("dislikedFoods", e.target.value)}
                className="form-input"
                placeholder="ピーマン、にんじん"
              />
            ) : (
              <div className="info-value">{formData.dislikedFoods || "なし"}</div>
            )}
          </div>
 
          {/* アレルギー */}
          <div className="form-group">
            <label className="form-label">アレルギー</label>
            {isEditMode ? (
              <input
                type="text"
                value={formData.allergies}
                onChange={(e) => handleInputChange("allergies", e.target.value)}
                className="form-input"
                placeholder="卵、牛乳"
              />
            ) : (
              <div className="info-value">{formData.allergies || "なし"}</div>
            )}
          </div>
 
          {/* 運動頻度 */}
          <div className="form-group">
            <label className="form-label">運動量</label>
            {isEditMode ? (
              <>
                <select
                  value={formData.exerciseFrequency}
                  onChange={(e) => handleInputChange("exerciseFrequency", e.target.value)}
                  className={`form-select ${errors.exerciseFrequency ? "error" : ""}`}
                >
                  <option value="">選択してください</option>
                  {exerciseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.exerciseFrequency && <span className="error-message">{errors.exerciseFrequency}</span>}
              </>
            ) : (
              <div className="info-value">
                {formData.exerciseFrequency === "そのほか" && formData.exerciseFrequencyOther
                  ? formData.exerciseFrequencyOther
                  : formData.exerciseFrequency || "未設定"
                }
              </div>
            )}
          </div>
 
          {/* その他運動頻度 */}
          {isEditMode && formData.exerciseFrequency === "そのほか" && (
            <div className="form-group">
              <label className="form-label">運動量（詳細）</label>
              <input
                type="text"
                value={formData.exerciseFrequencyOther}
                onChange={(e) => handleInputChange("exerciseFrequencyOther", e.target.value)}
                className="form-input"
                placeholder="詳細を入力してください"
              />
            </div>
          )}
        </form>
 
        {/* 編集モード時のボタン群 */}
        {isEditMode && (
          <div className="form-buttons">
            <button
              className="cancel-button"
              onClick={handleEditModeToggle}
              type="button"
              disabled={isLoading}
            >
              キャンセル
            </button>
            <button
              className="save-button"
              onClick={handleSave}
              type="button"
              disabled={isLoading}
            >
              {isLoading ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </section>
      </div>
    </BioryLayout>
  );
}
 
 