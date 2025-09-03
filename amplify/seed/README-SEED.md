# Biory - 栄養管理アプリ

## 🚀 クイックスタート
```bash
# 1. 環境確認
npm run check:env

# 2. データ投入
npm run seed:all

# 3. 確認
npm run test:db
```

---

## セットアップ手順

### 1. 初回セットアップ
```bash
# 1. リポジトリクローン
git clone <repository-url>
cd biory

# 2. 依存関係のインストール
npm install

# 3. AWS認証情報の設定
aws configure --profile biory-dev
# または、デフォルトプロファイルを使用する場合
aws configure

# 4. Amplifyサンドボックスの起動
AWS_PROFILE=biory-dev npx ampx sandbox
# または、デフォルトプロファイルの場合
npx ampx sandbox
```

サンドボックスが起動すると、`amplify_outputs.json`ファイルが自動生成されます。

### 2. 環境確認
```bash
# 環境が正しく設定されているかチェック
npm run check:env
```

このコマンドで以下の項目をチェックできます：
- `amplify_outputs.json`の存在
- AWS認証情報の設定
- GraphQL API エンドポイントの確認
- 必要なパッケージの存在

## シードデータの投入

### 推奨方法: npm scripts を使用
```bash
# 全データを投入（栄養データ + 食事データ）
npm run seed:all

# 栄養データのみ投入
npm run seed:nutrition

# 食事データのみ投入  
npm run seed:meal

# データベースの状態確認
npm run test:db

# データベースをクリア
npm run clear:db
```

### AWSプロファイルを指定する場合
```bash
# 特定のプロファイルを使用
AWS_PROFILE=biory-dev npm run seed:all
AWS_PROFILE=biory-dev npm run test:db
```

## 投入されるデータ

### 栄養データ（3件）
- **user1 (2025-08-27)**: カロリー1200, タンパク質50g, 脂質30g, 炭水化物150g
- **user1 (2025-09-02)**: カロリー1250, タンパク質60g, 脂質35g, 炭水化物155g  
- **user2 (2025-09-03)**: カロリー1300, タンパク質80g, 脂質70g, 炭水化物160g

### 食事データ（8件）
- **user1**: 朝食・昼食・夕食（2025-08-27, 2025-09-02）
- **user2**: 朝食・昼食・夕食（2025-09-03）

## 開発サーバーの起動
```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## トラブルシューティング

### ❌ エラー: "amplify_outputs.json not found"
**原因**: Amplifyサンドボックスが起動していない

**解決方法**:
```bash
# サンドボックスを起動
npx ampx sandbox
```

### ❌ エラー: "AWS credentials not found"
**原因**: AWS認証情報が設定されていない

**解決方法**:
```bash
# AWS認証情報を設定
aws configure --profile biory-dev

# 設定確認
aws configure list --profile biory-dev
```

### ❌ エラー: "No data in database"  
**原因**: シードデータが投入されていない

**解決方法**:
```bash
# データベースの状態確認
npm run test:db

# シードデータ投入
npm run seed:all
```

### ❌ エラー: "GraphQL errors"
**原因**: サンドボックスが正常に動作していない

**解決方法**:
```bash
# サンドボックスを再起動
npx ampx sandbox --once

# 環境チェック
npm run check:env
```

## ファイル構成
```
biory/
├── amplify/
│   └── seed/                      # 🎯 シードデータ関連ファイル（このディレクトリ）
│       ├── README-SEED.md         # 📖 使用方法とドキュメント（このファイル）
│       ├── common.ts              # ⚙️ 共通設定とユーティリティ
│       ├── seed-nutrition.ts      # 🥗 栄養データ投入
│       ├── seed-meal.ts          # 🍽️ 食事データ投入  
│       ├── seed-all.ts           # 📦 全データ一括投入
│       ├── test-db-connection.ts  # 🔍 データベース接続テスト
│       ├── clear-db.ts           # 🧹 データベースクリア
│       ├── check-env.ts          # ✅ 環境チェック
│       └── seed.ts               # 📝 オリジナルのseedファイル
└── package.json                  # 📋 npm scripts定義
```

## 利用可能なnpm scripts

### 🎯 基本コマンド
```bash
# 🔧 環境チェック（最初に実行推奨）
npm run check:env

# 📦 全データ投入（栄養データ + 食事データ）
npm run seed:all

# 🔍 データベース状態確認
npm run test:db
```

### 🛠️ 個別操作コマンド
```bash
# 🥗 栄養データのみ投入
npm run seed:nutrition

# 🍽️ 食事データのみ投入  
npm run seed:meal

# 🧹 データベースを完全クリア
npm run clear:db
```

### 💡 AWSプロファイル指定
```bash
# 特定のプロファイルを使用する場合
AWS_PROFILE=biory-dev npm run check:env
AWS_PROFILE=biory-dev npm run seed:all
AWS_PROFILE=biory-dev npm run test:db
```

## 📋 各ファイルの詳細説明

| ファイル | 役割 | 使用場面 |
|---------|------|----------|
| `check-env.ts` | 環境チェック | セットアップ時、問題診断時 |
| `seed-all.ts` | 全データ投入 | 初回セットアップ、リセット時 |
| `seed-nutrition.ts` | 栄養データ投入 | 栄養データのみテスト時 |
| `seed-meal.ts` | 食事データ投入 | 食事データのみテスト時 |
| `test-db-connection.ts` | DB接続テスト | データ確認、問題診断時 |
| `clear-db.ts` | データクリア | 開発リセット、クリーンアップ |
| `common.ts` | 共通設定 | 他ファイルから利用 |

### 🔧 直接実行（上級者向け）
```bash
# プロジェクトルートから直接実行
tsx amplify/seed/check-env.ts
tsx amplify/seed/seed-all.ts
tsx amplify/seed/test-db-connection.ts

# seedディレクトリ内から実行
cd amplify/seed
tsx check-env.ts
tsx seed-all.ts
tsx test-db-connection.ts
```

## 🚀 推奨ワークフロー

### 🆕 初回セットアップ時
```bash
# 1. 環境確認
npm run check:env

# 2. 全データ投入
npm run seed:all

# 3. データ確認
npm run test:db

# 4. 開発開始
npm run dev
```

### 🔄 開発中のリセット
```bash
# 1. データクリア
npm run clear:db

# 2. 新しいデータ投入
npm run seed:all

# 3. 確認
npm run test:db
```

### 🐛 問題発生時の診断
```bash
# 1. 環境チェック
npm run check:env

# 2. データベース状態確認
npm run test:db

# 3. 必要に応じてリセット
npm run clear:db
npm run seed:all
```

## 使用技術
- **TypeScript**: 型安全なシードスクリプト
- **AWS Amplify Gen 2**: バックエンドインフラ
- **DynamoDB**: NoSQLデータベース
- **GraphQL**: API層

## 注意事項
- 各開発者は自分専用のサンドボックス環境を使用します
- サンドボックスは個人用のため、他の開発者のデータには影響しません
- 本番環境には影響しない安全な開発環境です
