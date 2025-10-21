import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class MealSuggestionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    /*
    // Lambda関数の作成
    const mealSuggestionFunction = new lambda.Function(this, 'MealSuggestionFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('amplify/backend/function/meal-suggestion'),
      timeout: cdk.Duration.seconds(30),
    });
    

    // Bedrockアクセス権限の付与
    mealSuggestionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream'
        ],
        resources: ['*'],
      })
    );

    // DynamoDBアクセス権限の付与
    mealSuggestionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:GetItem',
          'dynamodb:ListTables'
        ],
        resources: [
          'arn:aws:dynamodb:ap-northeast-1:*:table/UserProfile-*',
          'arn:aws:dynamodb:ap-northeast-1:*:table/*'
        ],
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
    });*/
  }
}