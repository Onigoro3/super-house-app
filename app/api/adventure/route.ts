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

    // ★重要: モデル設定
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // 高速・安定モデル
      generationConfig: { responseMimeType: "application/json" },
      // ★重要: 安全フィルターを解除（ゲーム内の戦闘表現を許可するため）
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    const chatHistory = history ? history.slice(-5).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })) : [];

    // タイムアウト対策（8秒で切る）
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000));
    
    const chatPromise = (async () => {
      const chat = model.startChat({
        history: [...chatHistory, { role: "user", parts: [{ text: prompt }] }]
      });
      const result = await chat.sendMessage("判定");
      return result.response.text();
    })();

    // 競走させる
    let text = await Promise.race([chatPromise, timeoutPromise]) as string;
    
    // クリーニング
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Adventure Error:", error);
    
    // エラー内容をユーザーに伝える
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