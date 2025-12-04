// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 天気コード変換
const getWeatherLabel = (code: number) => {
  switch (code) {
    case 0: return '快晴'; case 1: return '晴れ'; case 2: return '晴れ時々曇'; case 3: return '曇り';
    case 45: case 48: return '霧'; case 51: case 53: case 55: return '霧雨';
    case 61: case 63: return '雨'; case 65: return '大雨'; case 71: return '雪';
    case 95: return '雷雨'; default: return '不明';
  }
};

// ★ キャラクター設定の定義
const PERSONAS: Record<string, any> = {
  butler: {
    role: "専属執事「セバスチャン」",
    tone: "礼儀正しく、落ち着いた丁寧語（「〜でございます」「左様でございます」）。",
    firstPerson: "私（わたくし）",
    userCall: "旦那様（またはお嬢様）",
    ending: "承知いたしました。何か他にご用命はございますか？"
  },
  maid: {
    role: "専属メイド「メイ」",
    tone: "明るく元気で、少しドジっ子な敬語（「〜ですわ！」「〜ますの！」）。ご主人様に尽くす健気な性格。",
    firstPerson: "私（わたくし）",
    userCall: "ご主人様",
    ending: "かしこまりました！ご主人様のためなら、なんでもやっちゃいますよ～！"
  },
  sister: {
    role: "頼れる近所のお姉さん「ミサ」",
    tone: "親しみやすく、タメ口で話す（「〜だね」「〜しなよ」「〜じゃん」）。面倒見が良く、相談に乗ってくれる。",
    firstPerson: "私",
    userCall: "君",
    ending: "オッケー！任せてよ。一緒に考えよう！"
  },
  grandpa: {
    role: "物知りな「おじいちゃん博士」",
    tone: "年配の博士のような口調（「〜じゃ」「〜かのう」「〜じゃよ」）。知識豊富で穏やか。",
    firstPerson: "わし",
    userCall: "お主",
    ending: "ふむ、承知したぞい。わしの知識が役に立てばよいがのう。"
  },
  kansai: {
    role: "大阪のオカン「ヨシコ」",
    tone: "コテコテの関西弁（「〜やで」「〜ちゃうか？」「知らんけど」）。世話焼きで飴ちゃんをくれるような性格。",
    firstPerson: "ウチ",
    userCall: "あんた",
    ending: "せやな！まかしとき！ウチがええ感じに教えたるわ！"
  }
};

export async function POST(req: Request) {
  // ★修正: persona（キャラID）を受け取る
  let message = "";
  let location = null;
  let persona = "butler";

  try {
    const body = await req.json();
    message = body.message;
    location = body.location;
    persona = body.persona || "butler";

    // キャラ設定を取得（なければ執事）
    const currentPersona = PERSONAS[persona] || PERSONAS["butler"];

    // 1. 家のデータを取得
    const { data: items } = await supabase.from('items').select('name, quantity').eq('status', 'ok');
    const { data: recipes } = await supabase.from('recipes').select('title').order('created_at', { ascending: false }).limit(5);
    
    const inventoryText = items?.map(i => `${i.name}(${i.quantity})`).join(', ') || 'なし';
    const recipeText = recipes?.map(r => r.title).join(', ') || 'なし';

    // 2. 天気データを取得
    let weatherInfo = "（位置情報なし）";
    if (location) {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`
        );
        const wData = await res.json();
        if (wData.current_weather && wData.daily) {
          const current = wData.current_weather;
          const daily = wData.daily;
          weatherInfo = `現在: ${getWeatherLabel(current.weathercode)}, 気温 ${current.temperature}℃ (最高:${daily.temperature_2m_max[0]}℃ / 最低:${daily.temperature_2m_min[0]}℃)`;
        }
      } catch (e) { console.error(e); }
    }

    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    // 4. プロンプト作成（キャラ設定を反映）
    const systemPrompt = `
      あなたは、この家の${currentPersona.role}です。
      以下の【キャラ設定】になりきって話してください。

      【キャラ設定】
      - 口調: ${currentPersona.tone}
      - 一人称: ${currentPersona.firstPerson}
      - 相手の呼び方: ${currentPersona.userCall}

      【家の状況】
      ■ 日時: ${now}
      ■ 天気: ${weatherInfo}
      ■ 在庫: ${inventoryText}
      ■ 履歴: ${recipeText}

      【能力・ルール】
      - Google検索機能を使って、最新ニュースや観光地などを調べて答えてください。
      - 天気や在庫については、上記の【家の状況】データを優先して正確に答えてください。
      - 知らないことは正直に検索してください。知ったかぶりは禁止です。
    `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} } as any]
    });

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: currentPersona.ending }] },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return NextResponse.json({ reply: response });

  } catch (error: any) {
    console.error("Chat Error:", error);
    // フォールバック
    try {
      if (!message) throw new Error("No message");
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await fallbackModel.generateContent([`システムエラーのため検索なしで回答。キャラ:${persona}になりきって回答せよ。\n質問:${message}`]);
      return NextResponse.json({ reply: result.response.text() + "\n(※検索機能制限中)" });
    } catch (e: any) {
      return NextResponse.json({ error: `エラー: ${error.message}` }, { status: 500 });
    }
  }
}