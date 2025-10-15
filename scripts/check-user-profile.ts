import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json" with { type: "json" };
import type { Schema } from "../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function checkUserProfile() {
  try {
    console.log("=== ユーザープロフィール確認 ===");
    
    // 全てのUserProfileを取得
    const { data: profiles } = await client.models.UserProfile.list();
    
    if (profiles && profiles.length > 0) {
      console.log(`UserProfile レコード数: ${profiles.length}`);
      profiles.forEach((profile, index) => {
        console.log(`\n--- プロフィール ${index + 1} ---`);
        console.log(`ID: ${profile.id}`);
        console.log(`ユーザーID: ${profile.userId}`);
        console.log(`氏名: ${profile.name || "未設定"}`);
        console.log(`身長: ${profile.height || "未設定"}cm`);
        console.log(`体重: ${profile.weight || "未設定"}kg`);
        console.log(`性別: ${profile.gender || "未設定"}`);
        console.log(`好きな食べ物: ${profile.favoriteFoods || "未設定"}`);
        console.log(`アレルギー: ${profile.allergies || "未設定"}`);
        console.log(`嫌いな食べ物: ${profile.dislikedFoods || "未設定"}`);
        console.log(`運動頻度: ${profile.exerciseFrequency || "未設定"}`);
        console.log(`運動頻度その他: ${profile.exerciseFrequencyOther || "未設定"}`);
        console.log(`作成日: ${profile.createdAt}`);
        console.log(`更新日: ${profile.updatedAt}`);
      });
    } else {
      console.log("UserProfile データが見つかりません。");
      console.log("\n解決方法:");
      console.log("1. 設定画面で情報を入力して保存してください");
      console.log("2. 認証が正しく行われているか確認してください");
    }
    
  } catch (error) {
    console.error("ユーザープロフィール確認エラー:", error);
  }
}

checkUserProfile();