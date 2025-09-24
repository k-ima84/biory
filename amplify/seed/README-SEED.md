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
aws configure --profile your-profile-name
# または、デフォルトプロファイルを使用する場合
aws configure

# 4. Amplifyサンドボックスの起動
AWS_PROFILE=your-profile-name npx ampx sandbox
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
# Biory - 栄養管理アプリ シードデータ管理

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

## 📋 利用可能なコマンド

### 🎯 基本コマンド
```bash
# 🔧 環境チェック（最初に実行推奨）
npm run check:env

# 📦 全データ投入（栄養データ + 日次記録データ）
npm run seed:all

# 🔍 データベース状態確認
npm run test:db
```

### 🛠️ 個別操作コマンド
```bash
# 🥗 栄養データのみ投入
npm run seed:nutrition

# 📝 日次記録データのみ投入  
npm run seed:dailyrecord

# 🧹 データベースを完全クリア
npm run clear:db
```

### 🔧 高度なデバッグ（開発者向け）
```bash
# 🔍 全テーブル詳細デバッグ（複数環境の場合など）
tsx amplify/seed/debug-tables.ts
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
aws configure --profile your-profile-name
# または、デフォルトプロファイルを使用する場合
aws configure

# 4. Amplifyサンドボックスの起動
AWS_PROFILE=your-profile-name npx ampx sandbox
# または、デフォルトプロファイルの場合
npx ampx sandbox
```

### 2. データ投入とテスト
```bash
# 環境チェック
npm run check:env

# データ投入
npm run seed:all

# 動作確認
npm run test:db
npm run dev  # http://localhost:3000
```

---

## 🔧 マルチ環境対応

### 自動環境検出機能
当プロジェクトのツールは、**チームメンバー各自のサンドボックス環境で自動的に正しく動作**するように設計されています：

- **プロファイル自動検出**: `AWS_PROFILE`環境変数またはデフォルトプロファイルを自動使用
- **リージョン自動検出**: `amplify_outputs.json`からリージョン情報を自動取得
- **テーブル自動特定**: Amplifyクライアントが実際に接続しているテーブルを動的に特定

### 安全な設計
- ✅ **ハードコーディングなし**: テーブル名やプロファイル名は一切固定されていません
- ✅ **データ件数照合**: Amplifyクライアントの結果とAWS CLIの結果を照合して正確性を保証
- ✅ **エラーハンドリング**: 各メンバーの環境差異に対応した堅牢なエラー処理

### AWSプロファイル指定
```bash
# 特定のプロファイルを使用する場合
AWS_PROFILE=your-profile npm run check:env
AWS_PROFILE=your-profile npm run seed:all
AWS_PROFILE=your-profile npm run test:db
```

---

## 投入されるデータ

### 栄養データ（3件）
- **user1 (2025-08-27)**: カロリー1200, タンパク質50g, 脂質30g, 炭水化物150g
- **user1 (2025-09-02)**: カロリー1250, タンパク質60g, 脂質35g, 炭水化物155g  
- **user2 (2025-09-03)**: カロリー1300, タンパク質80g, 脂質70g, 炭水化物160g

### 日次記録データ（8件）
- **user1**: 朝食・昼食・夕食（2025-08-27, 2025-09-17）+ 体調・気分・体重情報
- **user2**: 朝食・昼食・夕食（2025-09-17）+ 体調・気分・体重情報

各レコードには以下の情報が含まれます：
- **食事内容**: 朝食・昼食・夕食の詳細
- **体調**: 良好・普通など
- **気分**: 元気・普通・良いなど  
- **体重**: kg単位での記録

---

## 📁 ファイル構成と説明

```
amplify/seed/                      # 🎯 シードデータ管理ディレクトリ
├── README-SEED.md                 # 📖 このファイル（使用方法とドキュメント）
├── common.ts                      # ⚙️ 共通設定とユーティリティ
├── check-env.ts                   # ✅ 環境チェック
├── seed-nutrition.ts              # 🥗 栄養データ投入
├── seed-dailyrecord.ts            # 📝 日次記録データ投入  
├── seed-all.ts                    # 📦 全データ一括投入
├── test-db-connection.ts          # 🔍 データベース接続テスト
├── clear-db.ts                    # 🧹 データベースクリア
└── debug-tables.ts                # 🔧 高度なテーブルデバッグ
```

### 各ファイルの詳細

| ファイル | 役割 | 使用場面 | 実行方法 |
|---------|------|----------|----------|
| `check-env.ts` | 環境設定確認 | セットアップ時、問題診断時 | `npm run check:env` |
| `seed-all.ts` | 全データ投入 | 初回セットアップ、リセット時 | `npm run seed:all` |
| `seed-nutrition.ts` | 栄養データ投入 | 栄養データのみテスト時 | `npm run seed:nutrition` |
| `seed-dailyrecord.ts` | 日次記録データ投入 | 日次記録データのみテスト時 | `npm run seed:dailyrecord` |
| `test-db-connection.ts` | DB接続テスト・データ確認 | データ確認、問題診断時 | `npm run test:db` |
| `clear-db.ts` | データクリア | 開発リセット、クリーンアップ | `npm run clear:db` |
| `debug-tables.ts` | 詳細テーブル情報表示 | 複数テーブル環境のデバッグ | `tsx amplify/seed/debug-tables.ts` |
| `common.ts` | 共通設定・ログ機能 | 他ファイルから自動利用 | 直接実行不要 |

### 🔧 debug-tables.ts について
`debug-tables.ts`は、複雑な環境でのトラブルシューティング用の高度なツールです：

**使用場面:**
- 複数のDynamoDBテーブルが存在する場合
- 異なるプロファイル間でのテーブル状況比較
- AWS CLIとAmplifyクライアントの接続先不一致を調査
- 本格的なデバッグが必要な場合

**出力内容:**
- 全プロファイルのテーブル一覧
- 各テーブルのデータ件数詳細
- Amplifyクライアントの接続情報
- 現在の環境設定情報

**実行方法:**
```bash
# 高度なデバッグ実行
tsx amplify/seed/debug-tables.ts
```

---

## 🚀 推奨ワークフロー

### 🆕 初回セットアップ時
```bash
npm run check:env    # 環境確認
npm run seed:all     # 全データ投入
npm run test:db      # データ確認
npm run dev          # 開発開始
```

### 🔄 開発中のリセット
```bash
npm run clear:db     # データクリア
npm run seed:all     # 新しいデータ投入
npm run test:db      # 確認
```

### 🐛 問題発生時の診断
```bash
npm run check:env    # 環境チェック
npm run test:db      # データベース状態確認

# 複雑な問題の場合
tsx amplify/seed/debug-tables.ts
```

---

## トラブルシューティング

### ❌ エラー: "amplify_outputs.json not found"
**原因**: Amplifyサンドボックスが起動していない
**解決方法**: `npx ampx sandbox`

### ❌ エラー: "AWS credentials not found"
**原因**: AWS認証情報が設定されていない
**解決方法**: `aws configure`

### ❌ エラー: "No data in database"  
**原因**: シードデータが投入されていない
**解決方法**: `npm run seed:all`

### ❌ 複数テーブルで混乱している場合
**解決方法**: `tsx amplify/seed/debug-tables.ts` で詳細調査
npm run clear:db
npm run seed:all
```
## DynamoDBのテーブル名一覧取得
aws dynamodb list-tables --profile biory-dev --region ap-northeast-1


## 使用技術
- **TypeScript**: 型安全なシードスクリプト
- **AWS Amplify Gen 2**: バックエンドインフラ
- **DynamoDB**: NoSQLデータベース（DailyRecordテーブル、Nutritionテーブル）
- **GraphQL**: API層

## 注意事項
- 各開発者は自分専用のサンドボックス環境を使用します
- サンドボックスは個人用のため、他の開発者のデータには影響しません
- 本番環境には影響しない安全な開発環境です
