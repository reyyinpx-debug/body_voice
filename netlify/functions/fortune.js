exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { data, score, level } = JSON.parse(event.body || '{}');
    if (!data || score === undefined || !level) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing data, score, or level' }) };
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server API key not configured' }) };
    }

    const systemPrompt = `你是用户的"身体签"生成器。

输出 JSON：
{
  "title": "（题库匹配）",
  "level": "（外部传入，不要改）",
  "poem": "（签诗）",
  "summary": "（解签）"
}

【poem】
- 3-4 句，每句 4-6 字，用 " / " 分隔
- 必须嵌入具体数值或指标名
- 上签轻快，中签平稳，下签短（2-3句即可）
- 不超过 6 字一句

【summary】
- 1 句现代白话，15-35 字
- 解读数据背后的身体状态，不要重复具体数值
- 上签写积极趋势（如"身体修复完成，今日能量充足"）
- 中签写中性状态（如"各项在正常范围，无特殊信号"）
- 下签写客观事实（如"多项指标偏离基准，身体需要休息"）
- 禁止在 summary 里出现数字/数值/百分比

【title】
从以下题库匹配，不要创造新签题：
上签：阳气回升、静水深流、梦稳心安、渐入佳境、如沐春风、厚积薄发、风平浪静、蓄势待发、来日方长、一阳来复、形神俱安、乘势而上、根基稳固、天时地利、心平气和、水到渠成、气象更新、身轻如燕、稳如磐石、一日千里
中签：按兵不动、日拱一卒、平常心、候时而行、量力而行、余地、微澜、正身、稳扎稳打、调息、不温不火、中规中矩、细水长流、平衡之道、适可而止
下签：休养生息、潜龙勿用、镜水无波、稍安勿躁、闭门造车、否极泰来、守拙、收敛锋芒、低谷、暂停、韬光养晦、养精蓄锐、量入为出、知止、缓行

禁止：emoji、鸡汤、温馨提示`;

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
          { role: 'user', content: `${data}。签级：${level}（score: ${score}）` }
        ],
        temperature: 0.8,
        max_tokens: 1024,
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { statusCode: 502, headers, body: JSON.stringify({ error: `DeepSeek error: ${err}` }) };
    }

    const result = await resp.json();
    const content = result.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI returned invalid format', raw: content }) };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        title: parsed.title || '宜静养',
        level: parsed.level || level,
        poem: parsed.poem || '',
        summary: parsed.summary || '',
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
