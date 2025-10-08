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
        
        # Titan Text Expressを使用
        response = bedrock.invoke_model(
            modelId='amazon.titan-text-express-v1',
            body=json.dumps({
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": 1500,
                    "temperature": 0.9,
                    "topP": 0.9,
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
        print(f"BEDROCK RAW RESPONSE: {meal_suggestion_text}")  # 完全な応答をログ出力
        
        # JSON形式の献立データを抽出
        meal_data = parse_meal_suggestion(meal_suggestion_text, target_calories)
        logger.info(f"Generated meal data: {meal_data}")
        logger.info(f"Meal data type: {type(meal_data)}")
        logger.info(f"Meal data length: {len(meal_data) if meal_data else 0}")
        
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
            'textLength': len(meal_suggestion_text) if 'meal_suggestion_text' in locals() else 0
        }
        
        print(f"DEBUG INFO: {debug_info}")  # printで強制出力
        
        # レスポンスデータを準備
        response_data = {
            'meals': meal_data,
            'totalCalories': sum(meal['calories'] for meal in meal_data) if meal_data else 0,
            'timestamp': context.aws_request_id,
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
    ユーザープロファイルを考慮したプロンプトを作成
    """
    import random
    import time
    
    # より柔軟なカロリー配分（ランダム性を追加）
    breakfast_base = target_calories * 0.25
    lunch_base = target_calories * 0.35
    dinner_base = target_calories * 0.40
    
    # ±5%の範囲でランダムに調整
    breakfast_cal = int(breakfast_base + (random.random() - 0.5) * breakfast_base * 0.1)
    lunch_cal = int(lunch_base + (random.random() - 0.5) * lunch_base * 0.1)
    dinner_cal = target_calories - breakfast_cal - lunch_cal  # 残りを夕食に割り当て
    
    # ユーザー情報を取得
    allergies = preferences.get('allergies', '')
    
    # アレルギー制約を厳格に設定
    allergy_constraints = ""
    if allergies and allergies.strip() and allergies != "なし":
        allergy_constraints = f"\n【重要・必須条件】以下の食材は絶対に使用禁止: {allergies}"
        allergy_constraints += "\n上記食材が含まれる料理や調味料も一切使用しないでください。"
    
    # ランダム要素を追加してバリエーションを作る
    random_seed = int(time.time()) % 10000
    
    # 多様な料理例を提示
    diverse_examples = [
        # 和食例
        "朝食：玄米ごはん、鮭の塩焼き、ほうれん草のお浸し、豆腐の味噌汁",
        "昼食：親子丼、わかめときゅうりの酢の物、なめこの味噌汁",
        "夕食：白米、さばの味噌煮、肉じゃが、小松菜とあげの味噌汁",
        # 洋食例
        "朝食：全粒粉パン、スクランブルエッグ、ベーコン、野菜サラダ",
        "昼食：ハンバーグ、ガーリックライス、コーンスープ、ブロッコリー",
        "夕食：グリルチキン、マッシュポテト、人参グラッセ、オニオンスープ",
        # 中華例
        "朝食：中華粥、焼売、キムチ、中華スープ",
        "昼食：麻婆豆腐、白米、青椒肉絲、わかめスープ",
        "夕食：酢豚、チャーハン、餃子、中華コーンスープ"
    ]
    
    # より創意的な料理リストを作成
    creative_dishes = [
        # 朝食アイデア
        "納豆卵かけご飯", "フレンチトースト", "アボカドトースト", "オムライス", "パンケーキ", 
        "雑炊", "おにぎり", "ベーグルサンド", "グラノーラヨーグルト", "お茶漬け",
        # 昼食アイデア  
        "カルボナーラ", "チャーハン", "カレーライス", "ラーメン", "うどん", "そば",
        "ハンバーガー", "サンドイッチ", "お弁当", "丼物", "パスタ", "ピザ",
        # 夕食アイデア
        "ステーキ", "すき焼き", "しゃぶしゃぶ", "天ぷら", "寿司", "刺身", 
        "焼肉", "鍋料理", "グラタン", "リゾット", "パエリア", "タコス"
    ]
    
    prompt = f"""あなたは創意豊かな料理研究家です。日本の10月の季節感を活かした、バラエティに富んだ1日の献立を提案してください。

以下のJSON形式で回答してください：

{{
  "meals": [
    {{
      "mealType": "朝食",
      "calories": {breakfast_cal},
      "dishes": ["メイン料理", "副菜", "汁物/飲み物"]
    }},
    {{
      "mealType": "昼食", 
      "calories": {lunch_cal},
      "dishes": ["メイン料理", "副菜", "汁物/飲み物"]
    }},
    {{
      "mealType": "夕食",
      "calories": {dinner_cal}, 
      "dishes": ["メイン料理", "副菜", "汁物/飲み物"]
    }}
  ]
}}

【必須条件】
- 総カロリー{target_calories}kcal以内
- 朝{breakfast_cal}kcal、昼{lunch_cal}kcal、夕{dinner_cal}kcal程度
{allergy_constraints}
- 「ごはん」「白米」などの主食は最大1食まで
- 毎食異なるジャンル・調理法の料理を組み合わせる
- 10月の秋の食材（さつまいも、きのこ、柿など）を活用
- 和食・洋食・中華・エスニックなど多様なジャンルから選択

【参考料理】（これら以外も自由に提案してください）
{', '.join(random.sample(creative_dishes, 8))}

【重要】創造性を最大限発揮し、予想外の美味しい組み合わせを提案してください。
毎回まったく異なる献立になるよう工夫してください。

JSON形式のみで回答してください。説明不要。
ID:{random_seed}"""
    return prompt

def parse_meal_suggestion(text: str, target_calories: int = 2000) -> list:
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
                # AIから返されたカロリーをそのまま使用（より柔軟性を持たせる）
                return meals
        
        # JSONがない場合はテキストからパース
        logger.warning("No valid JSON found, parsing text format")
        parsed_meals = parse_text_format(text, target_calories)
        if parsed_meals:
            return parsed_meals
        else:
            logger.error("Failed to parse any meal data")
            return []
            
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        parsed_meals = parse_text_format(text, target_calories)
        if parsed_meals:
            return parsed_meals
        else:
            logger.error("Failed to parse meal data after JSON error")
            return []

def parse_text_format(text: str, target_calories: int = 2000) -> list:
    """
    テキスト形式のレスポンスをパース
    """
    try:
        # ターゲットカロリーに基づいた動的なカロリー配分
        breakfast_cal = int(target_calories * 0.25)
        lunch_cal = int(target_calories * 0.35)
        dinner_cal = target_calories - breakfast_cal - lunch_cal
        
        meals = []
        lines = text.split('\n')
        current_meal = None
        
        for line in lines:
            line = line.strip()
            if '朝食:' in line:
                if current_meal:
                    meals.append(current_meal)
                current_meal = {'mealType': '朝食', 'calories': breakfast_cal, 'dishes': [], 'color': '#FF8C42'}
            elif '昼食:' in line:
                if current_meal:
                    meals.append(current_meal)
                current_meal = {'mealType': '昼食', 'calories': lunch_cal, 'dishes': [], 'color': '#FF8C42'}
            elif '夕食:' in line:
                if current_meal:
                    meals.append(current_meal)
                current_meal = {'mealType': '夕食', 'calories': dinner_cal, 'dishes': [], 'color': '#FF8C42'}
            elif current_meal and ('主食:' in line or '主菜:' in line or '副菜:' in line):
                dish = line.split(':')[-1].strip()
                if dish:
                    current_meal['dishes'].append(dish)
        
        if current_meal:
            meals.append(current_meal)
        
        # 各食事に最低1つの料理があるかチェック
        valid_meals = [meal for meal in meals if len(meal['dishes']) > 0]
        
        if len(valid_meals) >= 1:  # 最低1食でもパースできればOK
            logger.info(f"Successfully parsed {len(valid_meals)} meals from text")
            return valid_meals
        
        # テキストから簡単なパースを試行
        logger.warning("Trying simple text parsing as fallback")
        simple_meals = create_simple_meals_from_text(text, target_calories)
        if simple_meals:
            return simple_meals
        
        logger.warning("Failed to parse any valid meals from text format")
        return []
        
    except Exception as e:
        logger.error(f"Text parsing error: {e}")
        return []

def create_simple_meals_from_text(text: str, target_calories: int = 2000) -> list:
    """
    シンプルなテキストパースのフォールバック
    """
    try:
        # ターゲットカロリーに基づいた動的なカロリー配分
        breakfast_cal = int(target_calories * 0.25)
        lunch_cal = int(target_calories * 0.35)
        dinner_cal = target_calories - breakfast_cal - lunch_cal  # 残りを夕食に
        
        # 基本的な献立を生成（AIが失敗した場合のフォールバック）
        import random
        
        dishes_pool = [
            ['ごはん', '焼き魚', '味噌汁'],
            ['ごはん', '納豆', 'わかめスープ'],
            ['ごはん', '豚の生姜焼き', '野菜サラダ'],
            ['ごはん', '鶏の照り焼き', '野菜炒め'],
            ['ごはん', 'さばの塩焼き', 'きんぴらごぼう']
        ]
        
        selected_dishes = random.sample(dishes_pool, 3)
        
        return [
            {
                'mealType': '朝食',
                'calories': breakfast_cal,
                'dishes': selected_dishes[0],
                'color': '#FF8C42'
            },
            {
                'mealType': '昼食', 
                'calories': lunch_cal,
                'dishes': selected_dishes[1],
                'color': '#FF8C42'
            },
            {
                'mealType': '夕食',
                'calories': dinner_cal, 
                'dishes': selected_dishes[2],
                'color': '#FF8C42'
            }
        ]
        
    except Exception as e:
        logger.error(f"Simple parsing error: {e}")
        return []

def get_default_meals() -> list:
    """
    AIからの回答が取得できない場合のエラーメッセージ
    """
    logger.error("AIからの献立提案が取得できませんでした")
    return []

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
        # 実際のテーブル名を取得
        dynamodb_client = boto3.client('dynamodb', region_name='ap-northeast-1')
        tables = dynamodb_client.list_tables()
        userprofile_tables = [t for t in tables['TableNames'] if 'UserProfile' in t]
        
        if not userprofile_tables:
            print('UserProfile table not found. Available tables:')
            print(tables['TableNames'])
            return {}
            
        table_name = userprofile_tables[0]
        print(f'Found and using table: {table_name}')
        table = dynamodb.Table(table_name)
        print(f"Scanning table {table_name} for userId: {user_id}")
        
        # userIdでスキャンしてユーザープロファイルを取得
        from boto3.dynamodb.conditions import Attr
        response = table.scan(
            FilterExpression=Attr('userId').eq(user_id)
        )
        print(f"DynamoDB scan response: {response}")
        
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

def cors_response() -> Dict[str, Any]:
    """
    OPTIONS用のCORSレスポンス
    """
    return {
        'statusCode': 200,
        'headers': cors_headers(),
        'body': ''
    }