// app/api/menu/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // adultCount, childCount を受け取る
    const { ingredients, seasoning, includeRice, dishCount, adultCount, childCount } = await req.json();
    console.log(`献立生成: ${dishCount}品, 大人${adultCount}人, 子供${childCount}人`);

    // 子供がいる場合の特別ルールを作成
    let childInstruction = "";
    if (childCount > 0) {
      childInstruction = `
      【重要：子供への配慮】
      食べる人の中に「子供が${childCount}人」含まれています。
      - 辛味（唐辛子など）は控えるか、別添えにする提案をしてください。
      - 子供が食べにくい野菜などは、細かく刻むなどの工夫を「作り方」に含めてください。
      - 味付けは濃すぎず、家族みんなが楽しめるものにしてください。
      `;
    }

    const totalMembers = adultCount + childCount;

    const prompt = `
      あなたはプロの料理家です。
      以下の「在庫食材」と「在庫調味料」**だけ**を使って、${adultCount}人の大人と${childCount}人の子供（合計${totalMembers}人分）の献立セットを【5パターン】考案してください。

      【ルール】
      1. 在庫にない食材は極力使わない（水、塩、こしょう、油はOK）。
      2. 「買い物に行かずに作れる」ことが条件。
      3. 各料理の材料には、**合計${totalMembers}人分**の具体的な分量（g数や個数）を明記すること。

      ${childInstruction}

      【作り方の記述ルール】
      - 初心者でも迷わないよう、極めて具体的に書いてください。
      - 「中火で3分」のように火加減と時間を書くこと。

      【在庫食材】
      ${ingredients.join(', ')}
      ${includeRice ? '(＋白ご飯)' : ''}

      【在庫調味料】
      ${seasoning}

      【構成】
      - 1セットあたり${dishCount}品
      - 栄養バランスを考慮。

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
              "ingredients": ["豚肉 300g", "玉ねぎ 2個"],
              "steps": ["手順1", "手順2"]
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