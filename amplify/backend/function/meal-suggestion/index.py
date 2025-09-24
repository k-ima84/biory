import json
import boto3
import logging
from typing import Dict, Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

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
        
        # Bedrockへのプロンプト作成
        prompt = create_meal_prompt(user_preferences, dietary_restrictions, target_calories)
        
        # Bedrock Claude 3 Haikuを呼び出し
        response = bedrock.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1500,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        # レスポンスの解析
        response_body = json.loads(response['body'].read())
        meal_suggestion_text = response_body['content'][0]['text']
        
        # JSON形式の献立データを抽出
        meal_data = parse_meal_suggestion(meal_suggestion_text)
        
        return {
            'statusCode': 200,
            'headers': cors_headers(),
            'body': json.dumps({
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
    prompt = f"""
あなたは経験豊富な栄養士です。以下の条件に基づいて1日の献立（朝食、昼食、夕食）を提案してください。

【基本条件】
- 健康的でバランスの取れた食事
- 日本の食材を中心とした料理
- 1日の総カロリー目安: {target_calories}kcal
- 各食事のカロリー配分: 朝食25%, 昼食35%, 夕食40%

【制約事項】
{f"- 食事制限: {', '.join(restrictions)}" if restrictions else "- 特別な食事制限なし"}

【ユーザーの好み】
{json.dumps(preferences, ensure_ascii=False) if preferences else "特になし"}

以下のJSON形式で正確に回答してください:
{{
  "meals": [
    {{
      "mealType": "朝食",
      "calories": 500,
      "dishes": ["料理名1", "料理名2", "料理名3", "料理名4"],
      "color": "#FF8C42"
    }},
    {{
      "mealType": "昼食", 
      "calories": 700,
      "dishes": ["料理名1", "料理名2", "料理名3", "料理名4"],
      "color": "#FF8C42"
    }},
    {{
      "mealType": "夕食",
      "calories": 800,
      "dishes": ["料理名1", "料理名2", "料理名3", "料理名4"],
      "color": "#FF8C42"
    }}
  ]
}}

JSON以外の説明文は不要です。
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