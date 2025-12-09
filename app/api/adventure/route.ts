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

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    // ★修正: 履歴の先頭が 'model' ならダミーの 'user' を追加する
    let chatHistory = history ? history.slice(-10).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })) : [];

    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.unshift({
        role: 'user',
        parts: [{ text: '（ゲーム開始）' }]
      });
    }

    // タイムアウト対策（10秒）
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
    
    const chatPromise = (async () => {
      const chat = model.startChat({
        history: chatHistory
      });
      const result = await chat.sendMessage(prompt); // プロンプトをメッセージとして送信
      return result.response.text();
    })();

    let text = await Promise.race([chatPromise, timeoutPromise]) as string;
    
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Adventure Error:", error);
    
    let errorMsg = "通信エラーが発生しました。";
    if (error.message === "Timeout") errorMsg = "AIの応答が間に合いませんでした。もう一度試してください。";
    else if (error.message.includes("404")) errorMsg = "AIモデルが見つかりません。API設定を確認してください。";
    else if (error.message.includes("SAFETY")) errorMsg = "AIが「不適切な表現」と判断して停止しました。別の行動を試してください。";
    else errorMsg = `エラー: ${error.message}`;

    return NextResponse.json({ 
      text: `【システムメッセージ】\n${errorMsg}\n\n(ステータスは維持されます。もう一度アクションを入力してください)`,
      new_status: currentStatus,
      game_over: false,
      choices: ["再試行"]
    });
  }
}