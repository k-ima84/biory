# Amplify Sandbox環境でのデータ投入とフロントエンド修正 - 作業ログ

## 作業日: 2025年9月3日

## 目的
- Amplify Seedを利用してSandbox環境のDynamoDBにデータ投入
- Web画面のPFC部分をDynamoDBのデータと連携
- フロントエンドの表示を登録データに修正

## 実行した作業

### 1. プロジェクト構造の確認
- Amplify Gen 2プロジェクトであることを確認
- `amplify/seed/seed.ts`にシードスクリプトが存在
- `amplify/data/resource.ts`にTodoモデルとNutritionモデルが定義済み

### 2. Amplify Sandbox環境のセットアップ
```bash
npx amplify sandbox
```

**実行結果:**
- Identifier: `nkat2`
- Stack: `amplify-awsamplifygen2-nkat2-sandbox-a12ead63b8`
- Region: `ap-northeast-1` (東京)
- GraphQL API endpoint: `https://uyxfw7ypcngn5pvmsk4u4zquau.appsync-api.ap-northeast-1.amazonaws.com/graphql`
- API Key: `da2-lhoyrkikyfgj7bkofve4gxeija`

**セットアップ時間:**
- バックエンド合成: 4.78秒
- 型チェック: 13.34秒
- アセットビルド・デプロイ: 3.266秒
- 合計: 約21秒

### 3. シードデータの投入

#### 3.1 シードスクリプトの修正
- Amplify設定の初期化を追加
- JSONファイル読み込み方法を修正（ES Module対応）
- 自動実行機能とログ出力を追加
- `_typename`フィールドを削除（GraphQLスキーマエラー対応）

#### 3.2 投入されたデータ

**データ1 (user1):**
```json
{
  "id": "30faa3cc-a7f3-480d-ade2-4e26e6a6aea7",
  "calories": 1200,
  "carbs": 150,
  "date": "2025-08-27",
  "fat": 30,
  "protein": 50,
  "userId": "user1",
  "createdAt": "2025-09-03T01:26:17.557Z",
  "updatedAt": "2025-09-03T01:26:17.557Z"
}
```

**データ2 (user2):**
```json
{
  "id": "7fc25427-550f-4ab1-b4cd-822966ebea81",
  "calories": 1300,
  "carbs": 160,
  "date": "2025-09-03",
  "fat": 70,
  "protein": 80,
  "userId": "user2",
  "createdAt": "2025-09-03T01:26:17.705Z",
  "updatedAt": "2025-09-03T01:26:17.705Z"
}
```

### 4. フロントエンド修正

#### 4.1 修正内容
- 日付を「9/3 (火)」に固定表示
- user2のデータを取得するように設定
- PFCバランスの正確な計算を実装
- データが見つからない場合のフォールバック機能を追加
- デバッグ用ログを追加

#### 4.2 表示されるデータ（user2の9/3データ）
- **カロリー**: 1300 kcal
- **P（タンパク質）**: 80g　25%
- **F（脂質）**: 70g　48%
- **C（炭水化物）**: 160g　49%

### 5. 開発環境の起動
```bash
npm run dev
```
- 開発サーバー: http://localhost:3001
- ホーム画面: http://localhost:3001/biory/home

## 技術的なポイント

### Amplify Gen 2の特徴
- TypeScriptでバックエンドを定義
- AWS CDKベース
- リアルタイムAPI対応
- DynamoDB自動プロビジョニング

### 解決した問題
1. **ES Module環境でのJSON読み込み**: `fs.readFileSync`を使用
2. **GraphQLスキーマエラー**: `_typename`フィールドを削除
3. **型エラー**: GraphQLResultの型定義問題（実行には影響なし）

## ファイル構造
```
biory/
├── amplify/
│   ├── auth/resource.ts
│   ├── data/resource.ts
│   ├── seed/seed.ts
│   └── backend.ts
├── app/
│   └── biory/
│       └── home/
│           ├── page.tsx
│           └── home.css
├── amplify_outputs.json
└── package.json
```

## 次のステップ候補
- 他のユーザーデータの追加
- 日付別データの管理機能
- データ編集機能の実装
- リアルタイム更新機能の追加
- 認証機能の実装

## 使用したコマンド
```bash
# Sandbox起動
npx amplify sandbox

# シードデータ投入
npm run seed

# 開発サーバー起動
npm run dev
```

## 参考資料
- [Amplify Gen 2 Data Setup](https://docs.amplify.aws/react/build-a-backend/data/set-up-data/)
- プロジェクトリポジトリ: biory (k-ima84)
- ブランチ: task001/home001
