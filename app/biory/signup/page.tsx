"use client";

import { useState } from "react";
import { Amplify } from "aws-amplify";
import { signUp, confirmSignUp } from "aws-amplify/auth";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "../login/login.css";

Amplify.configure(outputs);

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState("signup"); // 'signup' or 'verify'
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // エラーをクリア
    setError("");
    setFieldErrors({});
    
    // カスタムバリデーション
    const newFieldErrors: {[key: string]: string} = {};
    
    if (!email) {
      newFieldErrors.email = "メールアドレスを入力してください";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      newFieldErrors.email = "有効なメールアドレスを入力してください";
    }
    
    if (!password) {
      newFieldErrors.password = "パスワードを入力してください";
    } else if (password.length < 8) {
      newFieldErrors.password = "パスワードは8文字以上で入力してください";
    }
    
    if (!confirmPassword) {
      newFieldErrors.confirmPassword = "確認用パスワードを入力してください";
    } else if (password !== confirmPassword) {
      newFieldErrors.confirmPassword = "パスワードが一致しません";
    }
    
    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      return;
    }
    
    setIsLoading(true);

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
    
    // エラーをクリア
    setError("");
    setFieldErrors({});
    
    // カスタムバリデーション
    if (!verificationCode || verificationCode.length !== 6) {
      setFieldErrors({ verificationCode: "6桁の認証コードを入力してください" });
      return;
    }
    
    setIsLoading(true);

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: verificationCode,
      });
      setError("アカウントが作成されました！ログイン画面に移動します。");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
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
          <img src="/logo.png" alt="Biory Logo" className="logo-image" />
          <h1 className="app-name">biory</h1>
          <p className="app-subtitle">バイオリー</p>
          <p className="app-description">
            ごはんとカラダ、今日もいい感じ。<br />
            毎日の"ちょうどいい"をつくるアプリ
          </p>
        </div>

        {step === "signup" ? (
          <form onSubmit={handleSignUp} className="login-form">
            {/* 全体エラーメッセージ */}
            {error && (
              <div className={`error-message ${error ? 'show' : ''}`}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">ID（メールアドレス）</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                title="メールアドレスに「@」を挿入してください。"
                placeholder="example@email.com"
              />
              {fieldErrors.email && (
                <div className="field-error">{fieldErrors.email}</div>
              )}
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
                title="8文字以上入力してください。"
                placeholder="8文字以上のパスワード"
              />
              {fieldErrors.password && (
                <div className="field-error">{fieldErrors.password}</div>
              )}
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
                title="8文字以上入力してください。"
                placeholder="パスワードを再入力"
              />
              {fieldErrors.confirmPassword && (
                <div className="field-error">{fieldErrors.confirmPassword}</div>
              )}
            </div>

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
            {/* 全体エラーメッセージ */}
            {error && (
              <div className={`error-message ${error ? 'show' : ''}`}>
                {error}
              </div>
            )}

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
                minLength={6}
                maxLength={6}
                title="6桁の認証コードを入力してください。"
              />
              {fieldErrors.verificationCode && (
                <div className="field-error">{fieldErrors.verificationCode}</div>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="login-button">
              {isLoading ? "認証中..." : "認証"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
