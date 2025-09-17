"use client";
 
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import "./layout.css";
 
interface LayoutProps {
  children: React.ReactNode;
}
 
export default function BioryLayout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentPath, setCurrentPath] = useState(pathname);
 
  // パスの変更を監視して強制的に再レンダリング
  useEffect(() => {
    setCurrentPath(pathname);
    console.log("Path changed:", pathname);
  }, [pathname]);
 
  // デバッグ用：現在のパスを確認
  console.log("Current pathname:", currentPath);
 
  const handleNavClick = (section: string) => {
    switch (section) {
      case "home":
        router.push("/biory/home");
        break;
      case "meal":
        router.push("/biory/meal");
        break;
      case "calendar":
        console.log("カレンダー画面へ遷移"); // 今後実装
        break;
      case "settings":
        router.push("/biory/settings");
        break;
      default:
        break;
    }
  };
 
  const isActive = (section: string) => {
    let active = false;
    switch (section) {
      case "home":
        active = currentPath === "/biory/home";
        break;
      case "meal":
        active = currentPath === "/biory/meal";
        break;
      case "settings":
        active = currentPath.startsWith("/biory/settings");
        break;
      default:
        active = false;
    }
    // デバッグ用：アクティブ状態を確認
    console.log(`Section: ${section}, Active: ${active}, CurrentPath: ${currentPath}`);
    return active;
  };
 
  return (
    <div className="biory-layout">
      {/* ヘッダー */}
      <header className="biory-header">
        <h1 className="biory-logo">biory</h1>
      </header>
 
      {/* メインコンテンツ */}
      <main className="biory-main">
        {children}
      </main>
 
      {/* ボトムナビゲーション */}
      <nav className="biory-bottom-nav">
        <button
          className={`nav-item ${isActive("home") ? "active" : ""}`}
          onClick={() => handleNavClick("home")}
        >
          <div className="nav-icon home-icon"></div>
        </button>
        <button
          className={`nav-item ${isActive("meal") ? "active" : ""}`}
          onClick={() => handleNavClick("meal")}
        >
          <div className="nav-icon meal-icon"></div>
        </button>
        <button
          className="nav-item"
          onClick={() => handleNavClick("calendar")}
        >
          <div className="nav-icon calendar-icon"></div>
        </button>
        <button
          className={`nav-item ${isActive("settings") ? "active" : ""}`}
          onClick={() => handleNavClick("settings")}
        >
          <div className="nav-icon settings-icon"></div>
        </button>
      </nav>
    </div>
  );
}
 
 