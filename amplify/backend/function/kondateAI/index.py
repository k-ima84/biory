import json
import boto3

"""サンプルとして作ったもの 小澤（hello XXさん）
def handler(event, context):

    try:
          # 引数を取得(AppSyncから受け取ったeventを処理)
         name = event.get('arguments', {}).get('name', 'World')
    
         # シンプルなメッセージを返す(ビジネスロジック)
         message = f"Hello {name}!"
    
         # appSyncに文字列として返却
         return message

    except:
         return "Error occurred"
"""


def handler(event, context):
    try:
        # 引数を取得
        name = event.get('arguments', {}).get('name', 'World')
        
        print(f"=== 管理栄養士AI Claude 3 v11.0 === {name}")
        
        # Bedrock クライアント
        bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-1')

        # 管理栄養士としての詳細なシステムプロンプト
        system_prompt = """
あなたは管理栄養士免許を持つ専門家です。

## 専門的配慮
- 栄養学に基づいた献立作成
- PFCバランス（タンパク質:炭水化物:脂質 = 15-20%:50-65%:20-30%）
- 1日摂取カロリー目安（成人女性1800-2000kcal、成人男性2200-2500kcal）
- 食事バランスガイド準拠

## 注意事項
- 栄養バランス（PFCバランス）を必ず考慮
- アレルギーを必ず考慮
- 実際に調理可能なメニューを提案
- 塩分・糖分に配慮

## 出力形式（Markdown）
```markdown
# {名前}さんの1日献立プラン
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

## 配慮したこと(アレルギー食材、好き嫌い、運動量など)
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
- 季節: 現在の季節に適した食材を使用
- 食事スタイル: 日本の家庭料理中心
- 調理難易度: 初心者でも作れるレベル
- アレルギー： 卵(卵を材料とする料理は禁止)
- 特別な要望: なし（標準的な健康献立）

よろしくお願いします。
"""

        # Claude 3 Sonnet でAI応答
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 5000,  # 献立提案のため増量
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
        
        # レスポンス取得
        result = json.loads(response.get('body').read())
        ai_response = result['content'][0]['text']
        
        return ai_response  # Markdown形式の献立プランをそのまま返却
        
    except Exception as e:
        return f"管理栄養士AI エラー v11.0: {str(e)}"

