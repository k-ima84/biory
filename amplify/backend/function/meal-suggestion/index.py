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
                    "maxTokenCount": 800,
                    "temperature": 0.8
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
        
        # 空の結果の場合はデフォルト献立を使用
        if not meal_data or len(meal_data) == 0:
            logger.warning("No meal data parsed, using default meals")
            meal_data = create_default_meals(target_calories)
        
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
    
    prompt = f"""以下のJSON形式のみで回答してください。説明文や追加のテキストは一切不要です。

{{
  "meals": [
    {{
      "mealType": "朝食",
      "calories": {breakfast_cal},
      "dishes": ["具体的な料理名1", "具体的な料理名2", "具体的な料理名3"]
    }},
    {{
      "mealType": "昼食", 
      "calories": {lunch_cal},
      "dishes": ["具体的な料理名1", "具体的な料理名2", "具体的な料理名3"]
    }},
    {{
      "mealType": "夕食",
      "calories": {dinner_cal}, 
      "dishes": ["具体的な料理名1", "具体的な料理名2", "具体的な料理名3"]
    }}
  ]
}}

条件：
- 総カロリー{target_calories}kcal以内
- 朝{breakfast_cal}kcal、昼{lunch_cal}kcal、夕{dinner_cal}kcal程度
{allergy_constraints}
- 10月の秋の食材を活用
- 多様なジャンル（和食・洋食・中華・エスニック）から選択
- 毎食異なる料理を組み合わせる

参考料理: {', '.join(random.sample(creative_dishes, 6))}

上記JSON形式のみで回答し、他の文章は書かないでください。
ID:{random_seed}"""
    return prompt

def parse_meal_suggestion(text: str, target_calories: int = 2000) -> list:
    """
    Bedrockからの応答をパースして献立データを抽出
    """
    logger.info(f"Parsing Bedrock response: {text[:500]}...")  # 最初の500文字をログ出力
    print(f"FULL BEDROCK RESPONSE: {text}")  # 完全な応答をprintで出力
    
    try:
        # JSON部分を抽出
        start_idx = text.find('{')
        end_idx = text.rfind('}') + 1
        
        if start_idx != -1 and end_idx != -1:
            json_str = text[start_idx:end_idx]
            logger.info(f"Extracted JSON: {json_str}")
            print(f"EXTRACTED JSON: {json_str}")
            try:
                data = json.loads(json_str)
                meals = data.get('meals', [])
                if meals:
                    logger.info(f"Successfully parsed {len(meals)} meals")
                    # 各食事にcolorフィールドを追加
                    for meal in meals:
                        if 'color' not in meal:
                            meal['color'] = '#FF8C42'
                    return meals
            except json.JSONDecodeError as json_err:
                logger.error(f"JSON parsing failed: {json_err}")
                print(f"JSON PARSE ERROR: {json_err}")
        
        # JSONがない場合はテキストからパース
        logger.warning("No valid JSON found, parsing text format")
        parsed_meals = parse_text_format(text, target_calories)
        if parsed_meals:
            return parsed_meals
        
        # すべてのパースが失敗した場合はデフォルト献立を返す
        logger.error("All parsing methods failed, returning default meals")
        return create_default_meals(target_calories)
            
    except Exception as e:
        logger.error(f"General parsing error: {e}")
        return create_default_meals(target_calories)

def parse_text_format(text: str, target_calories: int = 2000) -> list:
    """
    テキスト形式のレスポンスをパース（ログで見た実際の形式に対応）
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
            
            # 食事タイプの識別
            if '朝食' in line and not line.startswith('-'):
                if current_meal and len(current_meal['dishes']) > 0:
                    meals.append(current_meal)
                current_meal = {'mealType': '朝食', 'calories': breakfast_cal, 'dishes': [], 'color': '#FF8C42'}
            elif '昼食' in line and not line.startswith('-'):
                if current_meal and len(current_meal['dishes']) > 0:
                    meals.append(current_meal)
                current_meal = {'mealType': '昼食', 'calories': lunch_cal, 'dishes': [], 'color': '#FF8C42'}
            elif '夕食' in line and not line.startswith('-'):
                if current_meal and len(current_meal['dishes']) > 0:
                    meals.append(current_meal)
                current_meal = {'mealType': '夕食', 'calories': dinner_cal, 'dishes': [], 'color': '#FF8C42'}
            
            # 料理の抽出（「- メイン料理：」「- 副菜：」「- 汁物/飲み物：」形式）
            elif current_meal and line.startswith('- '):
                if ':' in line:
                    dish = line.split(':', 1)[-1].strip()
                    if dish and dish not in current_meal['dishes']:
                        current_meal['dishes'].append(dish)
        
        # 最後の食事を追加
        if current_meal and len(current_meal['dishes']) > 0:
            meals.append(current_meal)
        
        if len(meals) >= 1:
            logger.info(f"Successfully parsed {len(meals)} meals from text format")
            return meals
        
        # 代替パース方法を試行
        logger.warning("Trying alternative text parsing")
        alternative_meals = parse_alternative_format(text, target_calories)
        if alternative_meals:
            return alternative_meals
        
        logger.warning("Failed to parse any valid meals from text format")
        return []
        
    except Exception as e:
        logger.error(f"Text parsing error: {e}")
        return []

def parse_alternative_format(text: str, target_calories: int = 2000) -> list:
    """
    代替のテキストパース方法
    """
    try:
        breakfast_cal = int(target_calories * 0.25)
        lunch_cal = int(target_calories * 0.35)  
        dinner_cal = target_calories - breakfast_cal - lunch_cal
        
        meals = []
        
        # シンプルに行ごとに料理を抽出
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        dishes = []
        
        for line in lines:
            # 「- メイン料理：」「- 副菜：」などから料理名を抽出
            if ':' in line and ('メイン' in line or '副菜' in line or '汁物' in line or '飲み物' in line):
                dish = line.split(':', 1)[-1].strip()
                if dish:
                    dishes.append(dish)
        
        # 抽出した料理を3つずつ食事に分配
        if len(dishes) >= 3:
            meals = [
                {
                    'mealType': '朝食',
                    'calories': breakfast_cal,
                    'dishes': dishes[0:3] if len(dishes) >= 3 else dishes[0:len(dishes)],
                    'color': '#FF8C42'
                },
                {
                    'mealType': '昼食', 
                    'calories': lunch_cal,
                    'dishes': dishes[3:6] if len(dishes) >= 6 else dishes[min(3, len(dishes)):len(dishes)],
                    'color': '#FF8C42'
                },
                {
                    'mealType': '夕食',
                    'calories': dinner_cal,
                    'dishes': dishes[6:9] if len(dishes) >= 9 else dishes[min(6, len(dishes)):len(dishes)],
                    'color': '#FF8C42'
                }
            ]
            
            # 空の食事を除外
            meals = [meal for meal in meals if len(meal['dishes']) > 0]
            
            if meals:
                logger.info(f"Alternative parsing successful: {len(meals)} meals")
                return meals
        
        return []
        
    except Exception as e:
        logger.error(f"Alternative parsing error: {e}")
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

def create_default_meals(target_calories: int = 2000) -> list:
    """
    パース失敗時のデフォルト献立を作成
    """
    try:
        breakfast_cal = int(target_calories * 0.25)
        lunch_cal = int(target_calories * 0.35)
        dinner_cal = target_calories - breakfast_cal - lunch_cal
        
        import random
        
        # より多様なデフォルト献立パターン
        breakfast_options = [
            ["トースト", "目玉焼き", "コーヒー"],
            ["おにぎり", "味噌汁", "焼き魚"],
            ["パンケーキ", "ヨーグルト", "フルーツ"],
            ["お粥", "梅干し", "緑茶"],
            ["サンドイッチ", "サラダ", "牛乳"]
        ]
        
        lunch_options = [
            ["カレーライス", "サラダ", "スープ"],
            ["ラーメン", "餃子", "チャーハン"],
            ["パスタ", "パン", "野菜ジュース"],
            ["うどん", "天ぷら", "おにぎり"],
            ["丼物", "味噌汁", "漬物"]
        ]
        
        dinner_options = [
            ["ハンバーグ", "ライス", "野菜炒め"],
            ["焼き魚", "ご飯", "煮物"],
            ["ステーキ", "サラダ", "スープ"],
            ["鍋料理", "ご飯", "お漬物"],
            ["炒め物", "ライス", "中華スープ"]
        ]
        
        selected_breakfast = random.choice(breakfast_options)
        selected_lunch = random.choice(lunch_options) 
        selected_dinner = random.choice(dinner_options)
        
        default_meals = [
            {
                'mealType': '朝食',
                'calories': breakfast_cal,
                'dishes': selected_breakfast,
                'color': '#FF8C42'
            },
            {
                'mealType': '昼食',
                'calories': lunch_cal,
                'dishes': selected_lunch,
                'color': '#FF8C42'
            },
            {
                'mealType': '夕食',
                'calories': dinner_cal,
                'dishes': selected_dinner,
                'color': '#FF8C42'
            }
        ]
        
        logger.info(f"Created default meals: {default_meals}")
        return default_meals
        
    except Exception as e:
        logger.error(f"Failed to create default meals: {e}")
        # 最終フォールバック
        return [
            {
                'mealType': '朝食',
                'calories': 500,
                'dishes': ["パン", "卵", "コーヒー"],
                'color': '#FF8C42'
            },
            {
                'mealType': '昼食',
                'calories': 700,
                'dishes': ["定食", "ご飯", "味噌汁"],
                'color': '#FF8C42'
            },
            {
                'mealType': '夕食',
                'calories': 800,
                'dishes': ["メイン料理", "ご飯", "サラダ"],
                'color': '#FF8C42'
            }
        ]

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