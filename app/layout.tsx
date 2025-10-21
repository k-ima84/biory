"use client";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";

const inter = Inter({ subsets: ["latin"] });

// Amplify設定をモジュールレベルで実行（コンポーネントの外）
Amplify.configure(outputs, { ssr: true });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
