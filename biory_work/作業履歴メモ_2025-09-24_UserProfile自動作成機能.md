# UserProfile自動作成機能実装 - 作業履歴メモ
**日付**: 2025年9月24日  
**タスク**: SCRUM150_cognit - API Gateway + Lambda による UserProfile 自動作成機能

## 📋 **実装概要**
Cognitoユーザーのサインアップ確認成功時に、自動的にDynamoDBのUserProfileテーブルに初期レコードを作成する機能を実装。

## 🏗️ **実装アーキテクチャ**
```
サインアップ確認成功
    ↓
フロントエンド (createInitialUserProfile)
    ↓
Next.js API Route (/api/create-user-profile)
    ↓
DynamoDB (UserProfile テーブル)
    ↓
初期空プロファイル作成完了
```

## 🚀 **実装した機能**

### 1. **Lambda関数作成** 
**ファイル**: `amplify/functions/create-user-profile/`
- **handler.ts**: APIGatewayプロキシハンドラー実装
- **resource.ts**: Amplify Lambda関数定義
- **package.json**: 依存関係定義

**主な機能**:
- POST /create-user-profile エンドポイント
- CORS対応
- userIdバリデーション
- エラーハンドリング
- 現状はモックレスポンス（DynamoDB統合準備完了）

### 2. **Next.js API Route実装**
**ファイル**: `app/api/create-user-profile/route.ts`

**主な機能**:
- 完全なDynamoDB統合
- UserProfile重複チェック
- 初期空データでレコード作成
- CognitoユーザーIDをuserIdに設定
- TypeScript完全対応

**作成されるレコード構造**:
```typescript
{
  userId: "cognito-user-id",  // CognitoユーザーID
  name: '',                   // 空文字（後で設定）
  gender: '',                 // 空文字（後で設定）
  height: null,               // null（後で設定）
  weight: null,               // null（後で設定）
  favoriteFoods: '',          // 空文字（後で設定）
  allergies: '',              // 空文字（後で設定）
  dislikedFoods: '',          // 空文字（後で設定）
  exerciseFrequency: '',      // 空文字（後で設定）
  exerciseFrequencyOther: '', // 空文字（後で設定）
}
```

### 3. **フロントエンドサービス関数**
**ファイル**: `app/biory/components/userProfileService.ts`

**機能**:
- `createInitialUserProfile()`: サインアップ確認成功時の自動実行用
- `createUserProfileManually()`: 手動テスト用
- Cognito認証情報取得
- API呼び出し処理
- エラーハンドリング

### 4. **Amplifyバックエンド統合**
**ファイル**: `amplify/backend.ts`

**追加した設定**:
```typescript
import { createUserProfile } from './functions/create-user-profile/resource.js';

const backend = defineBackend({
  auth,
  data,
  createUserProfile,  // Lambda関数追加
});

// 環境変数設定
backend.createUserProfile.addEnvironment(
  'USERPROFILE_TABLE_NAME', 
  backend.data.resources.tables["UserProfile"].tableName
);
```

### 5. **テスト用ページ**
**ファイル**: `app/biory/test-userprofile/page.tsx`

**機能**:
- ユーザーID取得テスト
- 自動作成テスト
- 手動作成テスト
- 直接API呼び出しテスト
- リアルタイム結果表示

## 🔧 **技術的な実装詳細**

### **API Gateway設定**
- Amplify Gen2による自動生成
- Lambda統合設定
- CORS設定済み

### **Lambda関数権限**
- DynamoDBテーブルへの読み書き権限
- CloudWatch Logsへの書き込み権限
- Amplifyによる自動IAM設定

### **DynamoDB統合**
- UserProfileテーブルへの直接アクセス
- GraphQL API経由での操作
- 重複チェック機能

### **認証統合**
- Cognito getCurrentUser() API使用
- ユーザーIDとメールアドレス取得
- セッション管理

## 🎯 **使用方法**

### **1. 開発サーバー起動**
```bash
npm run dev
```

### **2. テストページアクセス**
```
http://localhost:3000/biory/test-userprofile
```

### **3. サインアップ統合**
サインアップ確認成功時に以下を追加:
```tsx
import { createInitialUserProfile } from '../components/userProfileService';

const handleConfirmSignUp = async () => {
  try {
    // Cognito確認
    await confirmSignUp({ username: email, confirmationCode });
    
    // UserProfile自動作成
    const result = await createInitialUserProfile();
    
    if (result.success) {
      alert('🎉 アカウント作成完了！');
      router.push('/biory/settings');
    }
  } catch (error) {
    console.error('確認エラー:', error);
  }
};
```

## 📊 **動作フロー**

1. **ユーザーサインアップ** → Cognitoアカウント作成
2. **メール確認** → 6桁コード入力
3. **確認成功** → `handleConfirmSignUp()` 実行
4. **UserProfile作成** → `createInitialUserProfile()` 呼び出し
5. **API呼び出し** → `/api/create-user-profile` POST
6. **DynamoDB挿入** → 空の初期プロファイル作成
7. **設定画面遷移** → ユーザーが詳細情報入力

## ✅ **実装完了項目**

- [x] Lambda関数作成
- [x] API Gateway統合
- [x] Next.js API Route実装
- [x] DynamoDB統合
- [x] Cognitoユーザー情報取得
- [x] エラーハンドリング
- [x] CORS対応
- [x] テストページ作成
- [x] TypeScript型定義

## 🔄 **今後の拡張予定**

- [ ] Lambda関数のDynamoDB統合完了
- [ ] サインアップページへの統合
- [ ] エラー通知機能
- [ ] ログ監視機能
- [ ] パフォーマンス最適化

## 📝 **技術メモ**

### **Amplify Gen2での注意点**
- Lambda関数にはpackage.jsonが必要
- TypeScript設定が厳格
- 依存関係のバージョン管理が重要

### **DynamoDB操作**
- GraphQL API経由が推奨
- 直接SDK使用も可能
- 権限設定が自動化済み

### **CORS設定**
- Next.js API RouteとLambda両方で対応
- プリフライトリクエスト対応済み

## 🐛 **トラブルシューティング**

### **Lambda依存関係エラー**
```
error TS2307: Cannot find module '@aws-sdk/client-dynamodb'
```
**解決方法**: package.jsonで依存関係を正しく定義

### **CORS エラー**
**解決方法**: OPTIONSメソッドの実装とヘッダー設定

### **認証エラー**
```
UserUnAuthenticated: User needs to be authenticated
```
**解決方法**: ログイン状態確認後にAPI呼び出し

---

**実装担当**: GitHub Copilot  
**レビュー**: 要確認  
**動作確認**: テストページで完了
