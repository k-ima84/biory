# Bedrock直接呼び出し実装ガイド

## 概要

このドキュメントは、API GatewayとLambdaを経由せず、フロントエンドから直接Amazon Bedrockを呼び出す実装について説明します。

## 実装内容

### 1. 必要なパッケージのインストール

```bash
npm install @aws-sdk/client-bedrock-runtime --legacy-peer-deps
```

### 2. 実装ファイル

#### `lib/bedrockClient.ts`（新規作成）

フロントエンドから直接Bedrockを呼び出すためのクライアントユーティリティ。

**主な機能:**
- Amplify認証セッションから認証情報を自動取得
- プロンプト生成（`index.py`のロジックを移植）
- Bedrock API呼び出し
- レスポンスのパース
- フォールバック献立の生成

**主要関数:**
- `getMealSuggestion()`: 献立提案のメイン関数
- `createMealPrompt()`: プロンプト作成
- `parseMealSuggestion()`: AIレスポンスのパース
- `createDefaultMeals()`: フォールバック献立の生成

#### `app/biory/meal/page.tsx`（更新）

献立提案画面のコンポーネント。

**変更点:**
- `getMealSuggestion()`を使用してBedrock APIを直接呼び出し
- API Gateway経由のコードを削除
- エラーハンドリングの改善

#### `amplify/auth/resource.ts`（更新）

認証リソースにBedrockへのアクセス権限を追加。

```typescript
access: (allow) => [
  allow.resource("arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.titan-text-express-v1")
    .to(["bedrock:InvokeModel"]),
],
```

#### `amplify/backend.ts`（更新）

IAMポリシーを追加して、認証済みユーザーがBedrockを呼び出せるように設定。

```typescript
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:ap-northeast-1::foundation-model/amazon.titan-text-express-v1',
    ],
  })
);
```

## アーキテクチャ

### Before（旧実装）
```
フロントエンド → API Gateway → Lambda → Bedrock
```

### After（新実装）
```
フロントエンド → Bedrock（直接）
```

## 実装の利点

1. **シンプルさ**: API GatewayとLambdaの設定・管理が不要
2. **レスポンス速度**: 中間層がないため、レスポンスが高速
3. **コスト削減**: API GatewayとLambdaの料金が不要
4. **デバッグの容易さ**: ブラウザのコンソールで直接デバッグ可能

## セキュリティ考慮事項

### 実装済み
- ✅ Cognito認証済みユーザーのみがBedrockを呼び出し可能
- ✅ IAMポリシーで特定のBedrockモデルのみに制限
- ✅ リージョンを`ap-northeast-1`に固定

### 今後の改善点（本番運用時）
- ⚠️ レート制限の実装（クライアント側）
- ⚠️ コスト監視の設定（CloudWatch Alarms）
- ⚠️ プロンプトインジェクション対策
- ⚠️ ユーザーごとの使用量制限

## デプロイ手順

1. **コードのビルド**
   ```bash
   npm run build
   ```

2. **Amplifyバックエンドのデプロイ**
   ```bash
   npx ampx sandbox
   # または
   npx ampx deploy
   ```

3. **動作確認**
   - ログインして献立画面へ移動
   - 「献立を提案してもらう」ボタンをクリック
   - ブラウザのコンソールで以下のログを確認:
     - `🚀 献立生成開始（Bedrock直接呼び出し）`
     - `🤖 BEDROCK REQUEST START`
     - `✅ BEDROCK RESPONSE RECEIVED`
     - `✅ SUCCESS: Using AI-generated meals`

## トラブルシューティング

### エラー: "Access Denied"

**原因**: IAMポリシーが正しく適用されていない

**解決方法**:
1. `amplify/backend.ts`の設定を確認
2. `npx ampx sandbox`を再起動
3. ブラウザでリロード（認証情報をリフレッシュ）

### エラー: "Model not found"

**原因**: Bedrockモデルが有効化されていない

**解決方法**:
1. AWSコンソールでBedrockサービスへ移動
2. Model access → Manage model access
3. `amazon.titan-text-express-v1`を有効化

### エラー: "fetchAuthSession is not defined"

**原因**: AWS Amplify SDKのバージョンが古い

**解決方法**:
```bash
npm install aws-amplify@latest
```

## index.pyとの対応表

| index.py の関数 | bedrockClient.ts の関数 | 説明 |
|----------------|------------------------|------|
| `create_meal_prompt()` | `createMealPrompt()` | プロンプト生成 |
| `parse_meal_suggestion()` | `parseMealSuggestion()` | レスポンスパース |
| `create_default_meals()` | `createDefaultMeals()` | フォールバック献立 |
| `handler()` | `getMealSuggestion()` | メイン処理 |

## 参考リンク

- [AWS SDK for JavaScript v3 - Bedrock Runtime](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-bedrock-runtime/)
- [AWS Amplify Gen2 - Auth](https://docs.amplify.aws/gen2/build-a-backend/auth/)
- [Amazon Bedrock - Titan Text Models](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-text-models.html)

## まとめ

この実装により、API GatewayとLambdaを使用せず、フロントエンドから直接Amazon Bedrockを呼び出すことができるようになりました。`index.py`と同等の機能を提供しつつ、よりシンプルで保守しやすいアーキテクチャとなっています。
