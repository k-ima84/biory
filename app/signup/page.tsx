"use client";

import { useState } from "react";
import { Amplify } from "aws-amplify";
import { signUp, confirmSignUp } from "aws-amplify/auth";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "../login.css";

Amplify.configure(outputs);

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState("signup"); // 'signup' or 'verify'

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      setIsLoading(false);
      return;
    }

    try {
      await signUp({
        username: email,
        password: password,
        options: {
          userAttributes: {
            email: email,
          },
        },
      });
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "アカウント作成に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: verificationCode,
      });
      alert("アカウントが作成されました！ログイン画面に移動します。");
      window.location.href = "/";
    } catch (err: any) {
      setError("認証コードが正しくありません。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-container">
      <div className="login-box">
        {/* ロゴとアプリ名 */}
        <div className="logo-section">
          <div className="logo-icons">
            <div className="brain-icon">
              <div className="brain-shape">
                <div className="brain-top"></div>
                <div className="brain-body">
                  <div className="face">
                    <div className="eye left"></div>
                    <div className="eye right"></div>
                    <div className="smile"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="exercise-icon">
              <div className="person-shape">
                <div className="head"></div>
                <div className="body">
                  <div className="face">
                    <div className="eye left"></div>
                    <div className="eye right"></div>
                    <div className="smile"></div>
                  </div>
                  <div className="arm left"></div>
                  <div className="arm right">
                    <div className="dumbbell"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <h1 className="app-name">biory</h1>
          <p className="app-subtitle">バイオリー</p>
          <p className="app-description">
            ごはんとカラダ、今日もいい感じ。<br />
            毎日の"ちょうどいい"をつくるアプリ
          </p>
        </div>

        {step === "signup" ? (
          <form onSubmit={handleSignUp} className="login-form">
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
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">パスワード（確認）</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="form-input"
                minLength={8}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={isLoading} className="login-button">
              {isLoading ? "作成中..." : "アカウント作成"}
            </button>

            <div style={{ textAlign: "center", marginTop: "15px" }}>
              <a href="/" style={{ color: "#20B2AA", fontSize: "14px" }}>
                ログイン画面に戻る
              </a>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerification} className="login-form">
            <p style={{ marginBottom: "20px", color: "#8B5A3C" }}>
              {email} に認証コードを送信しました。<br />
              受信したコードを入力してください。
            </p>

            <div className="form-group">
              <label htmlFor="verificationCode">認証コード</label>
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                className="form-input"
                placeholder="6桁のコードを入力"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={isLoading} className="login-button">
              {isLoading ? "認証中..." : "認証"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
