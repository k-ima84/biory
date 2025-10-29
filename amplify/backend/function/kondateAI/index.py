import json
import boto3
import time


def handler(event, context):
    try:
        start_time = time.time()
        
        # 引数を取得
        name = event.get('arguments', {}).get('name', 'World')
        allergies = event.get('arguments', {}).get('allergies', 'なし')
        recommended_calories = event.get('arguments', {}).get('recommendedCalories', 2000)
        condition = event.get('arguments', {}).get('condition', '')  # 体調情報
        mood = event.get('arguments', {}).get('mood', '')  # 気分情報
        
        print(f"=== 管理栄養士AI Claude 3 v11.0 === {name}")
        print(f"受け取ったアレルギー情報: {allergies}")
        print(f"受け取った推奨カロリー: {recommended_calories}kcal")
        print(f"受け取った体調情報: {condition}")
        print(f"受け取った気分情報: {mood}")
        
        # アレルギー情報の正規化
        allergies_text = allergies if allergies and allergies.strip() else "なし"
        
        # 体調・気分情報の正規化と有効性判定
        valid_conditions = ['とても良い 😊', '良い 😌', '普通 😐', '少し悪い 😟', '悪い 😵']
        valid_moods = ['ポジティブ', '普通', 'ネガティブ', 'リラックス', 'やる気満々', '疲れ気味']
        
        condition_text = condition if condition and condition.strip() and condition in valid_conditions else ""
        mood_text = mood if mood and mood.strip() and mood in valid_moods else ""
        
        # 絵文字を除去したテキストを作成（AIへの入力用）
        condition_for_ai = condition_text.split(' ')[0] if condition_text else ""
        mood_for_ai = mood_text
        
        print(f"正規化後の体調: {condition_text if condition_text else '未設定'}")
        print(f"正規化後の気分: {mood_text if mood_text else '未設定'}")
        print(f"AI用体調テキスト: {condition_for_ai if condition_for_ai else '未設定'}")
        print(f"AI用気分テキスト: {mood_for_ai if mood_for_ai else '未設定'}")
        
        # Bedrock クライアント
        bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-1')

        # 管理栄養士としての詳細なシステムプロンプト
        system_prompt = f"""
あなたは管理栄養士免許を持つ専門家です。

## 専門的配慮
- 栄養学に基づいた献立作成
- PFCバランス（タンパク質:炭水化物:脂質 = 15-20%:50-65%:20-30%）
- 1日摂取カロリー上限: {recommended_calories}kcal（ユーザーの年齢・性別・身体活動量に基づいた推奨値）
- 食事バランスガイド準拠

## 注意事項
- 栄養バランス（PFCバランス）を考慮
- アレルギーのある食材は絶対に使用しない
- 実際に調理可能なメニューを提案
- 塩分・糖分に配慮
- 体調や気分の情報がある場合は、それに配慮した献立を作成する

## 出力形式（Markdown）
```markdown
# {{名前}}さんの1日献立プラン
## 朝食
- **メニュー**: 
- **カロリー**: 約XXXkcal
- **栄養バランス**: タンパク質XXg、炭水化物XXg、脂質XXg
- **使用食材リストと分量**:
  - 食材1: XXg
  - 食材2: XXg
  - 食材3: XXg
- **簡単な調理手順**:
- **栄養ポイント**: 

## 昼食  
- **メニュー**: 
- **カロリー**: 約XXXkcal
- **栄養バランス**: タンパク質XXg、炭水化物XXg、脂質XXg
- **使用食材リストと分量**:
  - 食材1: XXg
  - 食材2: XXg
  - 食材3: XXg
- **簡単な調理手順**:
- **栄養ポイント**: 

## 夕食
- **メニュー**: 
- **カロリー**: 約XXXkcal
- **栄養バランス**: タンパク質XXg、炭水化物XXg、脂質XXg
- **使用食材リストと分量**:
  - 食材1: XXg
  - 食材2: XXg
  - 食材3: XXg
- **簡単な調理手順**:
- **栄養ポイント**: 

## 1日合計
- **総カロリー**: 約XXXkcal
- **栄養バランス**: タンパク質XXg、炭水化物XXg、脂質XXg

## 配慮したこと(アレルギー食材、好き嫌い、運動量、体調、気分など)
- 

## 健康アドバイス
- 
```
"""


        # ユーザーへの質問メッセージ
        user_message = f"""
{name}さん専用の1日献立を作成してください。

## 今回の条件
- 対象者: {name}さん
- 推奨カロリー: {recommended_calories}kcal（1日の総カロリーを推奨カロリー以下にしてください。）
- 季節: 現在の季節に適した食材を使用
- 食事スタイル: 日本の家庭料理中心
- 調理難易度: 初心者でも作れるレベル
- アレルギー: {allergies_text}
- 本日の体調：{condition_for_ai if condition_for_ai else '未設定'}
- 本日の気分：{mood_for_ai if mood_for_ai else '未設定'}
- 総カロリーは各食事のカロリーを合計した値としてください。
- 特別な要望: なし（標準的な健康献立）

よろしくお願いします。
"""

        print(f"⏱️ プロンプト準備完了: {time.time() - start_time:.2f}秒")

        # Claude 3 Sonnet でAI応答
        bedrock_start = time.time()
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 3000,  # レスポンス時間短縮のため調整（5000→3000）
            "temperature": 0.7,
            "system": system_prompt,  # 詳細なシステムプロンプト
            "messages": [
                {
                    "role": "user",
                    "content": user_message
                }
            ]
        })
        
        # APAC Claude 3 Sonnet Inference Profileを使用
        response = bedrock.invoke_model(
            body=body,
            modelId='apac.anthropic.claude-3-sonnet-20240229-v1:0',
            accept='application/json',
            contentType='application/json'
        )
        
        print(f"⏱️ Bedrock API呼び出し: {time.time() - bedrock_start:.2f}秒")
        
        # レスポンス取得
        parse_start = time.time()
        result = json.loads(response.get('body').read())
        ai_response = result['content'][0]['text']
        print(f"⏱️ レスポンスパース: {time.time() - parse_start:.2f}秒")
        
        # デバッグ情報を含むJSONレスポンスを返却
        json_start = time.time()
        response_data = {
            "response": ai_response,
            "debug": {
                "systemPrompt": system_prompt,
                "userMessage": user_message,
                "userName": name,
                "allergies": allergies_text,
                "recommendedCalories": recommended_calories,
                "condition": condition_for_ai if condition_for_ai else "未設定",
                "mood": mood_for_ai if mood_for_ai else "未設定"
            }
        }
        
        result_json = json.dumps(response_data, ensure_ascii=False)
        print(f"⏱️ JSONシリアライズ: {time.time() - json_start:.2f}秒")
        print(f"⏱️ 合計処理時間: {time.time() - start_time:.2f}秒")
        print(f"📦 レスポンスサイズ: {len(result_json)} bytes")
        
        return result_json
        
    except Exception as e:
        error_response = {
            "response": f"管理栄養士AI エラー v12.0: {str(e)}",
            "debug": None
        }
        return json.dumps(error_response, ensure_ascii=False)

