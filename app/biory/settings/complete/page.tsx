/*20250924_こちらは不要なので、Feature004へマージする際に削除予定*/

/*"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BioryLayout from "../../components/BioryLayout";

export default function SettingsCompletePage() {
  const router = useRouter();

  useEffect(() => {
    // 3秒後に自動でホーム画面に戻る
    const timer = setTimeout(() => {
      router.push("/biory/home");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleBackToHome = () => {
    router.push("/biory/home");
  };

  const handleBackToSettings = () => {
    router.push("/biory/settings");
  };

  return (
    <BioryLayout>
      {/* 完了メッセージ }
      <div className="complete-content">
        <div className="success-icon">✓</div>
        <h2 className="complete-title">ユーザー情報登録完了</h2>
        <p className="complete-message">
          ユーザー情報の登録が完了しました。<br />
          ありがとうございます！
        </p>
        <p className="auto-redirect-message">
          3秒後に自動でホーム画面に戻ります...
        </p>
      </div>

      {/* ボタン }
      <div className="complete-buttons">
        <button className="complete-button primary" onClick={handleBackToHome}>
          ホーム画面に戻る
        </button>
        <button className="complete-button secondary" onClick={handleBackToSettings}>
          設定画面に戻る
        </button>
      </div>

      <style jsx>{`
        .complete-content {
          text-align: center;
          background-color: white;
          padding: 40px 30px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          width: 100%;
          margin: 50px auto 0;
        }

        .success-icon {
          font-size: 60px;
          color: #4CAF50;
          margin-bottom: 20px;
          background-color: #e8f5e8;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .complete-title {
          font-size: 20px;
          font-weight: bold;
          color: #333;
          margin: 0 0 15px 0;
        }

        .complete-message {
          font-size: 16px;
          color: #666;
          line-height: 1.5;
          margin: 0 0 20px 0;
        }

        .auto-redirect-message {
          font-size: 14px;
          color: #999;
          margin: 0;
        }

        .complete-buttons {
          margin-top: 30px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          width: 100%;
          max-width: 300px;
          margin-left: auto;
          margin-right: auto;
        }

        .complete-button {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .complete-button.primary {
          background-color: #4CAF50;
          color: white;
        }

        .complete-button.primary:hover {
          background-color: #45a049;
        }

        .complete-button.secondary {
          background-color: white;
          color: #4CAF50;
          border: 2px solid #4CAF50;
        }

        .complete-button.secondary:hover {
          background-color: #f0f8f0;
        }

        @media (max-width: 480px) {
          .complete-content {
            padding: 30px 20px;
          }
          
          .complete-buttons {
            max-width: 280px;
          }
        }
      `}</style>
    </BioryLayout>
  );
}*/

