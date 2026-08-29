export async function POST(req) {
  try {
    const body = await req.json();
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({
        commentary: makeFallbackCommentary(body)
      });
    }

    const prompt = `
あなたは学習塾の校長です。以下の生徒データを保護者面談向けに分析してください。
断定しすぎず、数値に基づいて簡潔かつ具体的に書いてください。

【出力形式】
1. 現状
2. 良い点
3. 課題
4. 今後の学習方針

【生徒データ】
${JSON.stringify(body, null, 2)}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(t);
      return Response.json({ commentary: makeFallbackCommentary(body) });
    }

    const data = await response.json();
    const text =
      data.output_text ||
      data.output?.flatMap(o => o.content || [])
        ?.find(c => c.type === "output_text")?.text ||
      makeFallbackCommentary(body);

    return Response.json({ commentary: text });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "AI講評の生成に失敗しました。" }, { status: 500 });
  }
}

function makeFallbackCommentary(body) {
  const subjects = body.subjectStats || [];
  if (!subjects.length) return "まだ十分な成績データがありません。";
  const best = [...subjects].sort((a,b)=>b.recentAvg-a.recentAvg)[0];
  const weakest = [...subjects].sort((a,b)=>a.recentAvg-b.recentAvg)[0];

  return `【現状】
直近の成績は、${best.subject}が${best.recentAvg.toFixed(1)}%と最も高い状況です。

【良い点】
${best.subject}は比較的安定しています。

【課題】
${weakest.subject}は直近平均${weakest.recentAvg.toFixed(1)}%で、優先的な復習が必要です。

【今後の学習方針】
過去問を解いて終わりにせず、提出・採点・復習ノート提出までを一つの学習サイクルとして継続してください。`;
}
