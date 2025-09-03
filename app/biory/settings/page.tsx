"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { useRouter } from "next/navigation";
import "./settings.css";

Amplify.configure(outputs);
const client = generateClient<Schema>();

interface UserProfileForm {
  name: string;
  height: string;
  weight: string;
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
  gender?: string;
  exerciseFrequency?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [currentUserId] = useState("user2"); // 現在のユーザーID（実際の認証では動的に取得）
  const [userEmail] = useState("xxxx@outlook.com"); // 現在のユーザーEmail
  
  const [formData, setFormData] = useState<UserProfileForm>({
    name: "",
    height: "",
    weight: "",
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
    { value: "週に1回以上運動する", label: "週に1回以上運動する" },
    { value: "週に1回程度運動する", label: "週に1回程度運動する" },
    { value: "運動しない", label: "運動しない" },
    { value: "そのほか", label: "そのほか" },
  ];

  // 性別の選択肢
  const genderOptions = [
    { value: "女", label: "女" },
    { value: "男", label: "男" },
    { value: "そのほか", label: "そのほか" },
  ];

  // 既存のユーザー情報を取得
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: currentUserId } }
      });

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        setFormData({
          name: profile.name || "",
          height: profile.height?.toString() || "",
          weight: profile.weight?.toString() || "",
          gender: profile.gender || "",
          favoriteFoods: profile.favoriteFoods || "",
          allergies: profile.allergies || "",
          dislikedFoods: profile.dislikedFoods || "",
          exerciseFrequency: profile.exerciseFrequency || "",
          exerciseFrequencyOther: profile.exerciseFrequencyOther || "",
        });
      }
    } catch (error) {
      console.error("ユーザー情報の取得エラー:", error);
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
      if (heightValue < 50 || heightValue > 300) {
        newErrors.height = "身長は50～300cmの範囲で入力してください";
      }
    }

    // 体重のバリデーション
    if (!formData.weight.trim()) {
      newErrors.weight = "体重は必須です";
    } else if (!/^\d{1,3}(\.\d{1,2})?$/.test(formData.weight)) {
      newErrors.weight = "体重は正しい形式で入力してください（例：65.50）";
    } else {
      const weightValue = parseFloat(formData.weight);
      if (weightValue < 20 || weightValue > 300) {
        newErrors.weight = "体重は20～300kgの範囲で入力してください";
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

  // フォーム送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
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
        email: userEmail,
        name: formData.name,
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        gender: formData.gender,
        favoriteFoods: formData.favoriteFoods,
        allergies: formData.allergies,
        dislikedFoods: formData.dislikedFoods,
        exerciseFrequency: formData.exerciseFrequency,
        exerciseFrequencyOther: formData.exerciseFrequency === "そのほか" ? formData.exerciseFrequencyOther : "",
      };

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

      // 完了画面に遷移
      router.push("/biory/settings/complete");
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

  const handleBackToHome = () => {
    router.push("/biory/home");
  };

  return (
    <div className="settings-container">
      {/* ヘッダー */}
      <header className="settings-header">
        <h1 className="settings-logo">biory</h1>
        <h2 className="settings-title">設定</h2>
      </header>

      {/* ユーザー情報セクション */}
      <section className="user-info-section">
        <div className="section-header">
          <h3>＜ユーザ情報＞</h3>
          <button className="change-button" onClick={() => console.log("変更ボタンクリック")}>
            変更
          </button>
        </div>
        <div className="user-info-content">
          <div className="info-row">
            <span className="info-label">Mail：</span>
            <span className="info-value">{userEmail}</span>
          </div>
          <div className="info-row">
            <span className="info-label">PW：</span>
            <span className="info-value">******</span>
          </div>
        </div>
      </section>

      {/* 基礎情報セクション */}
      <section className="basic-info-section">
        <div className="section-header">
          <h3>＜基礎情報＞</h3>
          <button className="change-button" type="submit" form="user-profile-form" disabled={isLoading}>
            {isLoading ? "保存中..." : "変更"}
          </button>
        </div>

        <form id="user-profile-form" onSubmit={handleSubmit} className="profile-form">
          {/* 名前 */}
          <div className="form-group">
            <label className="form-label">氏名：</label>
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

          {/* 身長 */}
          <div className="form-group">
            <label className="form-label">身長：</label>
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
          </div>

          {/* 体重 */}
          <div className="form-group">
            <label className="form-label">体重：</label>
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
          </div>

          {/* 性別 */}
          <div className="form-group">
            <label className="form-label">性別：</label>
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
          </div>

          {/* 好きな食べ物 */}
          <div className="form-group">
            <label className="form-label">好きなたべもの：</label>
            <input
              type="text"
              value={formData.favoriteFoods}
              onChange={(e) => handleInputChange("favoriteFoods", e.target.value)}
              className="form-input"
              placeholder="寿司、ラーメン"
            />
          </div>

          {/* アレルギー */}
          <div className="form-group">
            <label className="form-label">アレルギー：</label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => handleInputChange("allergies", e.target.value)}
              className="form-input"
              placeholder="卵、牛乳"
            />
          </div>

          {/* 嫌いな食べ物 */}
          <div className="form-group">
            <label className="form-label">嫌いな食べ物：</label>
            <input
              type="text"
              value={formData.dislikedFoods}
              onChange={(e) => handleInputChange("dislikedFoods", e.target.value)}
              className="form-input"
              placeholder="ピーマン、にんじん"
            />
          </div>

          {/* 運動頻度 */}
          <div className="form-group">
            <label className="form-label">運動量：</label>
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
          </div>

          {/* その他運動頻度 */}
          {formData.exerciseFrequency === "そのほか" && (
            <div className="form-group">
              <label className="form-label">運動量（詳細）：</label>
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
      </section>

      {/* ボトムナビゲーション */}
      <nav className="bottom-nav">
        <button className="nav-item" onClick={handleBackToHome}>
          <div className="nav-icon home-icon"></div>
        </button>
        <button className="nav-item" onClick={() => console.log("meal clicked")}>
          <div className="nav-icon meal-icon"></div>
        </button>
        <button className="nav-item" onClick={() => console.log("calendar clicked")}>
          <div className="nav-icon calendar-icon"></div>
        </button>
        <button className="nav-item active" onClick={() => console.log("settings clicked")}>
          <div className="nav-icon settings-icon"></div>
        </button>
      </nav>
    </div>
  );
}
