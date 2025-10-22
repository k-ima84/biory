import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

//テストように一時的にコメントアウト　小澤
//import { MealSuggestionStack } from './backend/cdk/meal-suggestion-stack';

//小澤追加
import { kondateAIFunctionHandler } from './backend/function/kondateAI/resource';
import { mealAnalysisFunctionHandler } from './backend/function/mealAnalysis/resource';


const backend = defineBackend({
  auth,
  data,
  kondateAIFunctionHandler, //小澤追加
  mealAnalysisFunctionHandler
});

// Bedrock権限を追加
backend.kondateAIFunctionHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["bedrock:InvokeModel"],
    resources: ["*"]
  })
);

backend.mealAnalysisFunctionHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["bedrock:InvokeModel"],
    resources: ["*"]
  })
);

//一時的にコメントアウト　小澤
// CDKスタックの追加
//new MealSuggestionStack(backend.stack, 'MealSuggestionStack');
