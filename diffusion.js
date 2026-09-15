const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

// Catalog of Premier Local Diffusion Models (Flux & Stable Diffusion)
const DIFFUSION_CATALOG = [
  {
    id: 'flux-1-schnell',
    name: 'FLUX.1 Schnell',
    provider: 'Black Forest Labs',
    arch: '12B DiT (Rectified Flow)',
    category: 'flux',
    badge: 'SOTA 4-Step',
    defaultSteps: 4,
    defaultCfg: 2.0,
    recommendedRes: '1024x1024',
    vram: '12 GB VRAM (Q4/FP8)',
    size: '11.9 GB',
    description: 'Новейшая 12-миллиардная модель с архитектурой Diffusion Transformer. Молниеносная 4-шаговая дистилляция, непревзойденная композиция и детализация.',
    tags: ['flux', 'fast', 'photoreal', 'sota']
  },
  {
    id: 'flux-1-dev',
    name: 'FLUX.1 Dev',
    provider: 'Black Forest Labs',
    arch: '12B DiT (Guidance-Distilled)',
    category: 'flux',
    badge: 'SOTA Premier',
    defaultSteps: 25,
    defaultCfg: 3.5,
    recommendedRes: '1024x1024',
    vram: '16 GB VRAM',
    size: '23.8 GB (FP16) / 12 GB (FP8)',
    description: 'Флагман открытого фотореализма. Идеальное следование сложным промптам, естественная пластика человека и точный рендеринг шрифтов и текста.',
    tags: ['flux', 'flagship', 'pro', 'typography']
  },
  {
    id: 'sd-3.5-large',
    name: 'Stable Diffusion 3.5 Large',
    provider: 'Stability AI',
    arch: '8.1B MMDiT (Multimodal Transformer)',
    category: 'sd3',
    badge: 'Stability 8B',
    defaultSteps: 28,
    defaultCfg: 4.5,
    recommendedRes: '1024x1024',
    vram: '12 GB VRAM',
    size: '16.2 GB',
    description: 'Крупная мультимодальная модель Stability AI. Глубокое понимание сложных сцен, кинематографического света и правильных пропорций объектов.',
    tags: ['stability', 'sd3.5', 'large', 'dit']
  },
  {
    id: 'sd-3.5-medium',
    name: 'Stable Diffusion 3.5 Medium',
    provider: 'Stability AI',
    arch: '2.5B MMDiT',
    category: 'sd3',
    badge: 'Efficient SOTA',
    defaultSteps: 25,
    defaultCfg: 5.0,
    recommendedRes: '1024x1024',
    vram: '8 GB VRAM',
    size: '5.2 GB',
    description: 'Сбалансированная модель для обычных видеокарт и Mac с 8-16 GB RAM. Превосходная эстетика при умеренном расходе памяти.',
    tags: ['stability', 'sd3.5', 'medium', 'balanced']
  },
  {
    id: 'sdxl-base-1.0',
    name: 'SDXL 1.0 Base',
    provider: 'Stability AI',
    arch: '3.5B UNet',
    category: 'sdxl',
    badge: 'Industry Standard',
    defaultSteps: 30,
    defaultCfg: 7.0,
    recommendedRes: '1024x1024',
    vram: '8 GB VRAM',
    size: '6.9 GB',
    description: 'Классический эталон генерации 1024x1024 с самой богатой в мире экосистемой пользовательских LoRA, стилей и ControlNet.',
    tags: ['sdxl', 'community', 'lora', 'versatile']
  },
  {
    id: 'sdxl-turbo',
    name: 'SDXL Turbo',
    provider: 'Stability AI',
    arch: '3.5B Adversarial ADD',
    category: 'sdxl',
    badge: 'Real-Time 1-Step',
    defaultSteps: 2,
    defaultCfg: 1.5,
    recommendedRes: '512x512',
    vram: '6 GB VRAM',
    size: '6.9 GB',
    description: 'Инференс в реальном времени за 1-2 шага без потери базовой структуры кадра. Идеально для мгновенных превью и прототипирования.',
    tags: ['sdxl', 'turbo', 'realtime', 'fast']
  },
  {
    id: 'realistic-vision-v6',
    name: 'Realistic Vision V6.0 B1',
    provider: 'SG_161222',
    arch: 'SD 1.5 Fine-tuned',
    category: 'community',
    badge: 'Photoreal King',
    defaultSteps: 25,
    defaultCfg: 6.5,
    recommendedRes: '512x768',
    vram: '4 GB VRAM',
    size: '2.1 GB',
    description: 'Признанный фаворит сообщества для фотореалистичных портретов, макросъемки, микротекстур кожи и естественного взгляда.',
    tags: ['photoreal', 'portraits', 'macro', 'popular']
  },
  {
    id: 'dreamshaper-xl',
    name: 'DreamShaper XL',
    provider: 'Lykon',
    arch: 'SDXL Fine-tuned',
    category: 'community',
    badge: 'Digital Art & CGI',
    defaultSteps: 25,
    defaultCfg: 6.0,
    recommendedRes: '1024x1024',
    vram: '8 GB VRAM',
    size: '6.5 GB',
    description: 'Универсальная творческая модель для концепт-арта, фэнтези, 3D-рендеров, аниме и кинематографических иллюстраций.',
    tags: ['art', 'cgi', 'anime', 'creative']
  },
  {
    id: 'sd-1.5',
    name: 'Stable Diffusion 1.5',
    provider: 'Runway / Stability AI',
    arch: '980M UNet',
    category: 'classic',
    badge: 'Ultra-Lightweight',
    defaultSteps: 20,
    defaultCfg: 7.0,
    recommendedRes: '512x512',
    vram: '4 GB VRAM',
    size: '4.0 GB',
    description: 'Легендарный легкий чекпоинт, работающий практически на любом оборудовании с мгновенным откликом.',
    tags: ['classic', 'lightweight', 'sd15']
  }
];

// Local state for installed models and generation history
let installedDiffusionModels = [
  {
    id: 'flux-1-schnell',
    name: 'FLUX.1 Schnell',
    installedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    sizeOnDisk: '11.9 GB',
    status: 'ready'
  },
  {
    id: 'sdxl-base-1.0',
    name: 'SDXL 1.0 Base',
    installedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    sizeOnDisk: '6.9 GB',
    status: 'ready'
  }
];

let generationHistory = [];

/**
 * Check connectivity to popular local image generation backends:
 * 1. ComfyUI on http://127.0.0.1:8188
 * 2. SD WebUI / Forge on http://127.0.0.1:7860
 * 3. CLI runner sd (stable-diffusion.cpp)
 */
async function checkDiffusionBackends() {
  const results = {
    comfyui: { online: false, host: 'http://127.0.0.1:8188' },
    webui: { online: false, host: 'http://127.0.0.1:7860' },
    sdCli: { available: false },
    activeBackend: 'demo'
  };

  // 1. Check ComfyUI
  try {
    const comfyCheck = await new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:8188/system_stats', { timeout: 350 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
    results.comfyui.online = comfyCheck;
    if (comfyCheck) results.activeBackend = 'comfyui';
  } catch {}

  // 2. Check SD WebUI / Forge
  if (!results.comfyui.online) {
    try {
      const webuiCheck = await new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:7860/sdapi/v1/options', { timeout: 350 }, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      results.webui.online = webuiCheck;
      if (webuiCheck) results.activeBackend = 'webui';
    } catch {}
  }

  // 3. Check sd CLI tool
  try {
    const cliFound = await new Promise((resolve) => {
      exec('which sd || which stable-diffusion', { timeout: 400 }, (err, stdout) => {
        resolve(Boolean(!err && stdout && stdout.trim()));
      });
    });
    results.sdCli.available = cliFound;
    if (!results.comfyui.online && !results.webui.online && cliFound) {
      results.activeBackend = 'sdCli';
    }
  } catch {}

  return results;
}

/**
 * Generate an image using available local backend or high-fidelity procedural renderer
 */
async function generateDiffusionImage(params) {
  const {
    model = 'flux-1-schnell',
    prompt = 'A stunning futuristic city with glowing neon architecture and volumetric fog',
    negativePrompt = '',
    width = 1024,
    height = 1024,
    steps = 4,
    cfgScale = 2.0,
    sampler = 'Euler',
    seed = Math.floor(Math.random() * 100000000)
  } = params;

  const startTime = Date.now();
  const backends = await checkDiffusionBackends();
  let imageUri = '';
  let backendUsed = backends.activeBackend;

  if (backends.webui.online) {
    // Integration with SD WebUI / WebUI Forge API
    try {
      imageUri = await requestWebUiTxt2Img(backends.webui.host, {
        prompt,
        negative_prompt: negativePrompt,
        width,
        height,
        steps,
        cfg_scale: cfgScale,
        seed,
        sampler_name: sampler
      });
      backendUsed = 'webui';
    } catch (e) {
      imageUri = generateProceduralArtwork({ model, prompt, width, height, seed, steps, cfgScale, sampler });
      backendUsed = 'demo';
    }
  } else {
    // Generate high-resolution procedural vector/canvas SVG artwork with embedded metadata
    imageUri = generateProceduralArtwork({ model, prompt, width, height, seed, steps, cfgScale, sampler });
    backendUsed = 'demo';
  }

  const durationMs = Date.now() - startTime;
  const resultItem = {
    id: 'img_' + Date.now() + '_' + Math.random().toString(36).substring(7),
    imageUri,
    model,
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    cfgScale,
    seed,
    sampler,
    backendUsed,
    durationMs,
    createdAt: new Date().toISOString()
  };

  generationHistory.unshift(resultItem);
  if (generationHistory.length > 50) generationHistory.pop();

  return resultItem;
}

/**
 * Helper to call Automatic1111 / WebUI Forge API
 */
function requestWebUiTxt2Img(host, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request(`${host}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.images && parsed.images[0]) {
            resolve(`data:image/png;base64,${parsed.images[0]}`);
          } else {
            reject(new Error('No image returned from WebUI'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout contacting SD WebUI')); });
    req.write(postData);
    req.end();
  });
}

/**
 * Generate a rich, stylized artwork in SVG format with embedded metadata,
 * color harmonies, dynamic gradients, depth layers, and model badge.
 */
function generateProceduralArtwork({ model, prompt, width, height, seed, steps, cfgScale, sampler }) {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const pLower = (prompt || '').toLowerCase();

  let c1, c2, c3, c4;
  if (pLower.includes('cyber') || pLower.includes('neon') || pLower.includes('future') || pLower.includes('robot')) {
    c1 = '#090d16'; c2 = '#06b6d4'; c3 = '#ec4899'; c4 = '#8b5cf6';
  } else if (pLower.includes('portrait') || pLower.includes('face') || pLower.includes('girl') || pLower.includes('man') || pLower.includes('person')) {
    c1 = '#120d0f'; c2 = '#f59e0b'; c3 = '#f43f5e'; c4 = '#4f46e5';
  } else if (pLower.includes('nature') || pLower.includes('forest') || pLower.includes('mountain') || pLower.includes('landscape')) {
    c1 = '#06130e'; c2 = '#10b981'; c3 = '#34d399'; c4 = '#0284c7';
  } else if (pLower.includes('anime') || pLower.includes('manga') || pLower.includes('art') || pLower.includes('fantasy')) {
    c1 = '#100b1e'; c2 = '#a855f7'; c3 = '#38bdf8'; c4 = '#fb7185';
  } else {
    c1 = '#0a0e17'; c2 = '#6366f1'; c3 = '#06b6d4'; c4 = '#10b981';
  }

  const curves = [];
  for (let i = 0; i < 7; i++) {
    const y1 = Math.round(height * (0.2 + rnd() * 0.7));
    const y2 = Math.round(height * (0.2 + rnd() * 0.7));
    const cx1 = Math.round(width * 0.35);
    const cy1 = Math.round(height * rnd());
    const cx2 = Math.round(width * 0.65);
    const cy2 = Math.round(height * rnd());
    const strokeColor = i % 2 === 0 ? c2 : (i % 3 === 0 ? c3 : c4);
    const opacity = (0.25 + rnd() * 0.45).toFixed(2);
    curves.push(`<path d="M 0 ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${width} ${y2}" fill="none" stroke="${strokeColor}" stroke-width="${Math.round(2 + rnd() * 4)}" opacity="${opacity}" filter="url(#glow)"/>`);
  }

  const particles = [];
  for (let i = 0; i < 40; i++) {
    const px = Math.round(width * rnd());
    const py = Math.round(height * rnd());
    const pr = (1.5 + rnd() * 3.5).toFixed(1);
    const pcol = rnd() > 0.5 ? c2 : c3;
    const pop = (0.3 + rnd() * 0.6).toFixed(2);
    particles.push(`<circle cx="${px}" cy="${py}" r="${pr}" fill="${pcol}" opacity="${pop}"/>`);
  }

  const modelInfo = DIFFUSION_CATALOG.find(m => m.id === model) || { name: model, arch: 'Diffusion' };
  const promptExcerpt = prompt.length > 55 ? prompt.substring(0, 52) + '...' : prompt;

  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="#111827"/>
      <stop offset="100%" stop-color="${c1}"/>
    </linearGradient>
    <radialGradient id="radialCore" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="${c2}" stop-opacity="0.32"/>
      <stop offset="45%" stop-color="${c3}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${c1}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <rect width="${width}" height="${height}" fill="url(#radialCore)"/>

  <g id="composition">
    <circle cx="${Math.round(width * 0.5)}" cy="${Math.round(height * 0.45)}" r="${Math.round(Math.min(width, height) * 0.28)}" fill="none" stroke="${c2}" stroke-width="2" opacity="0.45" stroke-dasharray="8 6"/>
    <circle cx="${Math.round(width * 0.5)}" cy="${Math.round(height * 0.45)}" r="${Math.round(Math.min(width, height) * 0.20)}" fill="none" stroke="${c3}" stroke-width="1.5" opacity="0.6"/>
    <circle cx="${Math.round(width * 0.5)}" cy="${Math.round(height * 0.45)}" r="${Math.round(Math.min(width, height) * 0.12)}" fill="${c4}" opacity="0.22" filter="url(#glow)"/>
    ${curves.join('\n    ')}
    ${particles.join('\n    ')}
  </g>

  <rect width="${width}" height="${height}" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="12"/>

  <rect x="0" y="${height - 56}" width="${width}" height="56" fill="rgba(8, 12, 20, 0.82)"/>
  <line x1="0" y1="${height - 56}" x2="${width}" y2="${height - 56}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>

  <text x="18" y="${height - 34}" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13" font-weight="600" letter-spacing="0.3">${escapeXml(modelInfo.name)} • ${width}x${height}</text>
  <text x="18" y="${height - 16}" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="11">"${escapeXml(promptExcerpt)}" • Seed: ${seed} • Steps: ${steps} • CFG: ${cfgScale}</text>

  <g transform="translate(${width - 130}, ${height - 38})">
    <rect width="112" height="22" rx="4" fill="rgba(99, 102, 241, 0.25)" stroke="#6366f1" stroke-width="1"/>
    <text x="56" y="15" fill="#818cf8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="10" font-weight="600" text-anchor="middle">LOCAL DIFFUSION</text>
  </g>
</svg>
  `.trim();

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgContent);
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
}

function installDiffusionModel(modelId) {
  const model = DIFFUSION_CATALOG.find(m => m.id === modelId);
  if (!model) return { error: 'Model not found in catalog' };

  if (!installedDiffusionModels.some(m => m.id === modelId)) {
    installedDiffusionModels.push({
      id: model.id,
      name: model.name,
      installedAt: new Date().toISOString(),
      sizeOnDisk: model.size,
      status: 'ready'
    });
  }
  return { success: true, model: model.name };
}

function deleteDiffusionModel(modelId) {
  installedDiffusionModels = installedDiffusionModels.filter(m => m.id !== modelId);
  return { success: true, deleted: modelId };
}

module.exports = {
  DIFFUSION_CATALOG,
  installedDiffusionModels,
  generationHistory,
  checkDiffusionBackends,
  generateDiffusionImage,
  installDiffusionModel,
  deleteDiffusionModel
};
