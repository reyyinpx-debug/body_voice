exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { question, tone, data } = JSON.parse(event.body || '{}');
    if (!question) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing question' }) };
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server API key not configured' }) };
    }

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
      return { statusCode: 502, headers, body: JSON.stringify({ error: `DeepSeek error: ${err}` }) };
    }

    const result = await resp.json();
    const answer = result.choices[0].message.content.trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
