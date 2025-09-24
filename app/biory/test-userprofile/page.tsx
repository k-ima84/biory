"use client";

import { useState } from 'react';
import { createInitialUserProfile, createUserProfileManually } from '../components/userProfileService';
import { getCurrentUser } from 'aws-amplify/auth';
import BioryLayout from '../components/BioryLayout';

export default function TestUserProfilePage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // 現在のCognitoユーザーIDを取得
  const fetchCurrentUserId = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      setCurrentUserId(user.userId);
      setResult(`✅ 現在のユーザーID: ${user.userId}`);
    } catch (error) {
      setResult(`❌ ユーザーID取得エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 自動UserProfile作成テスト
  const testAutoCreate = async () => {
    try {
      setLoading(true);
      setResult('🚀 自動UserProfile作成中...');
      
      const result = await createInitialUserProfile();
      
      if (result.success) {
        setResult(`✅ 自動作成成功!\n` +
          `プロファイルID: ${result.profileId}\n` +
          `アクション: ${result.action}\n` +
          `ユーザーID: ${result.userId}`
        );
      } else {
        setResult(`❌ 自動作成失敗: ${result.error}`);
      }
    } catch (error) {
      setResult(`❌ エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 手動UserProfile作成テスト
  const testManualCreate = async () => {
    if (!currentUserId) {
      setResult('❌ まず「ユーザーID取得」を実行してください');
      return;
    }

    try {
      setLoading(true);
      setResult('🔧 手動UserProfile作成中...');
      
      const result = await createUserProfileManually(currentUserId, 'test@example.com');
      
      if (result.success) {
        setResult(`✅ 手動作成成功!\n` +
          `プロファイルID: ${result.profileId}\n` +
          `アクション: ${result.action}`
        );
      } else {
        setResult(`❌ 手動作成失敗: ${result.error}`);
      }
    } catch (error) {
      setResult(`❌ エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 直接API呼び出しテスト
  const testDirectAPI = async () => {
    if (!currentUserId) {
      setResult('❌ まず「ユーザーID取得」を実行してください');
      return;
    }

    try {
      setLoading(true);
      setResult('🌐 直接API呼び出し中...');
      
      const response = await fetch('/api/create-user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          email: 'direct-test@example.com'
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setResult(`✅ 直接API呼び出し成功!\n` +
          `ステータス: ${response.status}\n` +
          `プロファイルID: ${data.profileId}\n` +
          `アクション: ${data.action}`
        );
      } else {
        setResult(`❌ 直接API呼び出し失敗:\n` +
          `ステータス: ${response.status}\n` +
          `エラー: ${data.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      setResult(`❌ エラー: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BioryLayout>
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>🧪 UserProfile作成テスト</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <h2>現在のユーザー情報</h2>
          <button 
            onClick={fetchCurrentUserId} 
            disabled={loading}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '取得中...' : 'ユーザーID取得'}
          </button>
          {currentUserId && (
            <p style={{ marginTop: '10px', color: '#28a745' }}>
              現在のユーザーID: <code>{currentUserId}</code>
            </p>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2>テストボタン</h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={testAutoCreate} 
              disabled={loading}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '実行中...' : '自動作成テスト'}
            </button>
            
            <button 
              onClick={testManualCreate} 
              disabled={loading || !currentUserId}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#ffc107', 
                color: 'black', 
                border: 'none', 
                borderRadius: '5px',
                cursor: (loading || !currentUserId) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '実行中...' : '手動作成テスト'}
            </button>
            
            <button 
              onClick={testDirectAPI} 
              disabled={loading || !currentUserId}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#17a2b8', 
                color: 'white', 
                border: 'none', 
                borderRadius: '5px',
                cursor: (loading || !currentUserId) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '実行中...' : '直接API呼び出し'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h2>実行結果</h2>
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6', 
            borderRadius: '5px', 
            padding: '15px', 
            whiteSpace: 'pre-wrap',
            minHeight: '100px'
          }}>
            {result || '結果がここに表示されます...'}
          </pre>
        </div>

        <div style={{ marginTop: '30px', fontSize: '14px', color: '#6c757d' }}>
          <h3>使用方法</h3>
          <ol>
            <li><strong>ユーザーID取得</strong>: 現在ログインしているCognitoユーザーのIDを取得</li>
            <li><strong>自動作成テスト</strong>: サインアップ確認成功時の処理をシミュレート</li>
            <li><strong>手動作成テスト</strong>: 指定ユーザーIDでUserProfile作成</li>
            <li><strong>直接API呼び出し</strong>: REST APIを直接呼び出してテスト</li>
          </ol>
        </div>
      </div>
    </BioryLayout>
  );
}
