import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';

//テストように一時的にコメントアウト　小澤
//import { MealSuggestionStack } from './backend/cdk/meal-suggestion-stack';

//小澤追加
import { sayHelloFunctionHandler } from './backend/function/meal-sug-ozawa/resource';


const backend = defineBackend({
  auth,
  data,
  sayHelloFunctionHandler //小澤追加
});

//一時的にコメントアウト　小澤
// CDKスタックの追加
//new MealSuggestionStack(backend.stack, 'MealSuggestionStack');
