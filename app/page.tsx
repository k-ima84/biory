"use client";

import { useState } from "react";
import { Amplify } from "aws-amplify";
import { signIn } from "aws-amplify/auth";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "./login.css";

Amplify.configure(outputs);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signIn({
        username: email,
        password: password,
      });
      // ログイン成功時の処理（ホーム画面への遷移など）
      window.location.href = "/home";
    } catch (err: any) {
      setError("ログインに失敗しました。IDまたはパスワードが正しくありません。");
    } finally {
      setIsLoading(false);
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
            <a href="/signup" style={{ color: "#20B2AA", fontSize: "14px" }}>
              アカウントをお持ちでない方はこちら
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
