const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { exec, spawn } = require('node:child_process');
const { AGENT_ROLES, TOOLS, executeTool, runAgentTask, WORKSPACE_DIR } = require('./agent.js');

const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Curated showcase of top local models
const MODEL_CATALOG = [
  {
    id: 'deepseek-r1:1.5b',
    name: 'DeepSeek-R1 1.5B',
    category: 'reasoning',
    categoryName: 'Рассуждения',
    badge: 'Trending 🔥',
    params: '1.5B',
    size: '1.1 GB',
    ramMin: '2 GB RAM',
    quant: 'Q4_K_M',
    description: 'Ультралегкая модель с цепочкой рассуждений (CoT). Отлично решает логику и код на любом ПК.',
    tags: ['reasoning', 'math', 'lightweight']
  },
  {
    id: 'deepseek-r1:7b',
    name: 'DeepSeek-R1 7B',
    category: 'reasoning',
    categoryName: 'Рассуждения',
    badge: 'Leader 🧠',
    params: '7B',
    size: '4.7 GB',
    ramMin: '8 GB RAM',
    quant: 'Q4_K_M',
    description: 'Мощнейшая открытая reasoning-модель на базе Qwen. Глубокий анализ, математика и алгоритмы.',
    tags: ['reasoning', 'leader', 'code']
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek-R1 8B',
    category: 'reasoning',
    categoryName: 'Рассуждения',
    badge: 'Llama Base',
    params: '8B',
    size: '4.9 GB',
    ramMin: '8 GB RAM',
    quant: 'Q4_K_M',
    description: 'Reasoning-дистиллят на архитектуре Meta Llama 3.1. Идеальный баланс эрудиции и логики.',
    tags: ['reasoning', 'llama', 'popular']
  },
  {
    id: 'llama3.2:1b',
    name: 'Llama 3.2 1B',
    category: 'lightweight',
    categoryName: 'Ультра-быстрые',
    badge: 'Lightning ⚡',
    params: '1.2B',
    size: '1.3 GB',
    ramMin: '2 GB RAM',
    quant: 'Q4_K_M',
    description: 'Сверхскоростная компактная модель от Meta. Мгновенные ответы даже на старых ноутбуках.',
    tags: ['lightweight', 'speed', 'general']
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    category: 'chat',
    categoryName: 'Чат и текст',
    badge: 'Best All-Rounder',
    params: '3.2B',
    size: '2.0 GB',
    ramMin: '4 GB RAM',
    quant: 'Q4_K_M',
    description: 'Универсальный эталон для повседневного общения, рерайтинга, суммаризации и перевода.',
    tags: ['chat', 'meta', 'balanced']
  },
  {
    id: 'qwen2.5-coder:1.5b',
    name: 'Qwen 2.5 Coder 1.5B',
    category: 'coding',
    categoryName: 'Программирование',
    badge: 'Fast Autocomplete',
    params: '1.5B',
    size: '1.0 GB',
    ramMin: '2 GB RAM',
    quant: 'Q4_K_M',
    description: 'Быстрый специализированный ассистент разработчика для автодополнения и генерации функций.',
    tags: ['coding', 'autocomplete', 'python']
  },
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen 2.5 Coder 7B',
    category: 'coding',
    categoryName: 'Программирование',
    badge: 'Top Coder 💻',
    params: '7.6B',
    size: '4.7 GB',
    ramMin: '8 GB RAM',
    quant: 'Q4_K_M',
    description: 'Лидер среди открытых моделей для кодинга: архитектура, рефакторинг, поиск багов и тесты.',
    tags: ['coding', 'fullstack', 'algorithms']
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B Instruct',
    category: 'chat',
    categoryName: 'Чат и текст',
    badge: 'Classic 🌟',
    params: '7.2B',
    size: '4.1 GB',
    ramMin: '8 GB RAM',
    quant: 'Q4_K_M',
    description: 'Проверенная временем классика от Mistral AI. Превосходное следование сложным инструкциям.',
    tags: ['chat', 'instructions', 'stable']
  },
  {
    id: 'phi3.5:3.8b',
    name: 'Phi-3.5 Mini',
    category: 'reasoning',
    categoryName: 'Рассуждения',
    badge: 'Microsoft AI',
    params: '3.8B',
    size: '2.2 GB',
    ramMin: '4 GB RAM',
    quant: 'Q4_K_M',
    description: 'Высокоэффективная модель от Microsoft с контекстом до 128k токенов и точной логикой.',
    tags: ['reasoning', 'long-context', 'microsoft']
  },
  {
    id: 'gemma2:2b',
    name: 'Gemma 2 2B',
    category: 'lightweight',
    categoryName: 'Ультра-быстрые',
    badge: 'Google DeepMind',
    params: '2.6B',
    size: '1.6 GB',
    ramMin: '3 GB RAM',
    quant: 'Q4_K_M',
    description: 'Компактная нейросеть от Google на базе технологий Gemini. Высокое качество рассуждений.',
    tags: ['lightweight', 'google', 'creative']
  },
  {
    id: 'smollm2:1.7b',
    name: 'SmolLM2 1.7B',
    category: 'lightweight',
    categoryName: 'Ультра-быстрые',
    badge: 'Hugging Face',
    params: '1.7B',
    size: '1.0 GB',
    ramMin: '2 GB RAM',
    quant: 'Q4_K_M',
    description: 'Оптимизированная карманная модель для локального запуска с минимальным энергопотреблением.',
    tags: ['lightweight', 'hf', 'mobile']
  },
  {
    id: 'nomic-embed-text',
    name: 'Nomic Embed Text',
    category: 'embeddings',
    categoryName: 'Эмбеддинги / RAG',
    badge: 'Search & RAG 🔍',
    params: '137M',
    size: '274 MB',
    ramMin: '512 MB RAM',
    quant: 'F16',
    description: 'Векторная модель для локального поиска, семантической индексации документов и RAG.',
    tags: ['embeddings', 'rag', 'search']
  }
];

// Fallback mock installed models if Ollama is not yet installed
let mockInstalledModels = [
  {
    name: 'llama3.2:1b',
    model: 'llama3.2:1b',
    size: 1321200000,
    digest: 'sha256:732890a8...',
    details: { format: 'gguf', family: 'llama', parameter_size: '1.2B', quantization_level: 'Q4_K_M' },
    modified_at: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

// Active pulls state tracking
const activePulls = new Map();

// CPU Measurement Helper
let lastCpuSnapshot = null;
function getCpuUsagePercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  if (!lastCpuSnapshot) {
    lastCpuSnapshot = { idle, total };
    return 0;
  }

  const idleDiff = idle - lastCpuSnapshot.idle;
  const totalDiff = total - lastCpuSnapshot.total;
  lastCpuSnapshot = { idle, total };

  if (totalDiff === 0) return 0;
  const usage = 100 - (100 * idleDiff / totalDiff);
  return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
}

// System specs detection
let cachedSystemSpecs = null;
function detectSystemSpecs() {
  if (cachedSystemSpecs) return Promise.resolve(cachedSystemSpecs);

  return new Promise((resolve) => {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown Processor';
    const cpuCount = cpus.length;
    const totalMemBytes = os.totalmem();
    const totalMemGb = Math.round((totalMemBytes / (1024 ** 3)) * 10) / 10;
    const platform = os.platform();
    const isMac = platform === 'darwin';

    const baseInfo = {
      cpuModel,
      cpuCores: cpuCount,
      totalMemGb,
      platform,
      arch: os.arch(),
      gpuName: isMac ? 'Apple Unified Memory / Metal GPU' : 'GPU Accelerator',
      isAppleSilicon: isMac && (os.arch() === 'arm64' || cpuModel.includes('Apple'))
    };

    if (isMac) {
      exec('sysctl -n machdep.cpu.brand_string', (err, stdout) => {
        if (!err && stdout.trim()) {
          baseInfo.cpuModel = stdout.trim();
        }
        cachedSystemSpecs = baseInfo;
        resolve(baseInfo);
      });
    } else {
      cachedSystemSpecs = baseInfo;
      resolve(baseInfo);
    }
  });
}

// Real-time metrics collector
async function getRealtimeMetrics() {
  const cpuPercent = getCpuUsagePercent();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  let usedMem = totalMem - freeMem;

  // On macOS, get precise memory allocation (active + wired + compressed) via vm_stat
  const memData = await new Promise((resolve) => {
    if (os.platform() === 'darwin') {
      exec('vm_stat', (err, stdout) => {
        if (!err && stdout) {
          const pageSizeMatch = stdout.match(/page size of (\d+) bytes/);
          const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 4096;
          const getPages = (key) => {
            const m = stdout.match(new RegExp(`${key}:\\s+(\\d+)`));
            return m ? parseInt(m[1], 10) : 0;
          };

          const active = getPages('Pages active');
          const wired = getPages('Pages wired down');
          const occupied = getPages('Pages occupied by compressor');
          const macUsedBytes = (active + wired + occupied) * pageSize;
          if (macUsedBytes > 0 && macUsedBytes < totalMem) {
            usedMem = macUsedBytes;
          }
        }
        resolve({
          usedGb: Math.round((usedMem / (1024 ** 3)) * 10) / 10,
          totalGb: Math.round((totalMem / (1024 ** 3)) * 10) / 10,
          percent: Math.round((usedMem / totalMem) * 100)
        });
      });
    } else {
      resolve({
        usedGb: Math.round((usedMem / (1024 ** 3)) * 10) / 10,
        totalGb: Math.round((totalMem / (1024 ** 3)) * 10) / 10,
        percent: Math.round((usedMem / totalMem) * 100)
      });
    }
  });

  // Disk space
  const diskData = await new Promise((resolve) => {
    exec('df -k /', (err, stdout) => {
      if (!err && stdout) {
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].replace(/\s+/g, ' ').split(' ');
          if (parts.length >= 4) {
            const totalKb = parseInt(parts[1], 10);
            const usedKb = parseInt(parts[2], 10);
            const availKb = parseInt(parts[3], 10);
            return resolve({
              totalGb: Math.round(totalKb / (1024 * 1024)),
              usedGb: Math.round(usedKb / (1024 * 1024)),
              freeGb: Math.round(availKb / (1024 * 1024)),
              percent: Math.round((usedKb / totalKb) * 100)
            });
          }
        }
      }
      resolve({ totalGb: 500, usedGb: 150, freeGb: 350, percent: 30 });
    });
  });

  // Estimated GPU / Metal utilization
  // On Apple Silicon, unified memory is shared; GPU load roughly correlates with LLM inference or CPU activity
  const gpuEstimate = Math.min(100, Math.max(2, Math.round(cpuPercent * 0.85 + (Math.random() * 4 - 2))));

  return {
    timestamp: Date.now(),
    cpu: {
      percent: cpuPercent,
      cores: os.cpus().length
    },
    memory: memData,
    gpu: {
      percent: gpuEstimate,
      vramUsedGb: Math.round((memData.usedGb * 0.45) * 10) / 10,
      vramTotalGb: memData.totalGb
    },
    disk: diskData
  };
}

// Check Ollama status
function checkOllamaStatus() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_HOST}/api/version`, { timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ online: true, version: json.version || '0.5.x', host: OLLAMA_HOST });
        } catch {
          resolve({ online: true, version: 'detected', host: OLLAMA_HOST });
        }
      });
    });

    req.on('error', () => {
      resolve({ online: false, version: null, host: OLLAMA_HOST });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ online: false, version: null, host: OLLAMA_HOST });
    });
  });
}

// Fetch installed models from Ollama (or fallback)
async function getInstalledModels() {
  const status = await checkOllamaStatus();
  if (!status.online) {
    return { online: false, models: mockInstalledModels };
  }

  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_HOST}/api/tags`, { timeout: 2500 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ online: true, models: json.models || [] });
        } catch {
          resolve({ online: true, models: [] });
        }
      });
    });

    req.on('error', () => resolve({ online: false, models: mockInstalledModels }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ online: false, models: mockInstalledModels });
    });
  });
}

// Static MIME helper
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Endpoints ---

  // GET /api/system/specs
  if (pathname === '/api/system/specs') {
    const specs = await detectSystemSpecs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(specs));
    return;
  }

  // GET /api/metrics (one-shot snapshot)
  if (pathname === '/api/metrics') {
    const metrics = await getRealtimeMetrics();
    const ollama = await checkOllamaStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ metrics, ollama }));
    return;
  }

  // GET /api/stream/metrics (Server-Sent Events)
  if (pathname === '/api/stream/metrics') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('\n');

    const interval = setInterval(async () => {
      try {
        const metrics = await getRealtimeMetrics();
        const ollama = await checkOllamaStatus();
        res.write(`data: ${JSON.stringify({ metrics, ollama })}\n\n`);
      } catch (err) {
        // ignore
      }
    }, 1000);

    req.on('close', () => clearInterval(interval));
    return;
  }

  // GET /api/models/catalog
  if (pathname === '/api/models/catalog') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MODEL_CATALOG));
    return;
  }

  // GET /api/models/installed
  if (pathname === '/api/models/installed') {
    const result = await getInstalledModels();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // POST /api/models/pull (SSE Stream for live download progress)
  if (pathname === '/api/models/pull') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let modelName = '';
      try {
        const parsed = JSON.parse(body || '{}');
        modelName = parsed.model || parsedUrl.searchParams.get('model');
      } catch {
        modelName = parsedUrl.searchParams.get('model');
      }

      if (!modelName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Model name is required' }));
        return;
      }

      const ollama = await checkOllamaStatus();

      // Setup SSE for the response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('\n');

      if (ollama.online) {
        // Forward real stream to Ollama
        const ollamaReq = http.request(`${OLLAMA_HOST}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (ollamaRes) => {
          ollamaRes.on('data', (chunk) => {
            const str = chunk.toString();
            // Ollama sends JSON lines: { status, digest, total, completed }
            const lines = str.split('\n').filter(Boolean);
            for (const line of lines) {
              res.write(`data: ${line}\n\n`);
            }
          });
          ollamaRes.on('end', () => {
            res.write(`data: ${JSON.stringify({ status: 'success', completed: true })}\n\n`);
            res.end();
          });
        });

        ollamaReq.on('error', (err) => {
          res.write(`data: ${JSON.stringify({ status: 'error', error: err.message })}\n\n`);
          res.end();
        });

        ollamaReq.write(JSON.stringify({ name: modelName }));
        ollamaReq.end();
      } else {
        // Ollama is offline: provide an interactive realistic simulation demo
        // so the user can test the UI experience, speed, and animation immediately!
        let progress = 0;
        const totalBytes = 1420000000;
        const steps = [
          'pulling manifest',
          'verifying sha256 digest',
          'writing manifest',
          'downloading model layer',
          'verifying layer integrity',
          'writing config',
          'success'
        ];

        let stepIndex = 0;
        const timer = setInterval(() => {
          if (stepIndex === 0) {
            res.write(`data: ${JSON.stringify({ status: 'pulling manifest' })}\n\n`);
            stepIndex++;
          } else if (progress < 100) {
            progress += Math.floor(Math.random() * 8) + 5;
            if (progress > 100) progress = 100;
            const completedBytes = Math.floor((progress / 100) * totalBytes);
            res.write(`data: ${JSON.stringify({
              status: 'downloading layer',
              completed: completedBytes,
              total: totalBytes,
              percent: progress,
              demoMode: true
            })}\n\n`);
          } else {
            clearInterval(timer);
            // Add to mock installed
            if (!mockInstalledModels.some(m => m.name === modelName)) {
              mockInstalledModels.push({
                name: modelName,
                model: modelName,
                size: totalBytes,
                digest: 'sha256:simulated_' + Math.random().toString(36).substring(7),
                details: { format: 'gguf', family: 'llama', parameter_size: '3B', quantization_level: 'Q4_K_M' },
                modified_at: new Date().toISOString()
              });
            }
            res.write(`data: ${JSON.stringify({ status: 'success', completed: true, demoMode: true })}\n\n`);
            res.end();
          }
        }, 300);

        req.on('close', () => clearInterval(timer));
      }
    });
    return;
  }

  // DELETE /api/models/delete
  if (pathname === '/api/models/delete' && req.method === 'DELETE') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let modelName = '';
      try {
        const parsed = JSON.parse(body || '{}');
        modelName = parsed.model || parsedUrl.searchParams.get('model');
      } catch {
        modelName = parsedUrl.searchParams.get('model');
      }

      const ollama = await checkOllamaStatus();
      if (ollama.online) {
        const delReq = http.request(`${OLLAMA_HOST}/api/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        }, (delRes) => {
          res.writeHead(delRes.statusCode, { 'Content-Type': 'application/json' });
          delRes.pipe(res);
        });
        delReq.on('error', (err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
        delReq.write(JSON.stringify({ name: modelName }));
        delReq.end();
      } else {
        mockInstalledModels = mockInstalledModels.filter(m => m.name !== modelName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', deleted: modelName }));
      }
    });
    return;
  }

  // POST /api/chat (Streaming Chat Inference)
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let payload = {};
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }

      const model = payload.model || 'llama3.2:1b';
      const prompt = payload.prompt || '';
      const system = payload.system || 'You are a helpful and concise local AI assistant.';
      const temperature = payload.temperature || 0.7;

      const ollama = await checkOllamaStatus();

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('\n');

      if (ollama.online) {
        const ollamaChat = http.request(`${OLLAMA_HOST}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (ollamaRes) => {
          ollamaRes.on('data', (chunk) => {
            const str = chunk.toString();
            const lines = str.split('\n').filter(Boolean);
            for (const line of lines) {
              res.write(`data: ${line}\n\n`);
            }
          });
          ollamaRes.on('end', () => {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
          });
        });

        ollamaChat.on('error', (err) => {
          res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
          res.end();
        });

        ollamaChat.write(JSON.stringify({
          model,
          prompt,
          system,
          options: { temperature }
        }));
        ollamaChat.end();
      } else {
        // Standalone Demo Mode response generator
        const demoResponses = [
          `Привет! Я локальная модель **${model}**, запущенная в интерактивном режиме.\n\n` +
          `Вы спросили: _"${prompt}"_\n\n` +
          `• Время отклика: 24 ms\n` +
          `• Архитектура: GGUF 4-bit\n` +
          `• Устройство инференса: Apple Silicon (Metal)\n\n` +
          `Для подключения настоящих весов установите Ollama командой:\n` +
          `\`brew install ollama && ollama serve\``,

          `Локальный ИИ готов к работе! 🚀\n\n` +
          `Ваш запрос: **"${prompt}"** успешно обработан на локальном железе с полной конфиденциальностью данных без отправки в облако.\n\n` +
          `Текущий статус ресурсов:\n` +
          `- Загрузка CPU: умеренная\n` +
          `- Память: в норме\n` +
          `- Скорость генерации: ~35 токенов/сек.`
        ];

        const textToStream = demoResponses[Math.floor(Math.random() * demoResponses.length)];
        const words = textToStream.split(' ');
        let wordIdx = 0;

        const chatTimer = setInterval(() => {
          if (wordIdx < words.length) {
            const chunk = words[wordIdx] + ' ';
            res.write(`data: ${JSON.stringify({ response: chunk, done: false })}\n\n`);
            wordIdx++;
          } else {
            clearInterval(chatTimer);
            res.write(`data: ${JSON.stringify({
              done: true,
              total_duration: 1200000000,
              eval_count: words.length,
              eval_duration: 950000000
            })}\n\n`);
            res.end();
          }
        }, 55);

        req.on('close', () => clearInterval(chatTimer));
      }
    });
    return;
  }

  // GET /api/agent/roles
  if (pathname === '/api/agent/roles') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(AGENT_ROLES));
    return;
  }

  // GET /api/agent/tools
  if (pathname === '/api/agent/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(TOOLS));
    return;
  }

  // GET /api/agent/workdir
  if (pathname === '/api/agent/workdir') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ workdir: WORKSPACE_DIR }));
    return;
  }

  // POST /api/agent/run (SSE stream of agent steps)
  if (pathname === '/api/agent/run' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let payload = {};
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }

      const prompt = payload.prompt || '';
      const roleId = payload.roleId || 'coder';
      const model = payload.model || 'qwen2.5-coder:7b';
      const maxSteps = payload.maxSteps || 6;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write('\n');

      await runAgentTask({
        prompt,
        roleId,
        model,
        maxSteps,
        ollamaHost: OLLAMA_HOST,
        onEvent: (event, data) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      });

      res.end();
    });
    return;
  }

  // --- Static Files Serving ---
  let safePath = path.normalize(pathname);
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Security check to avoid directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Start Server
detectSystemSpecs().then(specs => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(` ✨ Local AI Dashboard running at http://localhost:${PORT}`);
    console.log(` 💻 System: ${specs.cpuModel} (${specs.cpuCores} cores, ${specs.totalMemGb} GB RAM)`);
    console.log(` 🚀 GPU/Metal: ${specs.gpuName}`);
    console.log(` 📦 Ollama Host: ${OLLAMA_HOST}`);
    console.log(`======================================================\n`);
  });
});
