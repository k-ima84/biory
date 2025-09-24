import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

// レスポンスタイプ定義
interface UserProfileResponse {
  success: boolean;
  message?: string;
  profileId?: string;
  userId?: string;
  action?: 'created' | 'existing';
  error?: string;
}

/**
 * Cognitoユーザー確認成功時に初期UserProfileを作成する関数
 */
export const createInitialUserProfile = async () => {
  try {
    console.log('🚀 UserProfile自動作成開始...');
    
    // 現在のCognitoユーザー情報取得
    const currentUser = await getCurrentUser();
    const session = await fetchAuthSession();
    
    const userId = currentUser.userId;
    const email = session.tokens?.idToken?.payload?.email as string;
    
    console.log(`📝 UserProfile作成中: ${userId}`);
    
    // REST API経由でUserProfile作成（現在はAPI Gateway未作成なのでfetch使用）
    const response = await fetch('/api/create-user-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        email: email
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const result: UserProfileResponse = await response.json();
    
    if (result.success) {
      console.log(`✅ UserProfile ${result.action}: ${result.profileId}`);
      return {
        success: true,
        profileId: result.profileId,
        action: result.action,
        userId: userId
      };
    } else {
      throw new Error(result.error || 'UserProfile作成に失敗しました');
    }
    
  } catch (error) {
    console.error('❌ UserProfile作成エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * 手動でUserProfileを作成する関数（テスト用）
 */
export const createUserProfileManually = async (userId: string, email?: string) => {
  try {
    console.log(`🔧 手動UserProfile作成: ${userId}`);
    
    const response = await fetch('/api/create-user-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        email: email || ''
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const result: UserProfileResponse = await response.json();
    
    if (result.success) {
      console.log(`✅ 手動UserProfile ${result.action}: ${result.profileId}`);
      return {
        success: true,
        profileId: result.profileId,
        action: result.action
      };
    } else {
      throw new Error(result.error || 'UserProfile作成に失敗しました');
    }
    
  } catch (error) {
    console.error('❌ 手動UserProfile作成エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
