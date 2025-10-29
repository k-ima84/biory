import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export const handler = async (event: any) => {
  try {
    const mealItems = event.arguments?.mealItems || [];
    
    console.log(`=== 食事分析AI === 分析対象: ${mealItems.join(', ')}`);
    
    const bedrock = new BedrockRuntimeClient({ region: 'ap-northeast-1' });

    const systemPrompt = `
あなたは管理栄養士です。入力された食事内容から正確なカロリーとPFC（タンパク質・脂質・炭水化物）を分析してください。

## 重要な指示
- 同じ食品に対しては必ず同じ栄養価を返してください
- 日本食品標準成分表2020年版（八訂）の数値を厳密に使用してください
- 推定や幅のある値は使わず、具体的な数値のみを返してください

## 標準分量の定義
- 白米・ご飯: 150g（茶碗1杯）
- パン（食パン）: 60g（6枚切り1枚）
- 鶏胸肉: 100g
- 豚肉: 100g
- 牛肉: 100g
- 魚（切り身）: 80g
- 卵: 50g（Mサイズ1個）
- 牛乳: 200ml（コップ1杯）
- 野菜類: 100g

## 出力形式（JSON）
{
  "totalCalories": 数値,
  "totalProtein": 数値,
  "totalFat": 数値,
  "totalCarbs": 数値,
  "items": [
    {
      "name": "食品名",
      "calories": 数値,
      "protein": 数値,
      "fat": 数値,
      "carbs": 数値,
      "amount": "分量"
    }
  ]
}
`;

    const userMessage = `
以下の食事内容を分析してください：
${mealItems.map((item: string) => `- ${item}`).join('\n')}

各食品について、上記の標準分量に基づいてカロリーとPFC（タンパク質・脂質・炭水化物）をg単位で算出し、JSON形式で返してください。
必ず日本食品標準成分表の正確な数値を使用し、同じ食品には常に同じ値を返してください。
`;

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      temperature: 0,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const command = new InvokeModelCommand({
      body: body,
      modelId: 'apac.anthropic.claude-3-sonnet-20240229-v1:0',
      accept: 'application/json',
      contentType: 'application/json'
    });

    const response = await bedrock.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    const aiResponse = result.content[0].text;

    console.log('=== AI応答（生データ）===');
    console.log('型:', typeof aiResponse);
    console.log('内容:', aiResponse);
    console.log('最初の200文字:', aiResponse.substring(0, 200));

    // JSONを抽出
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('JSON抽出成功:', jsonMatch[0].substring(0, 200));
      try {
        const parsedData = JSON.parse(jsonMatch[0]);
        console.log('解析成功:', parsedData);
        const jsonString = JSON.stringify(parsedData);
        console.log('返却するJSON文字列:', jsonString);
        // JSON文字列として返す
        return jsonString;
      } catch (parseError) {
        console.error('JSON解析エラー:', parseError);
        console.error('解析失敗した文字列:', jsonMatch[0]);
        return JSON.stringify({
          totalCalories: 0,
          totalProtein: 0,
          totalFat: 0,
          totalCarbs: 0,
          error: `JSON解析エラー: ${parseError}`
        });
      }
    }

    // JSONが見つからない場合はエラー
    console.error('JSON形式のレスポンスが見つかりません:', aiResponse);
    return JSON.stringify({
      totalCalories: 0,
      totalProtein: 0,
      totalFat: 0,
      totalCarbs: 0,
      error: 'JSON形式のレスポンスが見つかりませんでした'
    });
    
  } catch (error) {
    console.error('Error:', error);
    // エラー時もJSON文字列で返す
    return JSON.stringify({
      totalCalories: 0,
      totalProtein: 0,
      totalFat: 0,
      totalCarbs: 0,
      error: `食事分析AI エラー: ${error}`
    });
  }
};