import json
import boto3
import logging
from typing import Dict, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-1')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    献立提案Lambda関数のメインハンドラー
    """
    try:
        # CORS対応
        if event.get('httpMethod') == 'OPTIONS':
            return cors_response()
        
        # リクエストボディの解析
        body = json.loads(event.get('body', '{}'))
        user_preferences = body.get('preferences', {})
        dietary_restrictions = body.get('dietaryRestrictions', [])
        target_calories = body.get('targetCalories', 2000)
        
        logger.info(f"Received preferences: {user_preferences}")
        logger.info(f"Target calories: {target_calories}")
        
        # Bedrockへのプロンプト作成
        prompt = create_meal_prompt(user_preferences, dietary_restrictions, target_calories)
        
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
        response_body = json.loads(response['body'].read())
        meal_suggestion_text = response_body['results'][0]['outputText']
        
        # JSON形式の献立データを抽出
        meal_data = parse_meal_suggestion(meal_suggestion_text)
        
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({
                'suggestion': json.dumps({"meals": meal_data}, ensure_ascii=False),
                'meals': meal_data,
                'totalCalories': sum(meal['calories'] for meal in meal_data),
                'timestamp': context.aws_request_id
            }, ensure_ascii=False)
        }
        
    except Exception as e:
        logger.error(f"Error in meal suggestion: {str(e)}")
        return {
            'statusCode': 500,
            'headers': cors_headers(),
            'body': json.dumps({'error': 'Internal server error'})
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
あなたは経験豊富な管理栄養士です。以下の条件で{random_season}にふさわしい{random_style}中心の1日の献立を提案してください。

【ユーザー情報】
- 性別: {gender or '不明'}
- 体重: {weight}kg
- 好きな食べ物: {favorite_foods or '特になし'}
- 嫌いな食べ物: {disliked_foods or '特になし'}
- アレルギー: {allergies or 'なし'}

【条件】
- 総カロリー: {target_calories}kcal
- 朝食25%、昼食35%、夕食40%の配分
- ユーザーの好みを反映し、嫌いなものやアレルギーは絶対に除外
- 毎回異なるメニューを提案（リクエスト番号: {random_number}）
- 季節の食材を使用

以下のJSON形式で回答してください：
{{
  "meals": [
    {{
      "mealType": "朝食",
      "calories": {int(target_calories * 0.25)},
      "dishes": ["具体的な料理名1", "具体的な料理名2", "具体的な料理名3"]
    }},
    {{
      "mealType": "昼食",
      "calories": {int(target_calories * 0.35)},
      "dishes": ["具体的な料理名1", "具体的な料理名2", "具体的な料理名3"]
    }},
    {{
      "mealType": "夕食",
      "calories": {int(target_calories * 0.40)},
      "dishes": ["具体的な料理名1", "具体的な料理名2", "具体的な料理名3"]
    }}
  ]
}}
"""
    return prompt

def parse_meal_suggestion(text: str) -> list:
    """
    Bedrockからの応答をパースして献立データを抽出
    """
    try:
        # JSON部分を抽出
        start_idx = text.find('{')
        end_idx = text.rfind('}') + 1
        
        if start_idx != -1 and end_idx != -1:
            json_str = text[start_idx:end_idx]
            data = json.loads(json_str)
            return data.get('meals', [])
        else:
            # フォールバック: デフォルト献立
            return get_default_meals()
            
    except json.JSONDecodeError:
        logger.warning("Failed to parse Bedrock response, using default meals")
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

def cors_response() -> Dict[str, Any]:
    """
    OPTIONS用のCORSレスポンス
    """
    return {
        'statusCode': 200,
        'headers': cors_headers(),
        'body': ''
    }