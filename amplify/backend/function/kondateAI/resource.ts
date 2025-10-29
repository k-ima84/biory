import { execSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineFunction } from "@aws-amplify/backend";
import { DockerImage, Duration } from "aws-cdk-lib";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

const functionDir = path.dirname(fileURLToPath(import.meta.url));

export const kondateAIFunctionHandler = defineFunction(
  (scope) => {
    const lambdaFunction = new Function(scope, "kondate-ai", {
      handler: "index.handler",
      runtime: Runtime.PYTHON_3_9, // or any other python version
      timeout: Duration.seconds(60), // タイムアウトを60秒に設定
      code: Code.fromAsset(functionDir, {
        bundling: {
          image: DockerImage.fromRegistry("dummy"), // replace with desired image from AWS ECR Public Gallery
          local: {
            tryBundle(outputDir: string) {
              const isWindows = process.platform === "win32";
              const copyCmd = isWindows 
                ? `xcopy "${functionDir}" "${outputDir}" /E /I /Y` 
                : `cp -r ${functionDir}/* ${outputDir}`;
              
              execSync(copyCmd);
              return true;
            },
          },
        },
      }),
    });

    // Bedrock権限を追加
    lambdaFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:ListFoundationModels"
        ],
        resources: ["*"] // 全Bedrockモデルへのアクセス
      })
    );

    // DynamoDB権限を追加（UserProfileテーブルへのアクセス）
    lambdaFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ],
        resources: ["arn:aws:dynamodb:*:*:table/UserProfile*"] // UserProfileテーブルへのアクセス
      })
    );

    return lambdaFunction;
  },
    {
      resourceGroupName: "auth" // Optional: Groups this function with auth resource
    }
);