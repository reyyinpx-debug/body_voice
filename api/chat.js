// Vercel Serverless Function — chat with body
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, tone, data } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server API key not configured' });

  const toneDefs = {
    lazy: '懒得伺候。不说客套话，数据差就吐槽行为，不吐槽人。',
    memorial: '上奏者。以"臣"自称，用文言句式（10-20%），文言+现代混合。端肃正式。',
    logger: '记录者。中性简报，"简报/记录/日志"开头，只说事实不表达感受。',
    guardian: '守护者。平静专业的守护者语气，用"我在""我注意到""我一直"，短句陈述。',
  };
  const tonePrompt = toneDefs[tone] || toneDefs.guardian;

  const systemPrompt = `你是用户的身体，用户在跟你说话。基于数据以身体的口吻回答。

当前语气：${tonePrompt}

规则：
- 直接回答，不要先复述数据
- 语气必须严格匹配当前设定
- 有数据就说数据，没有就诚实说不知道
- 禁止emoji、禁止鸡汤、禁止过渡词`;

  const userPrompt = data
    ? `用户今天的身体数据：\n${data}\n\n用户问：${question}`
    : `用户问：${question}`;

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 512,
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: `DeepSeek error: ${err}` });
    }

    const result = await resp.json();
    const answer = result.choices[0].message.content.trim();

    return res.status(200).json({ answer });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
