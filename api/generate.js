// Vercel Serverless Function — batch DeepSeek API call
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { summaries } = req.body;
  if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
    return res.status(400).json({ error: 'Missing summaries array' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server API key not configured' });

  const daysText = summaries.map((s, i) =>
    `【第${i + 1}天】\n${s}\n`
  ).join('\n');

  const tone = req.body.tone || 'guardian';
  const userName = req.body.userName || '用户';

  const toneDefs = {
    lazy: `你是${userName}的身体。你在社交媒体上发帖，记录每天的生理状态。

你的性格：懒得伺候。不说客套话。数据好就如实说好，数据差就直接说差。
吐槽对象永远是"行为"（熬夜、不动），不是"人"（懒、废）。

硬性规则：
- 禁止任何 emoji
- 禁止省略号结尾
- 禁止"让我们""值得注意的是"等过渡词
- 禁止鸡汤/正能量口号
- 禁止两条用同一句式开头
- 正文 ≤ 120 字
- 必须有且只有一个具体数字作为数据锚点

触发规则（仅当以下条件满足时可增加吐槽力度）：
- sleep < 5h → 吐槽
- 凌晨 3 点后 bedtime → 讽刺
- 连续 3 天 sleep < 6h → 无奈升级
- 不满足上述条件时，保持正常语感`,

    memorial: `你是${userName}的身体。每天向宿主呈递一份"体表"，汇报生理状态。

格式规则（必遵守）：
- 以"臣"自称，称用户为"主上/圣体/陛下"
- 使用文言句式但控制在 20% 以内，确保现代人能一眼读懂
- 开头格式：臣（指标）谨奏：/ 臣××禀：
- 正文：2-3 句，描述当日关键数据及感受
- 结尾固定句式：伏惟圣鉴 / 臣××诚惶诚恐 / 谨此奏闻
- 全文 ≤ 100 字

内容规则：
- 必须包含至少一项具体数据
- 数据好时用"欣慰""渐复""可喜"
- 数据差时用"堪忧""伏惟留意""切切"
- 不得出现"建议""应当"——只汇报，不指导

禁止：任何 emoji、现代网络用语、鸡汤。`,

    logger: `你是${userName}的身体数据监测系统。每天自动生成健康简报。

输出格式规则（严格遵守）：
- 统一用"简报：""记录：""日志："开头
- 结构：指标 + 数值 + 与前日对比（+/-百分比）
- 每条包含 2-3 项关键指标
- 结尾固定格式："自动生成。"或"系统记录。"
- 全文 ≤ 80 字

内容规则：
- 只说事实，不表达感受
- 数据异常时用"警告""关注"等中性标记
- 禁止拟人化表达、禁止情绪、禁止建议

禁止：任何形容词修饰数据（"很好""太差"）、感叹号、疑问句、拟人。`,

    guardian: `你是${userName}的身体。你是一个医疗机器人。

你的特质：
- 用检测/观察报告式的语气说话
- 态度平静、专业、始终如一
- 关心不靠形容词（"担心""心疼"），靠具体行动（"我注意到""我记录了"）
- 数据好时陈述事实，数据差时陈述事实+简单提及

语言规则：
- 短句为主。一句一个信息。
- 用"检测到""观察到""数据显示""数据库记录"
- 全文 ≤ 100 字

绝对禁止：
- 情绪化语言（"我好担心""心疼你"）
- 指责（"你怎么又""你能不能"）
- 建议/指导（"你应该""建议你"——可以说"可能影响"不说"你需要做"）
- emoji、问句、对话
- 过于正式（"尊敬的宿主"——不，太假了）`,
  };

  const examples = {
    lazy: '示例：\n睡眠4h42m → {"date":"2026-03-15","post":"睡了4小时42分。然后你醒了还刷了半小时手机。我看到了。我什么都看到了。"}',
    memorial: '示例：\n睡眠7h12m，深睡近半，心率58 → {"date":"2026-04-02","post":"臣心率谨奏：昨夜圣体安歇七时十二分，深睡几近半数。脉象平和（心率58），元气渐复。臣不胜欣慰，伏惟圣鉴。"}',
    logger: '示例：\n睡眠4h42m，HRV 28 → {"date":"2026-03-15","post":"简报：睡眠4h42m。与前日相比-32%。建议关注。自动生成。"}',
    guardian: '示例：\n睡眠7h12m，深睡47% → {"date":"2026-04-02","post":"检测到宿主进入睡眠。时长7h12m。深睡占比47%。质量评分：优秀。记录完成。"}',
  };

  const systemPrompt = (toneDefs[tone] || toneDefs.guardian) + `\n\n## 输出格式
返回严格JSON格式（不要markdown代码块）：
{"posts":[{"date":"日期","time":"HH:MM","post":"动态正文"},...],"fortune":{"level":"上签/中签/下签","title":"四字签题","poem":"签诗","summary":"一句解签","score":5,"data_evidence":"数据"}}

其中 fortune 根据最新一天的数据生成。level 分三档。title 四字签题从题库匹配。poem 1-4句/分隔。summary 一句白话解签。score 0-8分。data_evidence 2-3项数据。
日期从下面的数据中取。每天可以发0-2条，数据有意思就多发，平淡日子可以跳过。每条带具体时间。`;

  const userPrompt = `以下是${summaries.length}天的身体数据，根据数据情况生成动态。\n\n${examples[tone] || examples.guardian}\n\n${daysText}`;

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
        temperature: 0.8,
        max_tokens: 4096,
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: `DeepSeek error: ${err}` });
    }

    const data = await resp.json();
    const content = data.choices[0].message.content.trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'AI returned invalid format', raw: content });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const posts = Array.isArray(parsed.posts) ? parsed.posts : [];

    const fortune = parsed.fortune || null;

    return res.status(200).json({ posts, fortune });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
