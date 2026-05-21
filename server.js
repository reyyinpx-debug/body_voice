// Local dev server — serves static files + batch API proxy
// Usage: node server.js → http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
};

function loadEnv() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    for (const line of env.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    }
  } catch {}
}
loadEnv();

const API_KEY = process.env.DEEPSEEK_API_KEY;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.end();
  if (req.method === 'POST' && req.url === '/api/generate') return handleAPI(req, res);
  if (req.method === 'POST' && req.url === '/api/chat') return handleChat(req, res);
  if (req.method === 'POST' && req.url === '/api/fortune') return handleFortune(req, res);

  // Static files
  let fp = req.url === '/' ? '/index.html' : req.url;
  fp = path.join(__dirname, fp);
  const ext = path.extname(fp);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

async function handleAPI(req, res) {
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'DEEPSEEK_API_KEY not set' }));
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const input = JSON.parse(body);
      const { summaries } = input;
      const tone = input.tone || 'guardian';
      const userName = input.userName || '用户';

      if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
        throw new Error('Missing summaries array');
      }

      const daysText = summaries.map((s, i) =>
        `【第${i + 1}天】\n${s}\n`
      ).join('\n');

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

      const systemPrompt = toneDefs[tone] + `\n\n## 输出格式
返回严格JSON格式（不要markdown代码块）：
{"posts":[{"date":"日期","time":"HH:MM","post":"动态正文"},...],"fortune":{"level":"上签/中签/下签","title":"四字签题","poem":"半文半白签诗","summary":"一句白话解签","score":5,"data_evidence":"2-3项关键数据"}}

其中 fortune 根据最新一天的数据生成。
level 分三档：数据好=上签，普通=中签，差=下签。
title 四字签题，从以下题库匹配（不要创造新题）：上签-阳气回升/静水深流/梦稳心安/如沐春风/厚积薄发/风平浪静/蓄势待发/形神俱安/根基稳固/渐入佳境/来日方长/一阳来复/乘势而上/天时地利。中签-按兵不动/日拱一卒/平常心/候时而行/量力而行/余地/微澜/正身/稳扎稳打/调息。下签-休养生息/潜龙勿用/镜水无波/稍安勿躁/闭门造车/守拙/收敛锋芒/低谷/暂停/否极泰来。
poem 写1-4句，半文半白，用/分隔。summary 写一句现代白话解释签和数据的关系。
score 按0-8评分：深睡≥90min(1)、睡眠评分≥70(1)、HRV≥40(1)、静息心率≤65(1)、体温偏差≤0.3°C(1)、步数≥8000(+0.5)、体温偏差≥0.5°C(-1)。data_evidence 列2-3项关键数据（中文+数值）。
日期从下面的数据中取。
发帖规则：
  - 每天可以发0-2条，数据有意思就多发，平淡日子可以跳过
  - 每条带具体时间（24小时制，根据数据特征推理合理时间）
  - posts数量与天数无关
  - 各条动态必须关注不同维度，覆盖以下角度：
    · 深睡 / 睡眠质量
    · HRV / 自主神经
    · 心率 / 心脏负荷
    · 步数 / 活动量
    · 体温
    · 综合趋势 / 对比昨天
  - 相邻两条不要用同一维度。维度不够分时优先选变化最大的那个`;

      const examples = {
        lazy: '示例：\n睡眠4h42m → {"date":"2026-03-15","post":"睡了4小时42分。然后你醒了还刷了半小时手机。我看到了。我什么都看到了。"}\nHRV 28 → {"date":"2026-05-01","post":"HRV 28。嗯。你要是故意的我不说什么，你要是觉得正常那咱俩聊聊。"}',
        memorial: '示例：\n睡眠7h12m，深睡近半，心率58 → {"date":"2026-04-02","post":"臣心率谨奏：昨夜圣体安歇七时十二分，深睡几近半数。脉象平和（心率58），元气渐复。臣不胜欣慰，伏惟圣鉴。"}\n睡眠4h42m → {"date":"2026-03-15","post":"臣睡眠谨奏：主上昨夜仅眠四时四十二分，深睡不足。连日如此，臣心堪忧。伏惟留意。"}',
        logger: '示例：\n睡眠4h42m，HRV 28 → {"date":"2026-03-15","post":"简报：睡眠4h42m。与前日相比-32%。建议关注。自动生成。"}\n睡眠7.2h，HRV 45，心率58 → {"date":"2026-04-02","post":"简报：睡眠7.2h，HRV45，心率58。均在正常范围内。自动生成。"}',
        guardian: '示例：\n睡眠7h12m，深睡47% → {"date":"2026-04-02","post":"检测到宿主进入睡眠。时长7h12m。深睡占比47%。质量评分：优秀。记录完成。"}\n睡眠4h42m → {"date":"2026-03-15","post":"睡眠时长4h42m，远低于推荐值。连续三日低于阈值。这可能需要关注。我在记录。"}',
      };
      const example = examples[tone] || examples.guardian;

      const userPrompt = `以下是${summaries.length}天的身体数据，根据数据情况生成动态。语气模式：${tone}。\n\n${example}\n\n${daysText}`;

      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 8192,
        })
      });

      if (!resp.ok) {
        const err = await resp.text();
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `DeepSeek error: ${err}` }));
      }

      const data = await resp.json();
      const content = data.choices[0].message.content.trim();

      // Parse JSON from response (handle possible markdown code fences)
      let json = content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) json = jsonMatch[0];

      const parsed = JSON.parse(json);
      const posts = Array.isArray(parsed.posts) ? parsed.posts : [];

      const fortune = parsed.fortune || null;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ posts, fortune }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

async function handleChat(req, res) {
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'DEEPSEEK_API_KEY not set' }));
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const { question, tone, data } = JSON.parse(body);
      if (!question) throw new Error('Missing question');

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
- 20-80字
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
          'Authorization': `Bearer ${API_KEY}`
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
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `DeepSeek error: ${err}` }));
      }

      const result = await resp.json();
      const answer = result.choices[0].message.content.trim();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ answer }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

async function handleFortune(req, res) {
  if (!API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'DEEPSEEK_API_KEY not set' }));
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const input = JSON.parse(body);
      const { data, score, level } = input;
      if (!data || score === undefined || !level) {
        throw new Error('Missing data, score, or level');
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
          'Authorization': `Bearer ${API_KEY}`
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
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `DeepSeek error: ${err}` }));
      }

      const result = await resp.json();
      const content = result.choices[0].message.content.trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'AI returned invalid format', raw: content }));
      }

      const parsed = JSON.parse(jsonMatch[0]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        title: parsed.title || '宜静养',
        level: parsed.level || level,
        poem: parsed.poem || '',
        summary: parsed.summary || '',
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

server.listen(PORT, () => {
  console.log(`🫀 BodyFeed running at http://localhost:${PORT}`);
  if (!API_KEY) console.log('⚠️  DEEPSEEK_API_KEY not set');
});
