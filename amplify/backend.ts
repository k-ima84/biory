import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { MealSuggestionStack } from './backend/cdk/meal-suggestion-stack';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
});

// CDKスタックの追加
new MealSuggestionStack(backend.stack, 'MealSuggestionStack');

// Bedrockアクセス用のポリシーステートメント
const bedrockPolicy = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:InvokeModel'],
  resources: [
    // Nova Micro - Foundation Model（US East）
    'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0',
    // Nova Micro - Inference Profile（US East）
    'arn:aws:bedrock:us-east-1:*:inference-profile/us.amazon.nova-micro-v1:0',
    // 全リージョンのfoundation-modelとinference-profileを許可
    'arn:aws:bedrock:*::foundation-model/*',
    'arn:aws:bedrock:*:*:inference-profile/*',
  ],
});

// 認証済みユーザーにBedrockへのアクセス権限を付与
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(bedrockPolicy);

// 未認証ユーザーにもBedrockへのアクセス権限を付与（一時的なテスト用）
backend.auth.resources.unauthenticatedUserIamRole.addToPrincipalPolicy(bedrockPolicy);
