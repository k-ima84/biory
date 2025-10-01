"use client";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import { useEffect } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    Amplify.configure(outputs);
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
