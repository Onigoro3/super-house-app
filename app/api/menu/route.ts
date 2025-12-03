// app/api/menu/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // servings（人数）を受け取る
    const { ingredients, seasoning, includeRice, dishCount, servings } = await req.json();
    console.log(`献立生成開始: ${dishCount}品コース, ${servings}人分`);

    const prompt = `
      あなたは家庭の冷蔵庫にあるものだけで料理を作る「在庫処分の天才シェフ」です。
      以下の「在庫食材」と「在庫調味料」**だけ**を使って、${servings}人分の献立セットを【5パターン】考案してください。

      【絶対に守るルール】
      1. **在庫にない食材・調味料は絶対に使わないこと。**
         （水、塩、こしょう、サラダ油の4つだけは在庫になくても使用可とします。それ以外は不可）
      2. 「買い物に行かずに作れる」ことが絶対条件です。
      3. 各料理の材料には、${servings}人分の具体的な分量（g数や個数）を必ず明記すること。「適量」は禁止。

      【使用可能な在庫食材】
      ${ingredients.join(', ')}
      ${includeRice ? '(＋白ご飯)' : ''}

      【使用可能な在庫調味料】
      ${seasoning}

      【構成】
      - 1セットあたり${dishCount}品（${includeRice ? 'ご飯に合うおかず中心' : 'おかずのみ'}）
      - 栄養バランスと味のバランスを考慮すること。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。余計な文章は不要です。
      
      [
        {
          "menu_title": "献立名（例：豚肉とキャベツの味噌炒め定食）",
          "nutrition_point": "栄養解説",
          "total_calories": 750,
          "dishes": [
            {
              "title": "料理名",
              "type": "主菜/副菜/汁物",
              "difficulty": "簡単",
              "ingredients": ["豚肉 200g", "キャベツ 1/4個(300g)", "味噌 大さじ2"],
              "steps": ["手順1", "手順2"]
            }
          ]
        }
      ]
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || "[]";
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Menu Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}