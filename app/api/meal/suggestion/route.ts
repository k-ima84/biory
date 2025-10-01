import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // モックデータで献立を生成
  const mockMeals = [
    {
      mealType: "朝食",
      calories: 480,
      dishes: ["玄米おにぎり", "鮭の塩焼き", "ほうれん草のお浸し", "りんご"],
      color: "#FF8C42"
    },
    {
      mealType: "昼食",
      calories: 650,
      dishes: ["鶏胸肉のグリル", "キノコのリゾット", "トマトとモッツァレラのサラダ", "緑茶"],
      color: "#FF8C42"
    },
    {
      mealType: "夕食",
      calories: 720,
      dishes: ["サバの味噌煮", "野菜炒め", "豆腐とわかめの味噌汁", "白米"],
      color: "#FF8C42"
    }
  ];

  return NextResponse.json({
    meals: mockMeals,
    totalCalories: mockMeals.reduce((sum, meal) => sum + meal.calories, 0)
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}