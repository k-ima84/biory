import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { useRouter } from "next/navigation";
import React from 'react';

// Cognitoユーザー情報の型定義
export interface CognitoUserInfo {
  userId: string;
  email?: string;
//  preferredUsername?: string;
//  name?: string;
//  displayName: string;
}

// エラーハンドリング用の型定義
export interface CognitoError {
  error: Error;
  isAuthError: boolean;
}

/**
 * Cognitoからユーザー情報を取得する共通関数
 * @returns Promise<CognitoUserInfo> ユーザー情報オブジェクト
 * @throws {CognitoError} 認証エラーまたはその他のエラー
 */
export const fetchCognitoUserInfo = async (): Promise<CognitoUserInfo> => {
  try {
    // 現在認証されているユーザーの情報を取得
    const user = await getCurrentUser();
    const userId = user.userId; // CognitoのユニークなユーザーID (sub)
    
    // ユーザーの属性（メールアドレスなど）を取得
    const userAttributes = await fetchUserAttributes();
    const email = userAttributes.email || "";
    /*const preferredUsername = userAttributes.preferred_username || "";
    const name = userAttributes.name || "";

    // 表示用の名前を決定（name > preferred_username > email のユーザー名部分 の優先順位）
    let displayName = "ユーザー";
    if (name) {
      displayName = name;
    } else if (preferredUsername) {
      displayName = preferredUsername;
    } else if (email) {
      displayName = email.split('@')[0];
    }
    */
    return {
      userId,
      email,
    //  preferredUsername,
    //  name,
    //  displayName
    };

  } catch (error) {
    console.error("Cognito情報取得エラー:", error);
    
    const cognitoError: CognitoError = {
      error: error instanceof Error ? error : new Error('Unknown error'),
      isAuthError: true
    };
    
    throw cognitoError;
  }
};

/**
 * CognitoユーザーIDのみを取得するシンプルな関数
 * @returns Promise<string> ユーザーID
 * @throws {CognitoError} 認証エラーまたはその他のエラー
 */
export const getCognitoUserId = async (): Promise<string> => {
  try {
    const user = await getCurrentUser();
    return user.userId;
  } catch (error) {
    console.error("CognitoユーザーID取得エラー:", error);
    
    const cognitoError: CognitoError = {
      error: error instanceof Error ? error : new Error('Unknown error'),
      isAuthError: true
    };
    
    throw cognitoError;
  }
};

/**
 * 認証状態をチェックする関数
 * @returns Promise<boolean> 認証済みかどうか
 */
export const checkAuthStatus = async (): Promise<boolean> => {
  try {
    await getCurrentUser();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * 認証エラーハンドリング用のカスタムフック
 * @returns 認証エラーを処理するためのユーティリティ関数
 */
export const useAuthErrorHandler = () => {
  const router = useRouter();

  const handleAuthError = (error: CognitoError) => {
    if (error.isAuthError) {
      // 認証されていない場合はログイン画面へ
      router.push("/biory/login");
    }
  };

  return { handleAuthError };
};

/**
 * Cognitoユーザー情報を管理するカスタムフック
 * @returns ユーザー情報の状態と取得関数
 */
export const useCognitoUser = () => {
  const [cognitoUserInfo, setCognitoUserInfo] = React.useState<CognitoUserInfo | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<CognitoError | null>(null);
  const { handleAuthError } = useAuthErrorHandler();

  const loadUserInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const userInfo = await fetchCognitoUserInfo();
      setCognitoUserInfo(userInfo);
    } catch (err) {
      const cognitoError = err as CognitoError;
      setError(cognitoError);
      handleAuthError(cognitoError);
    } finally {
      setLoading(false);
    }
  };

  const getUserId = async (): Promise<string | null> => {
    try {
      return await getCognitoUserId();
    } catch (err) {
      const cognitoError = err as CognitoError;
      setError(cognitoError);
      handleAuthError(cognitoError);
      return null;
    }
  };

  return {
    cognitoUserInfo,
    loading,
    error,
    loadUserInfo,
    getUserId
  };
};

// 使用例をコメントとして記載
/*
使用例:

1. 基本的な使用方法（関数直接呼び出し）:
```tsx
import { fetchCognitoUserInfo, getCognitoUserId, checkAuthStatus } from './function';

// ユーザーID のみ取得
const userId = await getCognitoUserId();

// 完全なユーザー情報を取得
const userInfo = await fetchCognitoUserInfo();
console.log(userInfo.displayName);

// 認証状態をチェック
const isAuthenticated = await checkAuthStatus();
```

2. Reactコンポーネントでの使用（カスタムフック）:
```tsx
import { useCognitoUser } from './function';

const MyComponent = () => {
  const { cognitoUserInfo, loading, error, loadUserInfo, getUserId } = useCognitoUser();

  useEffect(() => {
    loadUserInfo();
  }, []);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました</div>;

  return (
    <div>
      <h1>こんにちは、{cognitoUserInfo?.displayName}さん！</h1>
      <p>ユーザーID: {cognitoUserInfo?.userId}</p>
      <p>メール: {cognitoUserInfo?.email}</p>
    </div>
  );
};
```
*/
