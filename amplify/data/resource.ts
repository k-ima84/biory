import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  
  Nutrition: a
    .model({
      userId: a.string(),
      date: a.string(),
      calories: a.integer(),
      protein: a.float(),
      fat: a.float(),
      carbs: a.float(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  DailyRecord: a
    .model({
      userId: a.string(),
      date: a.string(),
      mealType: a.string(), // breakfast, lunch, dinner
      content: a.string(),
      condition: a.string(), // 体調
      mood: a.string(), // 気分
      weight: a.float(), // 体重 (kg)
    })
    .authorization((allow) => [allow.publicApiKey()]),

  UserProfile: a
    .model({
      userId: a.string().required(),
      // email: a.string(),
      name: a.string(),
      height: a.float(), // xxx.xx cm
      weight: a.float(), // xx.xx kg
      gender: a.string(), // 女・男・そのほか
      favoriteFoods: a.string(), // 好きな食べ物（自由入力）
      allergies: a.string(), // アレルギー情報
      dislikedFoods: a.string(), // 嫌いな食べ物（自由入力）
      exerciseFrequency: a.string(), // 運動頻度（選択式）
      exerciseFrequencyOther: a.string(), // その他を選択した場合の自由入力
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
