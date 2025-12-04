// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの作成（サーバー側用）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // 1. 家の最新データを取得する
    const { data: items } = await supabase.from('items').select('name, quantity, status').eq('status', 'ok');
    const { data: recipes } = await supabase.from('recipes').select('title').order('created_at', { ascending: false }).limit(5);
    
    // データを文字列に整形
    const inventoryText = items && items.length > 0
      ? items.map(i => `${i.name} (${i.quantity || '適量'})`).join(', ')
      : '（在庫なし）';
    
    const recipeText = recipes && recipes.length > 0
      ? recipes.map(r => r.title).join(', ')
      : '（保存履歴なし）';

    // 2. 執事への指示書（プロンプト）
    const systemPrompt = `
      あなたは、この家の専属執事「セバスチャン」です。
      丁寧で落ち着いた口調（「ございます」「承知いたしました」など）で話してください。
      
      【現在の家の状況】
      ■ 冷蔵庫・在庫にあるもの:
      ${inventoryText}

      ■ 最近保存したレシピ:
      ${recipeText}

      【ルール】
      - ユーザーの質問に対し、上記の【家の状況】を元に答えてください。
      - 在庫にないものを聞かれたら「在庫にはございませんが...」と前置きしてください。
      - 献立の相談をされたら、在庫にあるものを組み合わせて提案してください。
      - 雑談にも付き合ってください。
    `;

    // 3. AIに回答させる
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "承知いたしました。旦那様（お嬢様）、何なりとお申し付けくださいませ。" }],
        },
      ],
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    return NextResponse.json({ reply: response });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: "申し訳ございません。通信エラーが発生いたしました。" }, { status: 500 });
  }
}