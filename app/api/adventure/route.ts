// app/api/adventure/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  let currentStatus = { hp: 100, inventory: [] };

  try {
    const body = await req.json();
    const { genre, action, history } = body;
    
    if (body.currentStatus) {
      currentStatus = body.currentStatus;
    }

    const prompt = `
      あなたはTRPGのゲームマスターです。
      以下の設定と行動に基づいて、物語の続きを描写してください。

      【設定】
      - ジャンル: ${genre}
      - 現在: HP=${currentStatus.hp}, 所持品=${currentStatus.inventory.join(',')}

      【プレイヤーの行動】
      "${action}"

      【ルール】
      1. 行動の成否を判定し、臨場感ある小説風に描写してください。
      2. ダメージやアイテム取得があればステータスを更新してください。
      3. ゲームオーバーまたはクリア時は game_over: true にしてください。

      【出力(JSON)】
      {
        "text": "描写テキスト...",
        "new_status": { "hp": 90, "inventory": ["..."] },
        "game_over": false,
        "choices": ["選択肢1", "選択肢2"]
      }
    `;

    const chatHistory = history ? history.slice(-5).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })) : [];

    // ★修正: 先頭がmodelならダミーuserを追加
    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.unshift({ role: 'user', parts: [{ text: '（ゲーム開始）' }] });
    }

    // ★修正: 確実なモデル名を使用
    let modelName = "gemini-1.5-flash"; 

    const generate = async (modelId: string) => {
      const model = genAI.getGenerativeModel({ 
        model: modelId,
        generationConfig: { responseMimeType: "application/json" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      });

      const chat = model.startChat({ history: chatHistory });
      const result = await chat.sendMessage(prompt);
      return result.response.text();
    };

    let text = "";
    try {
      text = await generate("gemini-1.5-flash");
    } catch (e) {
      console.warn("1.5-flash failed, trying gemini-pro", e);
      // 失敗したら旧モデルで再挑戦（JSONモードなし）
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await fallbackModel.generateContent(prompt + "\n\nOutput JSON only.");
      text = result.response.text();
    }

    // クリーニング
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Adventure Error:", error);
    
    let errorMsg = "通信エラーが発生しました。";
    if (error.message.includes("404")) errorMsg = "AIモデルが見つかりません。APIキーの設定を確認してください。";
    else errorMsg = `エラー: ${error.message}`;

    return NextResponse.json({ 
      text: `【システムメッセージ】\n${errorMsg}\n\n(ステータスは維持されます。もう一度アクションを入力してください)`,
      new_status: currentStatus,
      game_over: false,
      choices: ["再試行"]
    });
  }
}