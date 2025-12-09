// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';

    const isOnsenMode = theme.includes("温泉") || theme.includes("サウナ");
    const specialInstruction = isOnsenMode ? `
      【★温泉・サウナ特化】
      行き先周辺の高評価な温泉・温浴施設を5つリストアップし、URL付きで提案してください。
    ` : "";

    // プロンプト（共通）
    const getPrompt = (useSearch: boolean) => `
      あなたはプロのトラベルコンシェルジュです。
      旅行プランを作成してください。

      【条件】
      - 出発: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 人数: ${people}人
      - 予算: 1人${budget}円
      - 移動: ${transport}
      - テーマ: ${theme}

      【ルール】
      1. ${startPoint}からの距離を計算して記載。
      2. スポットのURLを含める（${useSearch ? '実在するURLを検索して' : '公式サイトやGoogle検索のURLを推測して'}）。
      3. ${specialInstruction}
      4. JSON形式のみ出力。Markdown記号は不要。

      Output JSON Schema:
      {
        "title": "Title", "concept": "Concept",
        "schedule": [
          { "day": 1, "spots": [ { "time": "10:00", "name": "Name", "desc": "Desc", "cost": "1000yen", "distance": "10km", "url": "http..." } ] }
        ]
      }
    `;

    // 生成実行関数
    const generatePlan = async (useSearch: boolean) => {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash", // 最新モデル
        tools: useSearch ? [{ googleSearch: {} } as any] : undefined, // 検索ツールの有無
        generationConfig: { responseMimeType: "application/json" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      });

      const prompt = getPrompt(useSearch);
      
      // タイムアウト設定（検索ありなら8秒、なしなら15秒まで待つ）
      const timeoutMs = useSearch ? 8000 : 15000;
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs));
      
      const aiPromise = model.generateContent(prompt);
      
      const result: any = await Promise.race([aiPromise, timeoutPromise]);
      return result.response.text();
    };

    let text = "";
    
    try {
      // ★作戦1: 検索ありでトライ
      console.log("Attempting with Google Search...");
      text = await generatePlan(true);
    } catch (e) {
      // ★作戦2: 失敗（タイムアウト等）したら検索なしでリトライ
      console.warn("Search failed or timed out, falling back to knowledge base.", e);
      text = await generatePlan(false);
    }

    // クリーニング
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Travel Plan Error:", error);
    return NextResponse.json({ error: "プラン作成に失敗しました。条件を変えて再度お試しください。" }, { status: 500 });
  }
}