import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

//小澤追記
import { kondateAIFunctionHandler } from "../backend/function/kondateAI/resource"
import { mealAnalysisFunctionHandler } from "../backend/function/mealAnalysis/resource"


/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
export const schema = a.schema({
  //小澤追記
  kondateAI: a
    .query()
    .arguments({
      name: a.string(),
      allergies: a.string(),
    })
    .returns(a.string())
    //.authorization((allow) => [allow.authenticated()]) // 認証ルール追加
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(kondateAIFunctionHandler)),

  mealAnalysis: a
    .query()
    .arguments({
      mealItems: a.string().array(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(mealAnalysisFunctionHandler)),


  // 既存のユーザープロファイルモデル
  UserProfile: a
    .model({
      userId: a.string().required(),
      name: a.string(),
      email: a.string(),
      age: a.integer(),
      gender: a.string(),
      height: a.float(),
      weight: a.float(),
      activityLevel: a.string(),
      goalType: a.string(),
      targetWeight: a.float(),
      // 設定画面で使用するフィールドを追加
      favoriteFoods: a.string(),
      allergies: a.string(),
      dislikedFoods: a.string(),
      exerciseFrequency: a.string(),
      exerciseFrequencyOther: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // 既存の食事記録モデル
  Meal: a
    .model({
      userId: a.string().required(),
      date: a.string().required(),
      mealType: a.enum(["breakfast", "lunch", "dinner"]),
      content: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // 既存の栄養記録モデル
  Nutrition: a
    .model({
      userId: a.string().required(),
      date: a.string().required(),
      calories: a.integer(),
      protein: a.float(),
      fat: a.float(),
      carbs: a.float(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // 既存の健康記録モデル
  HealthRecord: a
    .model({
      userId: a.string().required(),
      date: a.string().required(),
      condition: a.string(),
      mood: a.string(),
      weight: a.float(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // 【新規追加】食品栄養データベースモデル
  FoodNutrition: a
    .model({
      foodId: a.integer(), // 食品名（検索キー）
      foodName: a.string().required(), // 食品名（検索キー）
      energyKj: a.integer(), // エネルギー(KJ)
      energyKcal: a.integer().required(), // エネルギー(Kcal)
      water: a.float(), // 水分(g)
      protein: a.float().required(), // たんぱく質(g)
      fat: a.float().required(), // 脂質(g)
      carbs: a.float().required(), // 炭水化物(g)
      per100g: a.boolean().default(true), // 100gあたりの値かどうか
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // 【新規追加】DailyRecordモデル - すべてのデータを統合
  DailyRecord: a
    .model({
      userId: a.string().required(),
      date: a.string().required(),

      // 食事関連
      breakfast: a.string(),
      lunch: a.string(),
      dinner: a.string(),

      // 朝食栄養関連
    　calories_bre: a.integer(),
    　protein_bre: a.float(),
    　fat_bre: a.float(),
    　carbs_bre: a.float(),

    　// 昼食栄養関連
    　calories_lun: a.integer(),
    　protein_lun: a.float(),
    　fat_lun: a.float(),
    　carbs_lun: a.float(),

    　// 夕食栄養関連
    　calories_din: a.integer(),
    　protein_din: a.float(),
    　fat_din: a.float(),
    　carbs_din: a.float(),

    

      // 健康関連
      condition: a.string(),
      mood: a.string(),
      weight: a.float(),

      // メタデータ
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
