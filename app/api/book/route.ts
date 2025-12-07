// app/api/book/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) console.error("APIキー設定エラー");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { topic, genre, part, previousContent } = await req.json();
    console.log(`執筆: ${topic} (${genre}) Part:${part}`);

    // ジャンルごとの振る舞い定義
    let roleDescription = "プロの作家";
    let styleDescription = "読者を引き込む魅力的な文章";
    
    switch (genre) {
      case 'study':
        roleDescription = "わかりやすい解説者";
        styleDescription = "初心者にも理解しやすい、丁寧な解説口調";
        break;
      case 'picture_book':
        roleDescription = "絵本作家";
        styleDescription = "ひらがなを多用した、子供向けの優しい語り口";
        break;
      case 'novel':
        roleDescription = "小説家";
        styleDescription = "情景描写に富んだ、文学的な文章";
        break;
      case 'sf':
        roleDescription = "SF作家";
        styleDescription = "科学的な考証や未来的な世界観を感じさせる文章";
        break;
      case 'mystery':
        roleDescription = "ミステリー作家";
        styleDescription = "伏線を張り巡らせ、謎めいた雰囲気のある文章";
        break;
      case 'fantasy':
        roleDescription = "ファンタジー作家";
        styleDescription = "魔法や冒険に満ちた、壮大な世界観の文章";
        break;
      case 'horror':
        roleDescription = "ホラー作家";
        styleDescription = "背筋が凍るような、恐怖心を煽る文章";
        break;
      default:
        break;
    }

    // パートごとの指示
    let contextInstruction = "";
    if (previousContent) {
      contextInstruction = `
      【前回のあらすじ】
      "${previousContent.slice(-500)}"
      
      これは物語の「続き（パート${part}）」です。
      前回の流れを汲んで、自然に話を繋げてください。
      `;
    } else {
      contextInstruction = "これは物語の「冒頭（パート1）」です。魅力的な導入から始めてください。";
    }

    // 完結させるかどうかの指示
    // part 4 (最後のパート) の場合は完結させる
    const endingInstruction = part === 4 
      ? "物語を感動的、あるいは衝撃的に完結させてください。" 
      : "物語はまだ続きます。次への引きを作って終わってください。";

    const prompt = `
      あなたは${roleDescription}です。
      以下のテーマで本を執筆してください。

      【テーマ】${topic}
      【ジャンル】${genre}
      【文体】${styleDescription}

      ${contextInstruction}

      【ルール】
      1. 日本語で書いてください。
      2. 今回は **10ページ分** 書いてください。
      3. ${endingInstruction}
      4. 各ページの本文は200〜400文字程度で充実させてください。
      5. 見出し（headline）は内容を端的に表すものにしてください。

      【出力フォーマット(JSON)】
      必ず以下のJSON形式のみを出力してください。Markdownタグは不要です。

      {
        "title": "本のタイトル（パート1の時のみ使用しますが、常に含めてください）",
        "pages": [
          { 
            "page_number": 1, 
            "headline": "見出し", 
            "content": "本文..." 
          }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", // 高速モデルを使用
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Book Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}