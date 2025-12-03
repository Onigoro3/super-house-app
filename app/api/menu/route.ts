// app/api/menu/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // dishCount（品数）を受け取る
    const { ingredients, seasoning, includeRice, dishCount } = await req.json();
    console.log(`献立生成開始: ${dishCount}品コース`);

    // 品数に応じた指示
    let countInstruction = "";
    let outputCount = "";
    
    if (dishCount > 1) {
      // 複数品（定食）の場合
      countInstruction = `
        【重要：セットメニューの作成】
        今回は「1食あたり${dishCount}品」の構成で、献立セットを【3パターン】提案してください。
        
        【栄養バランスのルール】
        - 主菜（タンパク質）、副菜（ビタミン・ミネラル）、汁物などを組み合わせ、全体の栄養バランスを整えてください。
        - 味付けが重ならないように配慮してください（例：主菜がこってりなら、副菜はさっぱり）。
        - ${includeRice ? '「白ご飯」に合う構成にしてください。' : ''}
      `;
      outputCount = "3セット";
    } else {
      // 1品（単品）の場合
      countInstruction = `
        食材を活かした単品レシピを【10個】提案してください。
        ${includeRice ? 'そのうち2〜3個は、チャーハンや丼ものなど「ご飯もの」にしてください。' : ''}
      `;
      outputCount = "10個";
    }

    const prompt = `
      あなたは栄養学に精通したプロの料理家です。
      以下の「食材」と「調味料」を使い、家庭的な献立を考案してください。

      【使用する食材】
      ${ingredients.join(', ')}

      【使える調味料】
      ${seasoning}

      ${countInstruction}

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のリストで出力してください。
      1つの要素が「1つの献立セット」になります。
      
      [
        {
          "menu_title": "献立のタイトル（例：栄養満点！豚肉定食）",
          "nutrition_point": "栄養バランスの解説（例：豚肉のビタミンB1と野菜のビタミンCで疲労回復！）",
          "total_calories": 750,
          "dishes": [
            {
              "title": "1品目の料理名",
              "type": "主菜/副菜/汁物",
              "difficulty": "簡単",
              "ingredients": ["材料A", "材料B"],
              "steps": ["手順1", "手順2"]
            },
            {
              "title": "2品目の料理名（2品以上の場合）",
              ...
            }
          ]
        }
      ]
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // 2.0がダメなら gemini-1.5-flash
    
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