"use client";

import { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import { signIn, signOut } from "aws-amplify/auth";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "./login.css";

Amplify.configure(outputs);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ページ読み込み時に既存のセッションをクリア
  useEffect(() => {
    const clearSession = async () => {
      try {
        await signOut();
      } catch (error) {
        // サインアウトに失敗しても問題なし（ログインしていない場合など）
        console.log("初期サインアウト:", error);
      }
    };
    clearSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // まず既存のセッションをクリア
      try {
        await signOut();
      } catch (signOutError) {
        // サインアウトに失敗しても続行
        console.log("サインアウト処理:", signOutError);
      }

      const result = await signIn({
        username: email,
        password: password,
      });
      console.log("ログイン結果:", result);
      // ログイン成功時の処理（ホーム画面への遷移など）
      window.location.href = "/biory/home";
    } catch (err: any) {
      console.error("ログインエラー:", err);
      if (err.name === 'UserNotConfirmedException') {
        setError("メールアドレスの認証が完了していません。メールを確認してください。");
      } else if (err.name === 'NotAuthorizedException') {
        setError("メールアドレスまたはパスワードが正しくありません。");
      } else if (err.name === 'UserNotFoundException') {
        setError("このメールアドレスは登録されていません。");
      } else {
        setError(`ログインエラー: ${err.message || 'IDまたはパスワードが正しくありません'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSession = async () => {
    try {
      await signOut();
      setError("");
      alert("セッションをクリアしました。再度ログインしてください。");
    } catch (error) {
      console.log("セッションクリアエラー:", error);
      alert("セッションクリア完了");
    }
  };

  return (
    <main className="login-container">
      <div className="login-box">
        {/* ロゴとアプリ名 */}
        <div className="logo-section">
          <img src="/logo.svg" alt="Biory Logo" className="logo-image" />
          <h1 className="app-name">Biory</h1>
          <p className="app-subtitle">バイオリー</p>
          <p className="app-description">
            ごはんとカラダ、今日もいい感じ。<br />
            毎日の"ちょうどいい"をつくるアプリ
          </p>
        </div>

        {/* ログインフォーム */}
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">ID（メールアドレス）</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={isLoading} className="login-button">
            {isLoading ? "ログイン中..." : "ログイン"}
          </button>

          <div style={{ textAlign: "center", marginTop: "15px" }}>
            <a href="/biory/signup" style={{ color: "#20B2AA", fontSize: "14px" }}>
              アカウントをお持ちでない方はこちら
            </a>
          </div>

          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <button 
              type="button" 
              onClick={handleClearSession}
              style={{ 
                background: "none", 
                border: "none", 
                color: "#999", 
                fontSize: "12px", 
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              セッションをクリア
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
