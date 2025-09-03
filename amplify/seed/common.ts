import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../data/resource';
import * as fs from 'fs';
import * as path from 'path';

// amplify_outputs.jsonを読み込み
const outputsPath = path.join(process.cwd(), 'amplify_outputs.json');
const outputs = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));

// Amplify設定を初期化
Amplify.configure(outputs);

// 型安全なクライアントを作成
export const client = generateClient<Schema>();

// 共通のログ関数
export const log = {
  info: (message: string) => console.log(`ℹ️ ${message}`),
  success: (message: string) => console.log(`✅ ${message}`),
  error: (message: string) => console.error(`❌ ${message}`),
  data: (message: string, data: any) => console.log(`📊 ${message}`, data)
};
