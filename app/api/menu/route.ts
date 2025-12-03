// app/api/menu/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { ingredients, seasoning, includeRice, dishCount, servings } = await req.json();
    console.log(`献立生成: ${dishCount}品, ${servings}人前`);

    const prompt = `
      あなたはプロの料理家です。
      以下の「在庫食材」と「在庫調味料」**だけ**を使って、${servings}人分の献立セットを【5パターン】考案してください。

      【ルール】
      1. 在庫にない食材は極力使わない（水、塩、こしょう、油はOK）。
      2. 「買い物に行かずに作れる」ことが条件。
      3. 各料理の材料には、${servings}人分の具体的な分量（g数や個数）を明記すること。

      【作り方の記述ルール（重要）】
      - 初心者でも迷わないよう、極めて具体的に書いてください。
      - 「適当に炒める」はNG。「中火で3分、豚肉の色が変わるまで炒める」のように書くこと。
      - 火加減（弱火・中火・強火）を必ず指定すること。
      - 「とろみがつくまで」「香りが立つまで」など、状態の目安を書くこと。

      【在庫食材】
      ${ingredients.join(', ')}
      ${includeRice ? '(＋白ご飯)' : ''}

      【在庫調味料】
      ${seasoning}

      【構成】
      - 1セットあたり${dishCount}品
      - 栄養と味のバランスを考慮。

      【出力JSON】
      [
        {
          "menu_title": "献立名",
          "nutrition_point": "栄養解説",
          "total_calories": 750,
          "dishes": [
            {
              "title": "料理名",
              "type": "主菜/副菜/汁物",
              "difficulty": "簡単",
              "ingredients": ["豚肉 200g", "玉ねぎ 1個"],
              "steps": ["フライパンに油(大さじ1)をひき、中火で熱する。", "豚肉を入れ、色が変わるまで2分ほど炒める。"]
            }
          ]
        }
      ]
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || "[]";
    
    return NextResponse.json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("Menu Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}