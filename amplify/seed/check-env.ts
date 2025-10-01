import { log } from './common';
import * as fs from 'fs';
import * as path from 'path';

async function checkEnvironment(): Promise<void> {
  try {
    log.info('環境チェックを開始...');

    // 1. amplify_outputs.jsonの存在確認
    const outputsPath = path.join(process.cwd(), 'amplify_outputs.json');
    if (!fs.existsSync(outputsPath)) {
      log.error('amplify_outputs.json が見つかりません');
      log.info('解決方法: npx ampx sandbox を実行してサンドボックスを起動してください');
      process.exit(1);
    }
    log.success('amplify_outputs.json が存在します');

    // 2. AWS認証情報の確認
    const awsProfile = process.env.AWS_PROFILE;
    if (awsProfile) {
      log.success(`AWS_PROFILE: ${awsProfile} が設定されています`);
    } else {
      log.info('AWS_PROFILE が設定されていません（デフォルトプロファイルを使用）');
    }

    // 3. amplify_outputs.jsonの内容確認
    try {
      const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
      if (outputs.data && outputs.data.url) {
        log.success('GraphQL API エンドポイントが設定されています');
      } else {
        log.error('amplify_outputs.json の内容が不正です');
        process.exit(1);
      }
    } catch (error) {
      log.error('amplify_outputs.json の読み込みに失敗しました');
      process.exit(1);
    }

    // 4. 依存関係の確認
    try {
      require.resolve('aws-amplify');
      log.success('aws-amplify パッケージが利用可能です');
    } catch (error) {
      try {
        // ES modules環境での確認
        const packagePath = path.join(process.cwd(), 'node_modules', 'aws-amplify', 'package.json');
        if (fs.existsSync(packagePath)) {
          log.success('aws-amplify パッケージが利用可能です');
        } else {
          log.error('aws-amplify パッケージが見つかりません');
          log.info('解決方法: npm install を実行してください');
          process.exit(1);
        }
      } catch (e) {
        log.error('aws-amplify パッケージが見つかりません');
        log.info('解決方法: npm install を実行してください');
        process.exit(1);
      }
    }

    log.success('🎉 環境チェック完了 - シードデータを投入できます！');
    log.info('使用方法:');
    log.info('  npm run seed:all         # 全データ投入');
    log.info('  npm run seed:userprofile # ユーザープロファイルのみ');
    log.info('  npm run seed:nutrition   # 栄養データのみ');
    log.info('  npm run seed:meal        # 食事データのみ');
    log.info('  npm run test:db          # データ確認');
    log.info('  npm run show:userprofile # ユーザープロファイル確認');

  } catch (error) {
    log.error(`環境チェックエラー: ${error}`);
    process.exit(1);
  }
}

// 直接実行時の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('check-env.ts')) {
  checkEnvironment();
}
