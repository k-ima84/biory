import json
import boto3
import logging
import os
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
logging.basicConfig(level=logging.DEBUG)

bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-1')
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

# 栄養データベースをグローバル変数として保持
NUTRITION_DB = None

def cors_headers() -> Dict[str, str]:
    """
    CORS用ヘッダー
    """
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400'
    }

def cors_response() -> Dict[str, Any]:
    """
    OPTIONS用のCORSレスポンス
    """
    return {
        'statusCode': 200,
        'headers': cors_headers(),
        'body': json.dumps({'message': 'CORS preflight successful'})
    }

def get_user_profile(user_id: str) -> Dict:
    """
    DynamoDBからユーザープロファイルを取得
    """
    try:
        if not user_id:
            return {}
            
        # 実際のテーブル名を取得
        dynamodb_client = boto3.client('dynamodb', region_name='ap-northeast-1')
        tables = dynamodb_client.list_tables()
        userprofile_tables = [t for t in tables['TableNames'] if 'UserProfile' in t]
        
        if not userprofile_tables:
            logger.warning('UserProfile table not found')
            return {}
            
        table_name = userprofile_tables[0]
        table = dynamodb.Table(table_name)
        
        # userIdでスキャンしてユーザープロファイルを取得
        from boto3.dynamodb.conditions import Attr
        response = table.scan(
            FilterExpression=Attr('userId').eq(user_id)
        )
        
        if response['Items']:
            profile = response['Items'][0]
            logger.info(f"Found user profile: {profile}")
            return {
                'allergies': profile.get('allergies', ''),
                'gender': profile.get('gender', ''),
                'weight': profile.get('weight', 60),
                'height': profile.get('height', 160),
                'age': profile.get('age', 30),
                'exerciseFrequency': profile.get('exerciseFrequency', '')
            }
        else:
            logger.warning(f"No profile found for userId: {user_id}")
            return {}
            
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return {}

def load_nutrition_data() -> Dict[str, Dict]:
    """
    基本的な栄養データを返す（参考用）
    """
    global NUTRITION_DB
    if NUTRITION_DB is not None:
        return NUTRITION_DB
    
    # 基本的な食材のサンプルデータ
    nutrition_data = {
        "白米": {"calories": 156, "category": "主食"},
        "鶏むね肉": {"calories": 191, "category": "肉類"},
        "鮭": {"calories": 138, "category": "魚類"},
        "卵": {"calories": 151, "category": "卵類"},
        "キャベツ": {"calories": 23, "category": "野菜"},
        "味噌汁": {"calories": 32, "category": "汁物"},
    }
    
    NUTRITION_DB = nutrition_data
    logger.info(f"Loaded {len(nutrition_data)} basic nutrition items")
    return nutrition_data

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    献立提案Lambda関数のメインハンドラー
    """
    print(f"LAMBDA START: {json.dumps(event, default=str)}")  # printで強制出力
    
    # 事前に基本的な処理確認
    try:
        event = event or {}
        context = context or type('obj', (object,), {'aws_request_id': 'local-test'})
    except Exception as init_error:
        logger.error(f"Initialization error: {init_error}")
        return {
            'statusCode': 500,
            'headers': cors_headers(),
            'body': json.dumps({'error': f'Initialization failed: {str(init_error)}'})
        }
    
    try:
        # CORS対応
        if event.get('httpMethod') == 'OPTIONS':
            return cors_response()
        
        # リクエストボディの解析
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('userId')
        target_calories = body.get('targetCalories', 2000)
        
        logger.info(f"Received userId: {user_id}")
        logger.info(f"Target calories: {target_calories}")
        
        # UserProfileテーブルからユーザー情報を取得
        logger.info("Getting user profile...")
        user_preferences = get_user_profile(user_id) if user_id else {}
        logger.info(f"User preferences retrieved: {user_preferences}")
        
        # Bedrockへのプロンプト作成
        logger.info("Creating meal prompt...")
        prompt = create_meal_prompt(user_preferences, [], target_calories)
        logger.info(f"Prompt created, length: {len(prompt)}")
        print(f"PROMPT SENT TO BEDROCK: {prompt}")
        
        # Bedrock呼び出し
        logger.info("Calling Bedrock API...")
        print(f"🤖 BEDROCK REQUEST START")
        
        # Titan Text Expressの正しいリクエスト形式（スキーマ準拠）
        bedrock_request = {
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": 1000,
                "temperature": 0.7,
                "topP": 0.9
            }
        }
        print(f"🔧 BEDROCK REQUEST BODY: {json.dumps(bedrock_request, ensure_ascii=False)}")
        
        try:
            response = bedrock.invoke_model(
                modelId='amazon.titan-text-express-v1',
                body=json.dumps(bedrock_request)
            )
            print(f"✅ BEDROCK RESPONSE RECEIVED")
        except Exception as bedrock_error:
            print(f"❌ BEDROCK API ERROR: {bedrock_error}")
            logger.error(f"Bedrock API call failed: {bedrock_error}")
            # Bedrockエラー時は直接フォールバックを使用
            meal_data = create_default_meals(target_calories)
            is_using_fallback = True
            meal_suggestion_text = f"Bedrock API Error: {str(bedrock_error)}"
            
            # エラー時のデバッグ情報
            debug_info = {
                'userId': user_id,
                'userPreferencesFound': bool(user_preferences),
                'mealsCount': len(meal_data),
                'promptLength': len(prompt),
                'bedrockResponseReceived': False,
                'textLength': 0,
                'promptSent': prompt,
                'aiResponse': meal_suggestion_text,
                'usingFallback': True,
                'mealSource': 'FALLBACK_BEDROCK_ERROR',
                'bedrockStatus': 'API_ERROR',
                'bedrockError': str(bedrock_error)
            }
            
            # エラー時のレスポンス
            response_data = {
                'meals': meal_data,
                'totalCalories': sum(meal.get('calories', 0) for meal in meal_data),
                'timestamp': datetime.now().isoformat(),
                'debug': debug_info
            }
            
            return {
                'statusCode': 200,  # フォールバック成功として200を返す
                'headers': cors_headers(),
                'body': json.dumps(response_data, ensure_ascii=False)
            }
        
        # 正常なBedrock応答の処理を継続
        if 'response' in locals():
            # レスポンスの解析
            logger.info("Parsing Bedrock response...")
            response_body = json.loads(response['body'].read())
            logger.info(f"Bedrock response: {response_body}")
            
            # AI応答の検証
            if not response_body.get('results') or len(response_body['results']) == 0:
                print(f"❌ BEDROCK ERROR: No results in response")
                meal_data = create_default_meals(target_calories)
                is_using_fallback = True
                meal_suggestion_text = "No AI response - empty results"
            else:
                meal_suggestion_text = response_body['results'][0]['outputText']
                logger.info(f"Extracted text length: {len(meal_suggestion_text)}")
                print(f"🎯 BEDROCK RAW RESPONSE: {meal_suggestion_text}")
                print(f"📝 RESPONSE LENGTH: {len(meal_suggestion_text)} characters")
                
                # AIの応答が短すぎる場合は警告
                if len(meal_suggestion_text) < 50:
                    print(f"⚠️ WARNING: AI response too short ({len(meal_suggestion_text)} chars) - may indicate error")
                    print(f"🔄 ATTEMPTING FALLBACK DUE TO SHORT RESPONSE")
                    meal_data = create_default_meals(target_calories)
                    is_using_fallback = True
                else:
                    # JSON形式かどうかチェック
                    has_json_start = '{' in meal_suggestion_text
                    has_meals_key = 'meals' in meal_suggestion_text
                    print(f"🔍 JSON CHECK: has_bracket={has_json_start}, has_meals={has_meals_key}")
                    
                    if not has_json_start or not has_meals_key:
                        print(f"🔄 ATTEMPTING FALLBACK DUE TO INVALID JSON FORMAT")
                        meal_data = create_default_meals(target_calories)
                        is_using_fallback = True
                    else:
                        # JSON形式の献立データを抽出
                        print(f"🔄 STARTING MEAL PARSING...")
                        meal_data = parse_meal_suggestion(meal_suggestion_text, target_calories)
                        print(f"📊 PARSE RESULT: {type(meal_data)} with {len(meal_data) if meal_data else 0} meals")
                        
                        # AI成功かフォールバック使用かを判定
                        fallback_meals = create_default_meals(target_calories)
                        is_using_fallback = False
                        
                        # パース成功かどうかを明確にチェック
                        if meal_data and len(meal_data) > 0:
                            print(f"✅ AI PARSING SUCCESS: Generated {len(meal_data)} meals")
                            for i, meal in enumerate(meal_data):
                                print(f"   Meal {i+1}: {meal.get('mealType', 'Unknown')} - {meal.get('calories', 0)}kcal")
                            
                            # フォールバック献立と同じかチェック
                            if meal_data == fallback_meals:
                                is_using_fallback = True
                                print(f"🔄 USING FALLBACK: AI returned fallback meals")
                            else:
                                print(f"✅ USING AI MEALS: Successfully generated {len(meal_data)} unique meals")
                        else:
                            print(f"❌ AI PARSING FAILED: No valid meals found")
                            print(f"🔄 SWITCHING TO FALLBACK MEALS")
                            meal_data = fallback_meals
                            is_using_fallback = True
            
            print(f"📊 MEAL SOURCE: {'FALLBACK' if is_using_fallback else 'AI_GENERATED'}")
            
            # 各食事の詳細をログ出力
            if meal_data:
                for i, meal in enumerate(meal_data):
                    logger.info(f"Meal {i}: {meal}")
            
            debug_info = {
                'userId': user_id,
                'userPreferencesFound': bool(user_preferences),
                'mealsCount': len(meal_data) if meal_data else 0,
                'promptLength': len(prompt) if 'prompt' in locals() else 0,
                'bedrockResponseReceived': 'meal_suggestion_text' in locals(),
                'textLength': len(meal_suggestion_text) if 'meal_suggestion_text' in locals() else 0,
                'promptSent': prompt if 'prompt' in locals() else 'No prompt generated',
                'aiResponse': meal_suggestion_text[:500] + '...' if 'meal_suggestion_text' in locals() and len(meal_suggestion_text) > 500 else meal_suggestion_text if 'meal_suggestion_text' in locals() else 'No AI response',
                'usingFallback': is_using_fallback if 'is_using_fallback' in locals() else True,
                'mealSource': 'FALLBACK' if is_using_fallback else 'AI_GENERATED',
                'bedrockStatus': 'SUCCESS' if 'response_body' in locals() and response_body.get('results') else 'NO_RESULTS'
            }
        
        print(f"DEBUG INFO: {debug_info}")  # printで強制出力
        
        # レスポンスデータを準備
        # カロリー合計を安全に計算
        total_calories = 0
        if meal_data:
            for meal in meal_data:
                calories = meal.get('calories', 0)
                # カロリーが数値でない場合は0として扱う
                if isinstance(calories, (int, float)):
                    total_calories += calories
                else:
                    logger.warning(f"Invalid calories value: {calories} (type: {type(calories)})")
        
        response_data = {
            'meals': meal_data,
            'totalCalories': total_calories,
            'timestamp': datetime.now().isoformat(),
            'debug': debug_info
        }
        
        logger.info(f"Final response data: {response_data}")
        
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps(response_data, ensure_ascii=False)
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error in meal suggestion: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        
        # デバッグ用の詳細情報を追加
        error_info = {
            'error': str(e),
            'errorType': type(e).__name__,
            'traceback': error_details,
            'timestamp': str(context.aws_request_id) if context else 'unknown',
            'event': json.dumps(event, default=str) if event else 'no event'
        }
        
        return {
            'statusCode': 500,
            'headers': cors_headers(),  # エラー時もCORSヘッダーを含める
            'body': json.dumps(error_info, ensure_ascii=False)
        }

def create_meal_prompt(preferences: Dict, restrictions: list, target_calories: int) -> str:
    """
    シンプルで効果的な献立提案プロンプトを作成
    """
    # ユーザー情報を取得
    allergies = preferences.get('allergies', '')
    
    # アレルギー制約を設定
    allergy_constraints = ""
    if allergies and allergies.strip() and allergies != "なし":
        allergy_constraints = f"\n【重要】アレルギー食材は使用禁止: {allergies}"
    
    # カロリー範囲を設定
    target_min = max(1200, target_calories - 150)
    target_max = target_calories + 150
    
    prompt = f"""Create Japanese meal plan JSON:

{{
  "meals": [
    {{
      "mealType": "朝食",
      "calories": 350,
      "dishes": ["ご飯", "主菜", "副菜"]
    }},
    {{
      "mealType": "昼食", 
      "calories": 700,
      "dishes": ["ご飯", "主菜", "副菜", "汁物"]
    }},
    {{
      "mealType": "夕食",
      "calories": 600,
      "dishes": ["ご飯", "主菜", "副菜", "汁物"]
    }}
  ]
}}

Total: {target_min}-{target_max}kcal
Japanese dishes: 鶏の照り焼き, きんぴらごぼう, わかめの味噌汁
{allergy_constraints}

JSON only."""
    return prompt

def parse_meal_suggestion(text: str, target_calories: int = 2000) -> list:
    """
    Bedrockからの応答をパースして献立データを抽出（強化版）
    """
    logger.info(f"Parsing Bedrock response: {text[:200]}...")
    print(f"BEDROCK RESPONSE: {text}")
    
    try:
        # 複数の方法でJSONを抽出
        cleaned_text = text.strip()
        
        # 方法1: 標準的なJSON抽出
        start_idx = cleaned_text.find('{')
        end_idx = cleaned_text.rfind('}') + 1
        
        if start_idx != -1 and end_idx > start_idx:
            json_str = cleaned_text[start_idx:end_idx]
            logger.info(f"Extracted JSON: {json_str[:100]}...")
            
            try:
                data = json.loads(json_str)
                meals = data.get('meals', [])
                
                if meals and isinstance(meals, list) and len(meals) > 0:
                    # データを正規化
                    valid_meals = []
                    for meal in meals:
                        if isinstance(meal, dict) and 'mealType' in meal:
                            # 必要な要素を確保
                            normalized_meal = {
                                'mealType': meal.get('mealType', '昼食'),
                                'calories': int(meal.get('calories', 400)),
                                'color': '#FF8C42'
                            }
                            
                            # dishesの処理（カロリー表記削除）
                            dishes = meal.get('dishes', [])
                            if isinstance(dishes, list):
                                cleaned_dishes = []
                                for dish in dishes:
                                    if isinstance(dish, str) and dish.strip():
                                        # カロリー表記を削除
                                        import re
                                        clean_dish = re.sub(r'\(\d+kcal\)', '', dish).strip()
                                        if clean_dish:
                                            cleaned_dishes.append(clean_dish)
                                normalized_meal['dishes'] = cleaned_dishes if cleaned_dishes else ["和食"]
                            else:
                                normalized_meal['dishes'] = ["和食"]
                            
                            valid_meals.append(normalized_meal)
                    
                    if valid_meals:
                        logger.info(f"Successfully parsed {len(valid_meals)} valid meals")
                        return valid_meals
                        
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing failed: {e}")
                
        # 方法2: より寛容なJSON抽出
        import re
        json_pattern = r'\{[^{}]*"meals"[^{}]*\[[^\]]*\][^{}]*\}'
        json_matches = re.findall(json_pattern, cleaned_text, re.DOTALL)
        
        for match in json_matches:
            try:
                data = json.loads(match)
                meals = data.get('meals', [])
                if meals:
                    logger.info("Successfully parsed with pattern matching")
                    return meals
            except:
                continue
        
        # JSONパースが完全に失敗した場合はデフォルト献立
        logger.warning("All JSON parsing methods failed, using default meals")
        return create_default_meals(target_calories)
        
    except Exception as e:
        logger.error(f"Parse error: {e}")
        return create_default_meals(target_calories)

def create_default_meals(target_calories: int = 2000) -> list:
    """
    AI失敗時の最小限フォールバック献立（シンプル版）
    """
    try:
        import random
        
        # カロリー配分
        breakfast_cal = int(target_calories * 0.25)
        lunch_cal = int(target_calories * 0.4)
        dinner_cal = target_calories - breakfast_cal - lunch_cal
        
        # 最小限のシンプルなフォールバック（AIが優先）
        simple_meals = [
            {
                'mealType': '朝食',
                'calories': breakfast_cal,
                'dishes': ["ご飯", "納豆", "野菜サラダ"],
                'color': '#FF8C42'
            },
            {
                'mealType': '昼食',
                'calories': lunch_cal,
                'dishes': ["ご飯", "鶏の照り焼き", "野菜炒め", "味噌汁"],
                'color': '#FF8C42'
            },
            {
                'mealType': '夕食',
                'calories': dinner_cal,
                'dishes': ["ご飯", "鮭の塩焼き", "きんぴらごぼう", "わかめの味噌汁"],
                'color': '#FF8C42'
            }
        ]
        
        logger.warning(f"Using fallback meals (AI failed) - total {sum(meal['calories'] for meal in simple_meals)}kcal")
        return simple_meals
        
    except Exception as e:
        logger.error(f"Even fallback meals failed: {e}")
        return [
            {'mealType': '昼食', 'calories': 600, 'dishes': ["定食"], 'color': '#FF8C42'},
            {'mealType': '夕食', 'calories': 500, 'dishes': ["和食"], 'color': '#FF8C42'}
        ]

def get_default_meals() -> list:
    """
    最小限のデフォルト献立（使用していない関数は削除済み）
    """
    return [
        {'mealType': '昼食', 'calories': 600, 'dishes': ["親子丼", "小鉢"], 'color': '#FF8C42'},
        {'mealType': '夕食', 'calories': 500, 'dishes': ["焼き魚", "ご飯", "味噌汁"], 'color': '#FF8C42'}
    ]