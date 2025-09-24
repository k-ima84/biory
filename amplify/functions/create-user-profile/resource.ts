import { defineFunction } from '@aws-amplify/backend';

export const createUserProfile = defineFunction({
  name: 'create-user-profile',
  entry: './handler.ts'
});
