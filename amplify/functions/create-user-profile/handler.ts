import type { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('🚀 create-user-profile Lambda triggered:', JSON.stringify(event, null, 2));

  // CORS対応ヘッダー
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    // OPTIONSリクエスト（CORS Preflight）
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'CORS preflight handled' })
      };
    }

    // POSTリクエストのみ処理
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false, 
          error: 'Method not allowed. Only POST is supported.' 
        })
      };
    }

    // リクエストボディ解析
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false, 
          error: 'Request body is required' 
        })
      };
    }

    const requestBody = JSON.parse(event.body);
    const { userId, email } = requestBody;

    // userIdチェック
    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false, 
          error: 'userId is required' 
        })
      };
    }

    console.log(`👤 Processing UserProfile creation for userId: ${userId}`);

    // 一旦成功レスポンスを返す（実際のDynamoDB操作は後で実装）
    const mockProfileId = `profile-${Date.now()}`;

    console.log(`✅ UserProfile mock created: ${mockProfileId} for userId: ${userId}`);

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'UserProfile creation simulated successfully',
        profileId: mockProfileId,
        userId: userId,
        action: 'created',
        note: 'This is a mock response. DynamoDB integration pending.'
      })
    };

  } catch (error) {
    console.error('❌ Lambda execution error:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};
