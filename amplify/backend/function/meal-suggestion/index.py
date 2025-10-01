import json
import boto3
import logging
import os
from typing import Dict, Any

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
logging.basicConfig(level=logging.DEBUG)

bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-1')
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    献立提案Lambda関数のメインハンドラー
    """
    print(f"LAMBDA START: {json.dumps(event, default=str)}")  # printで強制出力
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
        
        # Bedrock Titan Text G1を呼び出し
        response = bedrock.invoke_model(
            modelId='amazon.titan-text-express-v1',
            body=json.dumps({
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": 1500,
                    "temperature": 0.7,
                    "stopSequences": []
                }
            })
        )
        
        # レスポンスの解析
        logger.info("Parsing Bedrock response...")
        response_body = json.loads(response['body'].read())
        logger.info(f"Bedrock response: {response_body}")
        meal_suggestion_text = response_body['results'][0]['outputText']
        logger.info(f"Extracted text length: {len(meal_suggestion_text)}")
        
        # JSON形式の献立データを抽出
        meal_data = parse_meal_suggestion(meal_suggestion_text)
        logger.info(f"Generated meal data: {meal_data}")
        
        debug_info = {
            'userId': user_id,
            'userPreferencesFound': bool(user_preferences),
            'mealsCount': len(meal_data) if meal_data else 0,
            'promptLength': len(prompt) if 'prompt' in locals() else 0,
            'bedrockResponseReceived': 'meal_suggestion_text' in locals(),
            'textLength': len(meal_suggestion_text) if 'meal_suggestion_text' in locals() else 0
        }
        
        print(f"DEBUG INFO: {debug_info}")  # printで強制出力
        
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({
                'meals': meal_data,
                'totalCalories': sum(meal['calories'] for meal in meal_data) if meal_data else 0,
                'timestamp': context.aws_request_id,
                'debug': debug_info
            }, ensure_ascii=False)
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error in meal suggestion: {str(e)}")
        logger.error(f"Full traceback: {error_details}")
        return {
            'statusCode': 500,
            'headers': cors_headers(),
            'body': json.dumps({
                'error': str(e),
                'errorType': type(e).__name__,
                'traceback': error_details
            })
        }

def create_meal_prompt(preferences: Dict, restrictions: list, target_calories: int) -> str:
    """
    Bedrock用のプロンプトを作成
    """
    import random
    
    # ユーザー情報を整理
    favorite_foods = preferences.get('favoriteFoods', '')
    disliked_foods = preferences.get('dislikedFoods', '')
    allergies = preferences.get('allergies', '')
    gender = preferences.get('gender', '')
    weight = preferences.get('weight', 60)
    
    # ランダム要素を追加
    seasons = ['春', '夏', '秋', '冬']
    cooking_styles = ['和食', '洋食', '中華', 'イタリアン', 'フレンチ']
    random_season = random.choice(seasons)
    random_style = random.choice(cooking_styles)
    random_number = random.randint(1, 1000)
    
    prompt = f"""
JSON形式で献立を提案してください。以下の条件で献立を作成してください。

条件:
- 総カロリー: {target_calories}kcal
- 朝食{int(target_calories * 0.25)}kcal、昼食{int(target_calories * 0.35)}kcal、夕食{int(target_calories * 0.40)}kcal
- 日本料理中心
- 具体的な料理名を使用

必ず以下の形式でJSONのみを返してください:
{{
  "meals": [
    {{
      "mealType": "朝食",
      "calories": {int(target_calories * 0.25)},
      "dishes": ["納豆ごはん", "味噌汁", "玉子焼き"]
    }},
    {{
      "mealType": "昼食",
      "calories": {int(target_calories * 0.35)},
      "dishes": ["さばの味噌汁", "おにぎり", "サラダ"]
    }},
    {{
      "mealType": "夕食",
      "calories": {int(target_calories * 0.40)},
      "dishes": ["焼き魚", "ごはん", "野菜炒め"]
    }}
  ]
}}

JSON以外の文字は一切返さないでください。"""
    return prompt

def parse_meal_suggestion(text: str) -> list:
    """
    Bedrockからの応答をパースして献立データを抽出
    """
    logger.info(f"Parsing Bedrock response: {text[:500]}...")  # 最初の500文字をログ出力
    
    try:
        # JSON部分を抽出
        start_idx = text.find('{')
        end_idx = text.rfind('}') + 1
        
        if start_idx != -1 and end_idx != -1:
            json_str = text[start_idx:end_idx]
            logger.info(f"Extracted JSON: {json_str}")
            data = json.loads(json_str)
            meals = data.get('meals', [])
            if meals:
                logger.info(f"Successfully parsed {len(meals)} meals")
                return meals
        
        logger.warning("No valid JSON found in response")
        return get_default_meals()
            
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return get_default_meals()

def get_default_meals() -> list:
    """
    デフォルトの献立データ
    """
    return [
        {
            "mealType": "朝食",
            "calories": 550,
            "dishes": ["納豆ごはん", "わかめと豆腐の味噌汁", "ゆで卵", "バナナ"],
            "color": "#FF8C42"
        },
        {
            "mealType": "昼食",
            "calories": 600,
            "dishes": ["ブロッコリー", "あさりのパスタ", "ほたてと野菜のサラダ", "カフェオレ（無糖）"],
            "color": "#FF8C42"
        },
        {
            "mealType": "夕食",
            "calories": 800,
            "dishes": ["照り焼きチキン", "マッシュルームのハンバーグ", "クレソンとにんじんの玉子炒め", "キャベツときゅうりのサラダ"],
            "color": "#FF8C42"
        }
    ]

def cors_headers() -> Dict[str, str]:
    """
    CORS用ヘッダー
    """
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }

def get_user_profile(user_id: str) -> Dict:
    """
    DynamoDBからユーザープロファイルを取得
    """
    try:
        # テーブル名を直接指定（Amplifyのデフォルト命名規則）
        table_name = 'UserProfile-amplifyawsamplifygen2lemol-sandbox-c8984a154d'
        print(f'Using table: {table_name}')
        table = dynamodb.Table(table_name)
        print(f"Scanning table {table_name} for userId: {user_id}")
        
        # userIdでスキャンしてユーザープロファイルを取得
        response = table.scan(
            FilterExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        print(f"DynamoDB scan response: {response}")
        
        if response['Items']:
            profile = response['Items'][0]
            logger.info(f"Found user profile: {profile}")
            return {
                'favoriteFoods': profile.get('favoriteFoods', ''),
                'dislikedFoods': profile.get('dislikedFoods', ''),
                'allergies': profile.get('allergies', ''),
                'gender': profile.get('gender', ''),
                'weight': profile.get('weight', 60),
                'height': profile.get('height', 160)
            }
        else:
            logger.warning(f"No profile found for userId: {user_id}")
            return {}
            
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        return {}

def cors_response() -> Dict[str, Any]:
    """
    OPTIONS用のCORSレスポンス
    """
    return {
        'statusCode': 200,
        'headers': cors_headers(),
        'body': ''
    }