import { generateClient } from "aws-amplify/data";
import type { Schema } from "./amplify/data/resource";
import { Amplify } from "aws-amplify";
import outputs from "./amplify_outputs.json";

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function debugUserProfile() {
  const userId = "47148a78-90d1-700c-31cc-5fc3a69b7cc8";
  
  try {
    // 既存のユーザープロファイルを確認
    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } }
    });
    
    console.log("既存のユーザープロファイル:", profiles);
    
    if (profiles.length === 0) {
      // ユーザープロファイルが存在しない場合は作成
      const newProfile = await client.models.UserProfile.create({
        userId: userId,
        name: "テストユーザー",
        height: 170.0,
        weight: 65.0,
        gender: "男",
        favoriteFoods: "和食、魚料理",
        allergies: "なし",
        dislikedFoods: "辛い食べ物",
        exerciseFrequency: "週2-3回",
        exerciseFrequencyOther: ""
      });
      
      console.log("新しいユーザープロファイルを作成:", newProfile);
    }
    
  } catch (error) {
    console.error("エラー:", error);
  }
}

debugUserProfile();