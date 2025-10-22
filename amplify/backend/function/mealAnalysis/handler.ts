import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export const handler = async (event: any) => {
  try {
    const mealItems = event.arguments?.mealItems || [];
    
    console.log(`=== 食事分析AI === 分析対象: ${mealItems.join(', ')}`);
    
    const bedrock = new BedrockRuntimeClient({ region: 'ap-northeast-1' });

    const systemPrompt = `
あなたは管理栄養士です。入力された食事内容から正確なカロリーとPFC（タンパク質・脂質・炭水化物）を分析してください。

## 分析基準
- 日本食品標準成分表に基づく
- 一般的な1人前の分量で計算
- 調理方法も考慮

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

各食品のカロリーとPFC（タンパク質・脂質・炭水化物）をg単位で算出し、JSON形式で返してください。
`;

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2000,
      temperature: 0.1,
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

    // JSONを抽出
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return aiResponse;
    
  } catch (error) {
    console.error('Error:', error);
    return `食事分析AI エラー: ${error}`;
  }
};