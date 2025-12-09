// app/api/adventure/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  // ★修正1: エラー時にも使えるように、ここで変数を定義しておく
  let currentStatus = { hp: 100, inventory: [] };

  try {
    const body = await req.json();
    const { genre, action, history } = body;
    
    // データがあれば更新
    if (body.currentStatus) {
      currentStatus = body.currentStatus;
    }

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

    // ★修正2: 最新モデル 'gemini-2.5-flash' を使用
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    // 履歴の整形
    const chatHistory = history ? history.slice(-10).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })) : [];

    // 先頭がmodelならダミーuserを追加（エラー回避）
    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.unshift({
        role: 'user',
        parts: [{ text: '（ゲーム開始）' }]
      });
    }

    const chat = model.startChat({
      history: chatHistory
    });

    const result = await chat.sendMessage(prompt);
    let text = result.response.text();
    
    // JSONクリーニング
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Adventure Error:", error);
    
    // エラー時は直前のステータスをそのまま返し、メッセージを表示
    return NextResponse.json({ 
      text: `【システムメッセージ】\n通信エラーが発生しました: ${error.message}\n(ステータスは維持されます。もう一度試してください)`,
      new_status: currentStatus, // ★ここで安全に参照できる
      game_over: false,
      choices: ["再試行"]
    });
  }
}