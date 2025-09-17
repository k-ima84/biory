"use client";

import { useRouter } from "next/navigation";
import "./biory/login/login.css";

export default function HomePage() {
  const router = useRouter();

  const handleLoginClick = () => {
    router.push("/biory/login/");
  };

  return (
    <main className="login-container">
      <div className="login-box">
        {/* ログインボタン */}
        <div className="login-form">
          <button onClick={handleLoginClick} className="login-button">
            こちらからアクセスしてください
          </button>
        </div>
      </div>
    </main>
  );
}
