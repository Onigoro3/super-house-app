// app/api/travel/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// APIキーの確認
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(apiKey!);

export async function POST(req: Request) {
  try {
    const { destination, duration, budget, people, theme, transport, origin } = await req.json();
    const startPoint = origin || '大阪府 堺市';

    const isOnsenMode = theme.includes("温泉") || theme.includes("サウナ");
    const specialInstruction = isOnsenMode ? `
      【★温泉・サウナ特化】
      行き先周辺の高評価な温泉・温浴施設を5つリストアップし、「♨️ おすすめ温泉5選」として詳細欄にURL付きで記載。
    ` : "";

    // プロンプト生成
    const getPrompt = (useSearch: boolean) => `
      あなたはトラベルコンシェルジュです。
      以下の条件で旅行プランを作成し、JSON形式で出力してください。

      【条件】
      - 出発: ${startPoint}
      - 行き先: ${destination}
      - 期間: ${duration}
      - 移動: ${transport}
      - 予算: ${budget}円
      - テーマ: ${theme}

      【ルール】
      1. ${startPoint}からの距離を記載。
      2. スポットのURLを含める（${useSearch ? '検索して正確に' : '知っている範囲で'}）。
      3. ${specialInstruction}
      4. JSONのみ出力。

      Output JSON Schema:
      {
        "title": "Title", 
        "concept": "Concept",
        "schedule": [
          { "day": 1, "spots": [ { "time": "10:00", "name": "Name", "desc": "Desc", "cost": "1000yen", "distance": "10km", "url": "http..." } ] }
        ]
      }
    `;

    // 生成実行関数
    const generatePlan = async (useSearch: boolean) => {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash", // ★高速モデルに変更
        tools: useSearch ? [{ googleSearch: {} } as any] : undefined,
        generationConfig: { responseMimeType: "application/json" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      });

      // タイムアウト設定（検索ありなら7秒、なしなら12秒で切る）
      // VercelのHobbyプランは10秒制限があるため、7秒で諦めるのが安全
      const timeoutMs = useSearch ? 7000 : 12000;
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), timeoutMs)
      );
      
      const aiPromise = model.generateContent(getPrompt(useSearch));
      
      // 競走させる
      const result: any = await Promise.race([aiPromise, timeoutPromise]);
      return result.response.text();
    };

    let text = "";
    
    try {
      // 1. まず検索ありでトライ (7秒制限)
      console.log("Attempting with Search...");
      text = await generatePlan(true);
    } catch (e) {
      // 2. 失敗・タイムアウトしたら検索なしで爆速リトライ
      console.warn("Search failed/timed out. Fallback to basic mode.", e);
      text = await generatePlan(false);
    }

    // JSONクリーニング（念入りに）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AIがJSONを返しませんでした");
    
    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Travel Plan Error:", error);
    
    // エラー内容をクライアントに返す
    return NextResponse.json(
      { error: error.message || "プラン作成に失敗しました" }, 
      { status: 500 }
    );
  }
}