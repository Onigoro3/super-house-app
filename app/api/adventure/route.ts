// app/api/adventure/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { genre, action, history, currentStatus } = await req.json();

    const prompt = `
      あなたはTRPG（テーブルトークRPG）の熟練ゲームマスターです。
      プレイヤーの行動に対して、物語の続きを描写してください。

      【設定】
      - ジャンル: ${genre}
      - 現在の状態: HP=${currentStatus.hp}, 所持品=${currentStatus.inventory.join(',')}

      【プレイヤーの行動】
      "${action}"

      【ルール】
      1. プレイヤーの行動の成否を判定し、結果を描写してください。
      2. 臨場感あふれる小説のような文体で書いてください。
      3. ダメージを受けたらHPを減らし、アイテムを得たら所持品に追加してください。
      4. 物語が完結（クリア/死亡）したら game_over: true にしてください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のみを出力してください。Markdownの記号（\`\`\`json 等）は含めないでください。

      {
        "text": "ゲームマスターの描写テキスト...",
        "new_status": {
          "hp": 90,
          "inventory": ["剣", "薬草"]
        },
        "game_over": false,
        "choices": ["次の行動案1", "次の行動案2"]
      }
    `;

    // 安定版の1.5-flashを使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const chatHistory = history.slice(-10).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    const chat = model.startChat({
      history: [
        ...chatHistory,
        { role: "user", parts: [{ text: prompt }] }
      ]
    });

    const result = await chat.sendMessage("判定をお願いします");
    let text = result.response.text();
    
    // ★修正: JSON以外の余計な文字を徹底的に削除
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Adventure Error:", error);
    // エラー時もJSONを返してフロントエンドを止めない
    return NextResponse.json({ 
      text: "申し訳ありません。通信が不安定なようです。もう一度同じ行動を試してみてください。",
      new_status: currentStatus,
      game_over: false,
      choices: []
    });
  }
}