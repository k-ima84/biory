import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class MealSuggestionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda関数の作成
    const mealSuggestionFunction = new lambda.Function(this, 'MealSuggestionFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def handler(event, context):
    try:
        # リクエストボディの解析
        body = json.loads(event.get('body', '{}'))
        user_preferences = body.get('preferences', {})
        
        # Bedrockへのプロンプト作成
        prompt = create_meal_prompt(user_preferences)
        
        # Bedrock Claude 3 Haikuを呼び出し
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        # レスポンスの解析
        response_body = json.loads(response['body'].read())
        meal_suggestion = response_body['content'][0]['text']
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            'body': json.dumps({
                'suggestion': meal_suggestion,
                'timestamp': context.aws_request_id
            })
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def create_meal_prompt(preferences):
    base_prompt = """
あなたは栄養士です。以下の条件に基づいて1日の献立（朝食、昼食、夕食）を提案してください。

条件:
- 健康的でバランスの取れた食事
- 日本の食材を中心とした料理
- 各食事のカロリー目安: 朝食400-600kcal、昼食500-700kcal、夕食600-800kcal

以下のJSON形式で回答してください:
{
  "meals": [
    {
      "mealType": "朝食",
      "calories": 550,
      "dishes": ["料理名1", "料理名2", "料理名3"]
    },
    {
      "mealType": "昼食", 
      "calories": 600,
      "dishes": ["料理名1", "料理名2", "料理名3"]
    },
    {
      "mealType": "夕食",
      "calories": 750,
      "dishes": ["料理名1", "料理名2", "料理名3"]
    }
  ]
}
"""
    
    if preferences:
        base_prompt += f"\\n\\nユーザーの好み: {json.dumps(preferences, ensure_ascii=False)}"
    
    return base_prompt
`),
      timeout: cdk.Duration.seconds(30),
    });

    // Bedrockアクセス権限の付与
    mealSuggestionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: ['arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0'],
      })
    );

    // API Gatewayの作成
    const api = new apigateway.RestApi(this, 'MealSuggestionApi', {
      restApiName: 'Meal Suggestion Service',
      description: 'API for meal suggestions using Bedrock',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Lambda統合の作成
    const mealSuggestionIntegration = new apigateway.LambdaIntegration(mealSuggestionFunction);

    // APIエンドポイントの作成
    const mealResource = api.root.addResource('meal');
    const suggestionResource = mealResource.addResource('suggestion');
    suggestionResource.addMethod('POST', mealSuggestionIntegration);

    // 出力
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Meal Suggestion API URL',
    });
  }
}