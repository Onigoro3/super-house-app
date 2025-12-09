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
      1. プレイヤーの行動の成否を判定し（必要なら運要素も加味して）、結果を描写してください。
      2. 臨場感あふれる小説のような文体で書いてください。
      3. プレイヤーがダメージを受ける場面ではHPを減らしてください。
      4. アイテムを手に入れたり失ったりしたら所持品を更新してください。
      5. 物語が完結（クリアまたは死亡）した場合は game_over: true にしてください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のみを出力してください。

      {
        "text": "ゲームマスターの描写テキスト...",
        "new_status": {
          "hp": <更新後のHP>,
          "inventory": ["<更新後の所持品1>", ...]
        },
        "game_over": false,
        "choices": ["次の行動のヒント1", "ヒント2", "ヒント3"]
      }
    `;

    // 安定版モデルを使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    // 過去の文脈を含める（直近5ターン分くらい）
    const chatHistory = history.slice(-10).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    const chat = model.startChat({
      history: [
        ...chatHistory,
        { role: "user", parts: [{ text: prompt }] } // 今回のプロンプト
      ]
    });

    const result = await chat.sendMessage("行動判定と描写をお願いします");
    const text = result.response.text();
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Adventure Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}