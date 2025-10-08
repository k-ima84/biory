import json
import boto3
import logging
import os
import csv
import io
from typing import Dict, Any, List

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
logging.basicConfig(level=logging.DEBUG)

bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-1')
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

# 栄養データベースをグローバル変数として保持
NUTRITION_DB = None

def load_nutrition_data() -> Dict[str, Dict]:
    """
    栄養データCSVを読み込んで辞書形式で返す
    """
    global NUTRITION_DB
    if NUTRITION_DB is not None:
        return NUTRITION_DB
    
    try:
        # S3やローカルファイルから読み込む（ここではサンプルデータを作成）
        nutrition_data = {
            # 主食類 (category 01)
            "白米": {"calories": 156, "protein": 2.5, "fat": 0.3, "carbs": 35.6, "category": "主食"},
            "玄米": {"calories": 165, "protein": 2.8, "fat": 1.0, "carbs": 35.6, "category": "主食"},
            "食パン": {"calories": 260, "protein": 9.3, "fat": 4.4, "carbs": 46.7, "category": "主食"},
            "うどん": {"calories": 105, "protein": 2.6, "fat": 0.4, "carbs": 21.6, "category": "主食"},
            "そば": {"calories": 132, "protein": 4.8, "fat": 1.9, "carbs": 26.0, "category": "主食"},
            "パスタ": {"calories": 149, "protein": 5.2, "fat": 0.9, "carbs": 30.3, "category": "主食"},
            
            # タンパク質源 (category 04, 05, 06)
            "鶏むね肉": {"calories": 191, "protein": 19.5, "fat": 11.6, "carbs": 0, "category": "肉類"},
            "豚ロース": {"calories": 263, "protein": 19.3, "fat": 19.2, "carbs": 0.2, "category": "肉類"},
            "牛もも肉": {"calories": 182, "protein": 21.2, "fat": 9.6, "carbs": 0.5, "category": "肉類"},
            "鮭": {"calories": 138, "protein": 22.3, "fat": 4.1, "carbs": 0.1, "category": "魚類"},
            "さば": {"calories": 202, "protein": 20.6, "fat": 12.1, "carbs": 0.3, "category": "魚類"},
            "卵": {"calories": 151, "protein": 12.3, "fat": 10.3, "carbs": 0.3, "category": "卵類"},
            "豆腐": {"calories": 56, "protein": 4.9, "fat": 3.0, "carbs": 1.6, "category": "豆類"},
            "納豆": {"calories": 200, "protein": 16.5, "fat": 10.0, "carbs": 12.1, "category": "豆類"},
            
            # 野菜類 (category 07)
            "キャベツ": {"calories": 23, "protein": 1.3, "fat": 0.2, "carbs": 5.2, "category": "野菜"},
            "にんじん": {"calories": 39, "protein": 0.6, "fat": 0.2, "carbs": 9.3, "category": "野菜"},
            "玉ねぎ": {"calories": 37, "protein": 1.0, "fat": 0.1, "carbs": 8.8, "category": "野菜"},
            "ブロッコリー": {"calories": 33, "protein": 4.3, "fat": 0.5, "carbs": 5.2, "category": "野菜"},
            "ほうれん草": {"calories": 20, "protein": 2.2, "fat": 0.4, "carbs": 3.1, "category": "野菜"},
            "トマト": {"calories": 19, "protein": 0.7, "fat": 0.1, "carbs": 4.7, "category": "野菜"},
            "きのこ": {"calories": 22, "protein": 3.0, "fat": 0.3, "carbs": 4.9, "category": "野菜"},
            "さつまいも": {"calories": 132, "protein": 1.2, "fat": 0.2, "carbs": 31.5, "category": "野菜"},
            
            # 調味料・その他
            "味噌汁": {"calories": 32, "protein": 2.2, "fat": 1.0, "carbs": 4.3, "category": "汁物"},
            "サラダ": {"calories": 15, "protein": 1.0, "fat": 0.1, "carbs": 3.5, "category": "野菜"},
            "コーヒー": {"calories": 4, "protein": 0.2, "fat": 0, "carbs": 0.7, "category": "飲料"},
            "牛乳": {"calories": 67, "protein": 3.3, "fat": 3.8, "carbs": 4.8, "category": "飲料"},
        }
        
        NUTRITION_DB = nutrition_data
        logger.info(f"Loaded {len(nutrition_data)} nutrition items")
        return nutrition_data
        
    except Exception as e:
        logger.error(f"Failed to load nutrition data: {e}")
        return {}

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

def create_balanced_meal(target_calories: int, meal_type: str, nutrition_db: Dict) -> Dict:
    """
    栄養データベースを使って栄養バランスの取れた食事を作成
    """
    import random
    
    try:
        meal = {
            "mealType": meal_type,
            "calories": 0,
            "dishes": [],
            "color": "#FF8C42"
        }
        
        # 食事タイプ別のカロリー配分
        if meal_type == "朝食":
            target_range = (200, min(500, target_calories * 0.3))
        elif meal_type == "昼食":
            target_range = (400, min(800, target_calories * 0.4))
        else:  # 夕食
            target_range = (500, min(900, target_calories * 0.5))
        
        target_cal = random.randint(int(target_range[0]), int(target_range[1]))
        current_calories = 0
        
        # 主食を選択
        staples = [name for name, data in nutrition_db.items() if data["category"] == "主食"]
        if staples and current_calories < target_cal * 0.6:
            staple = random.choice(staples)
            staple_portion = 1.0 if meal_type == "朝食" else 1.5  # 朝食は少なめ
            staple_calories = int(nutrition_db[staple]["calories"] * staple_portion)
            meal["dishes"].append(f"{staple}({staple_calories}kcal)")
            current_calories += staple_calories
        
        # タンパク質源を選択
        proteins = [name for name, data in nutrition_db.items() 
                   if data["category"] in ["肉類", "魚類", "卵類", "豆類"]]
        if proteins and current_calories < target_cal * 0.8:
            protein = random.choice(proteins)
            protein_portion = 0.8 if meal_type == "朝食" else 1.2
            protein_calories = int(nutrition_db[protein]["calories"] * protein_portion)
            meal["dishes"].append(f"{protein}({protein_calories}kcal)")
            current_calories += protein_calories
        
        # 野菜・副菜を選択
        vegetables = [name for name, data in nutrition_db.items() 
                     if data["category"] in ["野菜", "汁物"]]
        if vegetables and len(meal["dishes"]) < 3:
            vegetable = random.choice(vegetables)
            veg_calories = nutrition_db[vegetable]["calories"]
            meal["dishes"].append(f"{vegetable}({veg_calories}kcal)")
            current_calories += veg_calories
        
        # 飲み物を追加（朝食の場合）
        if meal_type == "朝食" and len(meal["dishes"]) < 3:
            beverages = [name for name, data in nutrition_db.items() if data["category"] == "飲料"]
            if beverages:
                beverage = random.choice(beverages)
                bev_calories = nutrition_db[beverage]["calories"]
                meal["dishes"].append(f"{beverage}({bev_calories}kcal)")
                current_calories += bev_calories
        
        meal["calories"] = current_calories
        return meal
        
    except Exception as e:
        logger.error(f"Failed to create balanced meal: {e}")
        return {
            "mealType": meal_type,
            "calories": target_cal if 'target_cal' in locals() else 400,
            "dishes": [f"定食({target_cal if 'target_cal' in locals() else 400}kcal)"],
            "color": "#FF8C42"
        }

def create_meal_prompt(preferences: Dict, restrictions: list, target_calories: int) -> str:
    """
    ユーザープロファイルと栄養データベースを考慮した現実的なプロンプトを作成
    """
    import random
    import time
    
    # 栄養データベースを読み込み
    nutrition_db = load_nutrition_data()
    
    # ユーザー情報を取得
    allergies = preferences.get('allergies', '')
    
    # アレルギー制約を厳格に設定
    allergy_constraints = ""
    if allergies and allergies.strip() and allergies != "なし":
        allergy_constraints = f"\n【重要・必須条件】以下の食材は絶対に使用禁止: {allergies}"
        allergy_constraints += "\n上記食材が含まれる料理や調味料も一切使用しないでください。"
    
    # ランダム要素を追加してバリエーションを作る
    random_seed = int(time.time()) % 10000
    
    # 栄養データベースから実際のカロリーを持つ料理例を生成
    realistic_dishes = []
    for food_name, nutrition in nutrition_db.items():
        calorie = nutrition["calories"]
        category = nutrition["category"]
        if category == "主食":
            realistic_dishes.append(f"{food_name}({calorie}kcal/100g)")
        elif category in ["肉類", "魚類"]:
            realistic_dishes.append(f"{food_name}({calorie}kcal/100g)")
        elif category == "野菜":
            realistic_dishes.append(f"{food_name}({calorie}kcal/100g)")
    
    # カロリー許容範囲を設定（±200kcalの幅を持たせる）
    target_min = max(1200, target_calories - 200)
    target_max = target_calories + 200
    
    prompt = f"""以下のJSON形式で栄養バランスの取れた現実的な献立を提案してください：

{{
  "meals": [
    {{
      "mealType": "朝食",
      "calories": 実際のカロリー数値,
      "dishes": ["料理名(カロリー)", "料理名(カロリー)"]
    }},
    {{
      "mealType": "昼食",
      "calories": 実際のカロリー数値,
      "dishes": ["料理名(カロリー)", "料理名(カロリー)", "料理名(カロリー)"]
    }},
    {{
      "mealType": "夕食",
      "calories": 実際のカロリー数値,
      "dishes": ["料理名(カロリー)", "料理名(カロリー)"]
    }}
  ]
}}

【重要な条件】
- 合計カロリーは{target_min}～{target_max}kcal程度（厳密でなくて可）
- 各料理のカロリーは100gあたりの実際値を基準にする
- 朝食200-500kcal、昼食400-800kcal、夕食500-900kcal程度
- 主食・タンパク質・野菜をバランス良く組み合わせる
- 2食または3食、柔軟に調整可能
{allergy_constraints}
- 10月の秋の食材（さつまいも、きのこ、鮭など）を活用

栄養データ参考例: {', '.join(random.sample(realistic_dishes, min(6, len(realistic_dishes))))}

栄養バランスと実際のカロリーを考慮してJSON形式のみ回答してください。
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
    栄養データベースを活用した現実的なデフォルト献立を作成
    """
    try:
        # 栄養データベースを読み込み
        nutrition_db = load_nutrition_data()
        
        if not nutrition_db:
            # フォールバック：従来の方式
            return create_simple_default_meals(target_calories)
        
        meals = []
        used_calories = 0
        
        # 食事数を決定（低カロリーの場合は2食）
        meal_types = ["朝食", "昼食", "夕食"] if target_calories >= 1500 else ["昼食", "夕食"]
        
        for meal_type in meal_types:
            # 残りカロリーを考慮して各食事を作成
            remaining_calories = target_calories - used_calories
            remaining_meals = len(meal_types) - meal_types.index(meal_type)
            avg_remaining = remaining_calories / remaining_meals if remaining_meals > 0 else remaining_calories
            
            meal = create_balanced_meal(int(avg_remaining), meal_type, nutrition_db)
            meals.append(meal)
            used_calories += meal["calories"]
        
        total_calories = sum(meal["calories"] for meal in meals)
        logger.info(f"Created nutrition-based meals with total {total_calories}kcal (target: {target_calories}kcal)")
        
        return meals
        
    except Exception as e:
        logger.error(f"Failed to create nutrition-based meals: {e}")
        return create_simple_default_meals(target_calories)

def create_simple_default_meals(target_calories: int = 2000) -> list:
    """
    シンプルなデフォルト献立（フォールバック用）
    """
    try:
        import random
        
        # 現実的なカロリーを持つ献立パターン
        breakfast_options = [
            {"dishes": ["トースト1枚(260kcal)", "目玉焼き(90kcal)"], "calories": 350},
            {"dishes": ["おにぎり2個(320kcal)", "味噌汁(32kcal)"], "calories": 352},
            {"dishes": ["卵かけご飯(350kcal)"], "calories": 350}
        ]
        
        lunch_options = [
            {"dishes": ["カレーライス(650kcal)", "サラダ(15kcal)"], "calories": 665},
            {"dishes": ["パスタ(550kcal)", "サラダ(15kcal)"], "calories": 565},
            {"dishes": ["定食(650kcal)"], "calories": 650}
        ]
        
        dinner_options = [
            {"dishes": ["焼き魚定食(580kcal)"], "calories": 580},
            {"dishes": ["ハンバーグ(300kcal)", "ライス(240kcal)", "サラダ(15kcal)"], "calories": 555},
            {"dishes": ["鍋料理(400kcal)", "ご飯(160kcal)"], "calories": 560}
        ]
        
        # ランダムに選択
        selected_breakfast = random.choice(breakfast_options)
        selected_lunch = random.choice(lunch_options)
        selected_dinner = random.choice(dinner_options)
        
        # 2食でも十分な場合は2食にする
        if target_calories < 1500:
            meals = [
                {
                    'mealType': '昼食',
                    'calories': selected_lunch["calories"],
                    'dishes': selected_lunch["dishes"],
                    'color': '#FF8C42'
                },
                {
                    'mealType': '夕食',
                    'calories': selected_dinner["calories"],
                    'dishes': selected_dinner["dishes"],
                    'color': '#FF8C42'
                }
            ]
        else:
            meals = [
                {
                    'mealType': '朝食',
                    'calories': selected_breakfast["calories"],
                    'dishes': selected_breakfast["dishes"],
                    'color': '#FF8C42'
                },
                {
                    'mealType': '昼食',
                    'calories': selected_lunch["calories"],
                    'dishes': selected_lunch["dishes"],
                    'color': '#FF8C42'
                },
                {
                    'mealType': '夕食',
                    'calories': selected_dinner["calories"],
                    'dishes': selected_dinner["dishes"],
                    'color': '#FF8C42'
                }
            ]
        
        logger.info(f"Created simple default meals with total {sum(meal['calories'] for meal in meals)}kcal")
        return meals
        
    except Exception as e:
        logger.error(f"Failed to create simple default meals: {e}")
        # 最終フォールバック
        return [
            {
                'mealType': '昼食',
                'calories': 650,
                'dishes': ["定食(650kcal)"],
                'color': '#FF8C42'
            },
            {
                'mealType': '夕食',
                'calories': 580,
                'dishes': ["焼き魚定食(580kcal)"],
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