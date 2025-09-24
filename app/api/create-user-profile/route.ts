import { NextRequest, NextResponse } from 'next/server';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import { randomUUID } from 'crypto';

Amplify.configure(outputs);
const client = generateClient<Schema>();

interface RequestBody {
  userId: string;
  email?: string;
}

interface UserProfileResponse {
  success: boolean;
  message?: string;
  profileId?: string;
  userId?: string;
  action?: 'created' | 'existing';
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UserProfileResponse>> {
  console.log('🚀 create-user-profile API called');

  try {
    const body: RequestBody = await request.json();
    const { userId, email } = body;

    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'userId is required' 
        },
        { status: 400 }
      );
    }

    console.log(`👤 Processing UserProfile creation for userId: ${userId}`);

    // 既存UserProfileの確認
    const existingProfiles = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } }
    });

    if (existingProfiles.data.length > 0) {
      console.log(`✅ UserProfile already exists for userId: ${userId}`);
      return NextResponse.json({
        success: true,
        message: 'UserProfile already exists',
        profileId: existingProfiles.data[0].id,
        userId: userId,
        action: 'existing'
      });
    }

    // 新しいUserProfile作成
    const profileId = randomUUID();
    const timestamp = new Date().toISOString();

    const newProfile = await client.models.UserProfile.create({
      userId: userId,
      name: '',                   // 空文字（後で設定）
      gender: '',                 // 空文字（後で設定）
      height: null,               // null（後で設定）
      weight: null,               // null（後で設定）
      favoriteFoods: '',          // 空文字（後で設定）
      allergies: '',              // 空文字（後で設定）
      dislikedFoods: '',          // 空文字（後で設定）
      exerciseFrequency: '',      // 空文字（後で設定）
      exerciseFrequencyOther: '', // 空文字（後で設定）
    });

    if (newProfile.data) {
      console.log(`✅ UserProfile created successfully: ${newProfile.data.id} for userId: ${userId}`);
      
      return NextResponse.json({
        success: true,
        message: 'UserProfile created successfully',
        profileId: newProfile.data.id,
        userId: userId,
        action: 'created'
      });
    } else {
      throw new Error('Profile creation failed - no data returned');
    }

  } catch (error) {
    console.error('❌ UserProfile API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// CORS対応（必要に応じて）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
