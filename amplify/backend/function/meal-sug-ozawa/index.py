import json

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