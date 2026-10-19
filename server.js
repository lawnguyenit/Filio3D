const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 43127;
const MAX_BODY = 250000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

function serveStaticFile(reqPath, res) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath.split('?')[0];
  const resolved = path.resolve(__dirname, '.' + safePath);
  if (!resolved.startsWith(path.resolve(__dirname))) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Không tìm thấy tệp.');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });
}

async function readJsonBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY) {
      throw new Error('Dữ liệu gửi lên vượt quá giới hạn cho phép.');
    }
  }
  return JSON.parse(raw || '{}');
}

async function handleCloudByokProxy(body) {
  const { provider, prompt, apiKey, model } = body;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Nội dung truy vấn AI đang trống.');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Vui lòng nhập API Key cá nhân của bạn (BYOK).');
  }
  const key = apiKey.trim();

  if (provider === 'claude-api') {
    const chosenModel = model || 'claude-3-7-sonnet-latest';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API báo lỗi (${resp.status}): ${errText.slice(0, 180)}`);
    }
    const data = await resp.json();
    const text = (data.content || []).map((c) => c.text || '').join('\n');
    return { text, provider: 'Anthropic Claude API', model: chosenModel };
  }

  if (provider === 'openai-api') {
    const chosenModel = model || 'gpt-4o-mini';
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API báo lỗi (${resp.status}): ${errText.slice(0, 180)}`);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { text, provider: 'OpenAI API', model: chosenModel };
  }

  const geminiModel = model || 'gemini-2.5-flash';
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!resp.ok) {
    const errData = await resp.text();
    throw new Error(`Gemini API báo lỗi (${resp.status}): ${errData.slice(0, 180)}`);
  }
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
  return { text, provider: 'Google Gemini Studio', model: geminiModel };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/ai-proxy') {
    try {
      const body = await readJsonBody(req);
      const result = await handleCloudByokProxy(body);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 502, { message: error.message || 'Không thể kết nối AI.' });
    }
  }

  if (req.method === 'GET' && !req.url.startsWith('/api/')) {
    return serveStaticFile(req.url, res);
  }

  return sendJson(res, 404, { message: 'Không tìm thấy đường dẫn.' });
});

server.listen(PORT, HOST, () => {
  console.log(`Filio3D Local Dev Server đang chạy tại http://${HOST}:${PORT}`);
});
process.on('SIGINT', () => server.close(() => process.exit(0)));
