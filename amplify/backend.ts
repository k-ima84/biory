import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { MealSuggestionStack } from './backend/cdk/meal-suggestion-stack';

const backend = defineBackend({
  auth,
  data,
});

// CDKスタックの追加
new MealSuggestionStack(backend.stack, 'MealSuggestionStack');
