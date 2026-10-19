const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = 43127;
const MAX_BODY = 250000;
const INBOX_FILE = path.join(__dirname, 'ai-inbox.txt');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function isAllowedOrigin(origin) {
  if (!origin || origin === 'null') return true;
  if (origin.startsWith('chrome-extension://')) return true;
  if (origin === `http://${HOST}:${PORT}` || origin === `http://localhost:${PORT}`) return true;
  return false;
}

function setCorsHeaders(res, origin) {
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}

function sendJson(res, status, body, origin) {
  setCorsHeaders(res, origin);
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

function runLocalCliCommand(cmd, args, inputPrompt, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Lệnh CLI ${cmd} quá thời gian chờ (${timeoutMs / 1000}s).`));
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Không thể thực thi ${cmd} (mã thoát ${code}).`));
      }
    });
    if (inputPrompt) {
      child.stdin.write(inputPrompt);
      child.stdin.end();
    }
  });
}

async function handleAiQuery(body) {
  const { provider, prompt, apiKey, model } = body;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Nội dung truy vấn AI đang trống.');
  }

  // 1. Local Claude CLI (`claude -p`)
  if (provider === 'claude-cli') {
    const out = await runLocalCliCommand('claude', ['-p'], prompt);
    return { text: out, provider: 'Claude CLI (Trên máy)', model: 'claude-local' };
  }

  // 2. Local Ollama (`http://127.0.0.1:11434/api/generate`)
  if (provider === 'ollama-local') {
    const ollamaModel = model || 'llama3.1';
    const resp = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
    });
    if (!resp.ok) throw new Error(`Không kết nối được Ollama tại cổng 11434 (${resp.status}).`);
    const data = await resp.json();
    return { text: data.response || '', provider: 'Ollama Local', model: ollamaModel };
  }

  // 3. Anthropic Claude API
  if (provider === 'claude-api') {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('Chưa có Claude API Key. Hãy nhập key vào ô cấu hình hoặc dùng chế độ Cầu nối App Claude trên máy.');
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
      throw new Error(`Claude API từ chối yêu cầu (${resp.status}): ${errText.slice(0, 180)}`);
    }
    const data = await resp.json();
    const text = (data.content || []).map((c) => c.text || '').join('\n');
    return { text, provider: 'Anthropic Claude API', model: chosenModel };
  }

  // 4. OpenAI / ChatGPT API
  if (provider === 'openai-api') {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('Chưa có OpenAI API Key. Hãy nhập key hoặc dùng chế độ Cầu nối App.');
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

  // 5. Google Gemini Studio API (Default)
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error(
      'Chưa có Gemini API Key. Bạn có thể dán trực tiếp API Key vào ô Cấu hình bên dưới hoặc dùng Chế độ Cầu Nối App Claude/ChatGPT/Antigravity!'
    );
  }
  const geminiModel = model || 'gemini-2.5-flash';
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
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
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
  if (!text) throw new Error('Gemini trả về phản hồi rỗng.');
  return { text, provider: 'Google Gemini Studio', model: geminiModel };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (host && !['127.0.0.1:43127', 'localhost:43127'].includes(host)) {
    return res.writeHead(403).end();
  }
  if (!isAllowedOrigin(origin)) {
    return res.writeHead(403).end();
  }

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin);
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }

  // Status check
  if (req.method === 'GET' && req.url === '/api/status') {
    return sendJson(
      res,
      200,
      {
        configured: Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
        hasGeminiEnv: Boolean(process.env.GEMINI_API_KEY),
        hasClaudeEnv: Boolean(process.env.ANTHROPIC_API_KEY),
        hasOpenAiEnv: Boolean(process.env.OPENAI_API_KEY),
        inboxFile: INBOX_FILE,
      },
      origin
    );
  }

  // Poll ai-inbox.txt for live responses dropped by local AI agents (Claude Desktop / Antigravity / Scripts)
  if (req.method === 'GET' && req.url === '/api/inbox-poll') {
    try {
      if (fs.existsSync(INBOX_FILE)) {
        const stat = fs.statSync(INBOX_FILE);
        const content = fs.readFileSync(INBOX_FILE, 'utf-8').trim();
        return sendJson(res, 200, { hasContent: Boolean(content), content, updatedAt: stat.mtimeMs }, origin);
      }
      return sendJson(res, 200, { hasContent: false, content: '', updatedAt: 0 }, origin);
    } catch (e) {
      return sendJson(res, 200, { hasContent: false, content: '', updatedAt: 0 }, origin);
    }
  }

  if (req.method === 'POST' && req.url === '/api/inbox-clear') {
    try {
      fs.writeFileSync(INBOX_FILE, '', 'utf-8');
    } catch (e) {}
    return sendJson(res, 200, { cleared: true }, origin);
  }

  // Launch or focus local AI app on Windows (Claude / ChatGPT / Antigravity)
  if (req.method === 'POST' && req.url === '/api/launch-local-ai') {
    try {
      const { targetApp } = await readJsonBody(req);
      if (targetApp === 'claude-app') {
        execFile('cmd.exe', ['/c', 'start', '', 'claude://'], { windowsHide: true });
      } else if (targetApp === 'chatgpt-web') {
        execFile('cmd.exe', ['/c', 'start', '', 'https://chatgpt.com/'], { windowsHide: true });
      } else if (targetApp === 'claude-web') {
        execFile('cmd.exe', ['/c', 'start', '', 'https://claude.ai/new'], { windowsHide: true });
      } else if (targetApp === 'gemini-web') {
        execFile('cmd.exe', ['/c', 'start', '', 'https://aistudio.google.com/'], { windowsHide: true });
      }
      return sendJson(res, 200, { launched: true }, origin);
    } catch (err) {
      return sendJson(res, 500, { message: err.message }, origin);
    }
  }

  // Unified Multi-AI Query & Cloud BYOK Proxy endpoint
  if (
    req.method === 'POST' &&
    (req.url === '/api/ai-query' || req.url === '/api/ai-proxy' || req.url === '/api/synthesize')
  ) {
    try {
      const body = await readJsonBody(req);
      const prompt = body.prompt || body.packet;
      const result = await handleAiQuery({
        provider: body.provider || 'gemini-api',
        prompt,
        apiKey: body.apiKey,
        model: body.model,
      });
      return sendJson(res, 200, result, origin);
    } catch (error) {
      return sendJson(res, 502, { message: error.message || 'Không thể kết nối AI.' }, origin);
    }
  }

  // Static files
  if (req.method === 'GET' && !req.url.startsWith('/api/')) {
    return serveStaticFile(req.url, res);
  }

  return sendJson(res, 404, { message: 'Không tìm thấy đường dẫn.' }, origin);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('Cổng 43127 đã được sử dụng.');
  } else {
    console.error('Không thể khởi động server cục bộ:', error.message);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  if (!fs.existsSync(INBOX_FILE)) {
    try {
      fs.writeFileSync(INBOX_FILE, '', 'utf-8');
    } catch (e) {}
  }
  console.log(`Folio 3D Server & Multi-AI Bridge đang chạy tại http://${HOST}:${PORT}`);
});
process.on('SIGINT', () => server.close(() => process.exit(0)));
