import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { createUserProfile } from './functions/create-user-profile/resource.js';

const backend = defineBackend({
  auth,
  data,
  createUserProfile,
});

// Lambda関数にDynamoDBテーブルへのアクセス権限を付与
backend.createUserProfile.addEnvironment('USERPROFILE_TABLE_NAME', backend.data.resources.tables["UserProfile"].tableName);
