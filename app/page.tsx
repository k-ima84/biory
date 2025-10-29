"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import "./biory/login/login.css";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/biory/login/");
  }, [router]);

  return (
    <main className="login-container">
      <div className="login-box">
        {/* ログイン画面に自動遷移中 */}
        <div className="login-form" style={{ textAlign: 'center' }}>
          <p>ログイン画面に移動しています...</p>
        </div>
      </div>
    </main>
  );
}
