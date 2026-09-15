/**
 * Local AI Hub — Frontend Controller
 * Minimalist design, high-performance Canvas charts & real-time Ollama integration.
 */

// State
const state = {
  cpuHistory: Array(30).fill(0),
  ramHistory: Array(30).fill(0),
  gpuHistory: Array(30).fill(0),
  masterCpuHistory: Array(60).fill(0),
  masterRamHistory: Array(60).fill(0),
  catalog: [],
  installedModels: [],
  activeCategory: 'all',
  isPulling: false,
  isGenerating: false,
  ollamaOnline: false,
  cpuPeaks: []
};

// DOM Elements
const elements = {
  systemSpecs: document.getElementById('headerSystemSpecs'),
  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),
  ollamaStatusBtn: document.getElementById('ollamaStatusBtn'),
  openSetupModalBtn: document.getElementById('openSetupModalBtn'),
  closeSetupModalBtn: document.getElementById('closeSetupModalBtn'),
  modalOkBtn: document.getElementById('modalOkBtn'),
  setupModal: document.getElementById('setupModal'),

  // Metrics
  cpuVal: document.getElementById('cpuVal'),
  cpuSubtext: document.getElementById('cpuSubtext'),
  cpuCoresBadge: document.getElementById('cpuCoresBadge'),
  cpuPeak: document.getElementById('cpuPeak'),
  cpuAvg: document.getElementById('cpuAvg'),

  ramVal: document.getElementById('ramVal'),
  ramSubtext: document.getElementById('ramSubtext'),
  ramPercentBadge: document.getElementById('ramPercentBadge'),
  ramFree: document.getElementById('ramFree'),
  ramPressure: document.getElementById('ramPressure'),

  gpuVal: document.getElementById('gpuVal'),
  gpuSubtext: document.getElementById('gpuSubtext'),
  gpuVram: document.getElementById('gpuVram'),

  diskFreeVal: document.getElementById('diskFreeVal'),
  diskUsedPercent: document.getElementById('diskUsedPercent'),
  diskSubtext: document.getElementById('diskSubtext'),
  diskBarFill: document.getElementById('diskBarFill'),
  diskTotal: document.getElementById('diskTotal'),
  diskUsed: document.getElementById('diskUsed'),

  // Detailed Master Chart
  toggleDetailedChartBtn: document.getElementById('toggleDetailedChartBtn'),
  masterChartSection: document.getElementById('masterChartSection'),
  clearChartHistoryBtn: document.getElementById('clearChartHistoryBtn'),

  // Models
  modelsGrid: document.getElementById('modelsGrid'),
  filterTabs: document.querySelectorAll('.filter-tabs .tab-btn'),
  customModelInput: document.getElementById('customModelInput'),
  customPullBtn: document.getElementById('customPullBtn'),
  pullProgressCard: document.getElementById('pullProgressCard'),
  pullModelName: document.getElementById('pullModelName'),
  pullStepDesc: document.getElementById('pullStepDesc'),
  pullPercent: document.getElementById('pullPercent'),
  pullBytes: document.getElementById('pullBytes'),
  pullProgressBar: document.getElementById('pullProgressBar'),
  pullNote: document.getElementById('pullNote'),

  // Installed & Chat
  installedList: document.getElementById('installedList'),
  refreshInstalledBtn: document.getElementById('refreshInstalledBtn'),
  chatModelSelect: document.getElementById('chatModelSelect'),
  tpsBadge: document.getElementById('tpsBadge'),
  chatMessages: document.getElementById('chatMessages'),
  chatInput: document.getElementById('chatInput'),
  chatSendBtn: document.getElementById('chatSendBtn')
};

// Canvas references
const canvases = {
  cpu: document.getElementById('cpuChart'),
  ram: document.getElementById('ramChart'),
  gpu: document.getElementById('gpuChart'),
  master: document.getElementById('masterChart')
};

// ============================================================================
// CANVAS CHART ENGINE (High-DPI Retina Smooth Bezier Area Chart)
// ============================================================================

function setupHiDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  return { ctx, width: rect.width, height: rect.height };
}

/**
 * Draws smooth cubic Bezier curve through data points
 */
function drawSmoothCurve(ctx, points, width, height, strokeColor, fillColor, shadowColor) {
  if (points.length < 2) return;

  const n = points.length;
  const stepX = width / (n - 1);
  const coords = points.map((val, i) => ({
    x: i * stepX,
    y: height - (val / 100) * (height - 8) - 4
  }));

  // Fill area under curve
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(coords[0].x, height);
  ctx.lineTo(coords[0].x, coords[0].y);

  for (let i = 0; i < n - 1; i++) {
    const cp1x = coords[i].x + (coords[i + 1].x - coords[i].x) / 2;
    const cp1y = coords[i].y;
    const cp2x = coords[i].x + (coords[i + 1].x - coords[i].x) / 2;
    const cp2y = coords[i + 1].y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, coords[i + 1].x, coords[i + 1].y);
  }

  ctx.lineTo(coords[n - 1].x, height);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.restore();

  // Stroke line with glow
  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 0; i < n - 1; i++) {
    const cp1x = coords[i].x + (coords[i + 1].x - coords[i].x) / 2;
    const cp1y = coords[i].y;
    const cp2x = coords[i].x + (coords[i + 1].x - coords[i].x) / 2;
    const cp2y = coords[i + 1].y;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, coords[i + 1].x, coords[i + 1].y);
  }
  ctx.stroke();
  ctx.restore();

  // Glow current value dot at the tip
  const lastPoint = coords[coords.length - 1];
  ctx.save();
  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();
}

function renderMiniCharts() {
  // 1. CPU Chart (Cyan)
  if (canvases.cpu) {
    const { ctx, width, height } = setupHiDPI(canvases.cpu);
    ctx.clearRect(0, 0, width, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    drawSmoothCurve(ctx, state.cpuHistory, width, height, '#06b6d4', grad, 'rgba(6, 182, 212, 0.8)');
  }

  // 2. RAM Chart (Emerald)
  if (canvases.ram) {
    const { ctx, width, height } = setupHiDPI(canvases.ram);
    ctx.clearRect(0, 0, width, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    drawSmoothCurve(ctx, state.ramHistory, width, height, '#10b981', grad, 'rgba(16, 185, 129, 0.8)');
  }

  // 3. GPU Chart (Violet)
  if (canvases.gpu) {
    const { ctx, width, height } = setupHiDPI(canvases.gpu);
    ctx.clearRect(0, 0, width, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
    grad.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
    drawSmoothCurve(ctx, state.gpuHistory, width, height, '#8b5cf6', grad, 'rgba(139, 92, 246, 0.8)');
  }

  // 4. Master Timeline Chart
  if (canvases.master && !elements.masterChartSection.classList.contains('hidden')) {
    const { ctx, width, height } = setupHiDPI(canvases.master);
    ctx.clearRect(0, 0, width, height);

    // Draw horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px ui-monospace, SFMono-Regular, monospace';

    const levels = [0, 25, 50, 75, 100];
    for (const lvl of levels) {
      const y = height - (lvl / 100) * (height - 24) - 12;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${lvl}%`, 4, y + 3);
    }

    // Offset drawing region for master lines
    ctx.save();
    ctx.rect(35, 0, width - 35, height);
    ctx.clip();

    const chartWidth = width - 35;
    ctx.translate(35, 0);

    // RAM Area
    const ramGrad = ctx.createLinearGradient(0, 0, 0, height);
    ramGrad.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    ramGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    drawSmoothCurve(ctx, state.masterRamHistory, chartWidth, height, '#10b981', ramGrad, 'rgba(16, 185, 129, 0.6)');

    // CPU Area
    const cpuGrad = ctx.createLinearGradient(0, 0, 0, height);
    cpuGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    cpuGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    drawSmoothCurve(ctx, state.masterCpuHistory, chartWidth, height, '#06b6d4', cpuGrad, 'rgba(6, 182, 212, 0.8)');

    ctx.restore();
  }
}

// ============================================================================
// SYSTEM TELEMETRY & SSE STREAM
// ============================================================================

function connectTelemetry() {
  const eventSource = new EventSource('/api/stream/metrics');

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      updateMetricsUI(data.metrics);
      updateOllamaStatusUI(data.ollama);
    } catch (err) {
      console.error('Error parsing telemetry:', err);
    }
  };

  eventSource.onerror = () => {
    console.warn('Telemetry SSE disconnected. Retrying...');
    // Fallback polling if SSE fails
    setTimeout(fetchMetricsSnapshot, 2000);
  };
}

async function fetchMetricsSnapshot() {
  try {
    const res = await fetch('/api/metrics');
    if (res.ok) {
      const data = await res.json();
      updateMetricsUI(data.metrics);
      updateOllamaStatusUI(data.ollama);
    }
  } catch (err) {
    console.error('Snapshot fetch error:', err);
  }
}

function updateMetricsUI(metrics) {
  if (!metrics) return;

  // CPU
  const cpu = metrics.cpu;
  elements.cpuVal.innerHTML = `${cpu.percent}<span class="metric-unit">%</span>`;
  elements.cpuCoresBadge.textContent = `${cpu.cores} Cores`;

  // History shift
  state.cpuHistory.push(cpu.percent);
  if (state.cpuHistory.length > 30) state.cpuHistory.shift();

  state.masterCpuHistory.push(cpu.percent);
  if (state.masterCpuHistory.length > 60) state.masterCpuHistory.shift();

  // Peak & Avg
  state.cpuPeaks.push(cpu.percent);
  if (state.cpuPeaks.length > 60) state.cpuPeaks.shift();
  const peak = Math.max(...state.cpuPeaks);
  const avg = Math.round(state.cpuPeaks.reduce((a, b) => a + b, 0) / state.cpuPeaks.length);
  elements.cpuPeak.textContent = `${peak}%`;
  elements.cpuAvg.textContent = `${avg}%`;

  // RAM
  const mem = metrics.memory;
  elements.ramVal.innerHTML = `${mem.usedGb} <span class="metric-unit">GB</span>`;
  elements.ramSubtext.textContent = `из ${mem.totalGb} GB (${mem.percent}%)`;
  elements.ramPercentBadge.textContent = `${mem.percent}%`;
  elements.ramFree.textContent = `${Math.round((mem.totalGb - mem.usedGb) * 10) / 10} GB`;

  state.ramHistory.push(mem.percent);
  if (state.ramHistory.length > 30) state.ramHistory.shift();

  state.masterRamHistory.push(mem.percent);
  if (state.masterRamHistory.length > 60) state.masterRamHistory.shift();

  if (mem.percent > 85) {
    elements.ramPressure.textContent = 'Высокая';
    elements.ramPressure.className = 'text-danger';
  } else {
    elements.ramPressure.textContent = 'Норма';
    elements.ramPressure.className = 'text-emerald';
  }

  // GPU / Metal
  const gpu = metrics.gpu;
  elements.gpuVal.innerHTML = `${gpu.percent}<span class="metric-unit">%</span>`;
  elements.gpuVram.textContent = `${gpu.vramUsedGb} GB`;

  state.gpuHistory.push(gpu.percent);
  if (state.gpuHistory.length > 30) state.gpuHistory.shift();

  // Disk
  const disk = metrics.disk;
  elements.diskFreeVal.innerHTML = `${disk.freeGb} <span class="metric-unit">GB</span>`;
  elements.diskUsedPercent.textContent = `${disk.percent}% занято`;
  elements.diskTotal.textContent = `${disk.totalGb} GB`;
  elements.diskUsed.textContent = `${disk.usedGb} GB`;
  elements.diskBarFill.style.width = `${disk.percent}%`;

  // Trigger smooth chart redraw
  renderMiniCharts();
}

function updateOllamaStatusUI(ollama) {
  state.ollamaOnline = ollama && ollama.online;
  if (state.ollamaOnline) {
    elements.statusDot.className = 'status-dot active pulsing';
    elements.statusLabel.textContent = `Ollama ${ollama.version}`;
  } else {
    elements.statusDot.className = 'status-dot offline pulsing';
    elements.statusLabel.textContent = 'Автономный режим (Демо)';
  }
}

// ============================================================================
// SYSTEM SPECS LOADER
// ============================================================================

async function loadSystemSpecs() {
  try {
    const res = await fetch('/api/system/specs');
    if (res.ok) {
      const specs = await res.json();
      elements.systemSpecs.textContent = `${specs.cpuModel} • ${specs.cpuCores} Cores • ${specs.totalMemGb} GB RAM`;
    }
  } catch (err) {
    elements.systemSpecs.textContent = 'Apple M-Series / Core Local AI System';
  }
}

// ============================================================================
// MODEL CATALOG & SHOWCASE
// ============================================================================

async function loadModelCatalog() {
  try {
    const res = await fetch('/api/models/catalog');
    if (res.ok) {
      state.catalog = await res.json();
      renderModelsGrid();
    }
  } catch (err) {
    console.error('Error loading catalog:', err);
  }
}

function renderModelsGrid() {
  const container = elements.modelsGrid;
  container.innerHTML = '';

  const filtered = state.catalog.filter(model => {
    if (state.activeCategory === 'all') return true;
    return model.category === state.activeCategory || model.tags.includes(state.activeCategory);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>В этой категории пока нет моделей.</p></div>';
    return;
  }

  for (const model of filtered) {
    const isInstalled = state.installedModels.some(m => m.name === model.id || m.model === model.id);
    const card = document.createElement('div');
    card.className = 'model-card';

    card.innerHTML = `
      <div class="model-card-top">
        <div class="model-title-row">
          <div class="model-name">${escapeHtml(model.name)}</div>
          <span class="badge badge-outline">${escapeHtml(model.badge)}</span>
        </div>
        <div class="model-meta-badges">
          <span class="badge badge-cyan">${escapeHtml(model.params)}</span>
          <span class="badge badge-emerald">${escapeHtml(model.ramMin)}</span>
          <span class="badge badge-violet">${escapeHtml(model.quant)}</span>
        </div>
        <p class="model-desc">${escapeHtml(model.description)}</p>
      </div>
      <div class="model-card-bottom">
        <div class="model-specs-spec">
          <span class="model-specs-size">${escapeHtml(model.size)}</span>
          <span class="model-specs-ram">${escapeHtml(model.ramMin)}</span>
        </div>
        <button class="btn btn-install ${isInstalled ? 'btn-installed' : ''}" 
                data-model="${escapeHtml(model.id)}" 
                ${isInstalled ? 'disabled' : ''}>
          ${isInstalled ? '✓ Установлено' : 'Установить'}
        </button>
      </div>
    `;

    const installBtn = card.querySelector('.btn-install');
    if (!isInstalled) {
      installBtn.addEventListener('click', () => pullModel(model.id));
    }

    container.appendChild(card);
  }
}

// ============================================================================
// MODEL INSTALLATION (PULL STREAM)
// ============================================================================

function pullModel(modelName) {
  if (state.isPulling) {
    alert('Уже идет скачивание другой модели. Пожалуйста, дождитесь завершения.');
    return;
  }

  state.isPulling = true;
  elements.pullProgressCard.classList.remove('hidden');
  elements.pullModelName.textContent = `Скачивание: ${modelName}`;
  elements.pullStepDesc.textContent = 'Инициализация загрузки слоев...';
  elements.pullPercent.textContent = '0%';
  elements.pullBytes.textContent = 'Подготовка...';
  elements.pullProgressBar.style.width = '0%';

  // Scroll smoothly to progress card
  elements.pullProgressCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Open SSE stream for pull
  const evt = new EventSource(`/api/models/pull?model=${encodeURIComponent(modelName)}`);

  evt.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);

      if (data.status) {
        elements.pullStepDesc.textContent = formatStepStatus(data.status);
      }

      if (data.total && data.completed !== undefined) {
        const percent = Math.min(100, Math.round((data.completed / data.total) * 100));
        elements.pullPercent.textContent = `${percent}%`;
        elements.pullProgressBar.style.width = `${percent}%`;
        elements.pullBytes.textContent = `${formatBytes(data.completed)} / ${formatBytes(data.total)}`;
      }

      if (data.status === 'success' || data.completed === true) {
        evt.close();
        finishPullSuccess(modelName);
      }
    } catch (err) {
      console.error('Pull event parse error:', err);
    }
  };

  evt.onerror = () => {
    evt.close();
    state.isPulling = false;
    elements.pullStepDesc.textContent = 'Загрузка завершена или прервана.';
    setTimeout(() => {
      loadInstalledModels();
      renderModelsGrid();
      elements.pullProgressCard.classList.add('hidden');
    }, 2500);
  };
}

function finishPullSuccess(modelName) {
  state.isPulling = false;
  elements.pullPercent.textContent = '100%';
  elements.pullProgressBar.style.width = '100%';
  elements.pullStepDesc.textContent = '✓ Модель успешно установлена и готова к работе!';

  // Refresh lists
  loadInstalledModels();
  renderModelsGrid();

  // Hide progress after 3 seconds
  setTimeout(() => {
    elements.pullProgressCard.classList.add('hidden');
  }, 3500);
}

function formatStepStatus(status) {
  switch (status) {
    case 'pulling manifest': return 'Получение манифеста архитектуры...';
    case 'downloading layer': return 'Загрузка квантованных весов модели...';
    case 'verifying sha256 digest': return 'Проверка целостности SHA-256...';
    case 'writing manifest': return 'Регистрация модели в локальном реестре...';
    case 'writing config': return 'Настройка параметров квантования...';
    case 'success': return 'Готово к инференсу!';
    default: return status;
  }
}

// ============================================================================
// INSTALLED MODELS MANAGER
// ============================================================================

async function loadInstalledModels() {
  try {
    const res = await fetch('/api/models/installed');
    if (res.ok) {
      const data = await res.json();
      state.installedModels = data.models || [];
      renderInstalledList();
      populateChatModelSelect();
    }
  } catch (err) {
    console.error('Error loading installed models:', err);
  }
}

function renderInstalledList() {
  const container = elements.installedList;
  container.innerHTML = '';

  if (state.installedModels.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📦</span>
        <p>Нет установленных моделей.<br>Выберите модель в витрине выше для установки в 1 клик.</p>
      </div>
    `;
    return;
  }

  for (const m of state.installedModels) {
    const item = document.createElement('div');
    item.className = 'installed-item';

    const sizeStr = m.size ? formatBytes(m.size) : '1.2 GB';
    const quant = m.details?.quantization_level || 'Q4_K_M';
    const param = m.details?.parameter_size || '3B';

    item.innerHTML = `
      <div class="installed-info">
        <div class="installed-name">${escapeHtml(m.name)}</div>
        <div class="installed-details">${sizeStr} • ${quant} • ${param}</div>
      </div>
      <div class="installed-actions">
        <button class="btn btn-sm btn-subtle btn-select-chat" title="Выбрать для чата" data-model="${escapeHtml(m.name)}">
          Тест
        </button>
        <button class="btn btn-sm btn-danger btn-delete-model" title="Удалить с диска" data-model="${escapeHtml(m.name)}">
          Удалить
        </button>
      </div>
    `;

    // Chat select button
    item.querySelector('.btn-select-chat').addEventListener('click', () => {
      elements.chatModelSelect.value = m.name;
      elements.chatInput.focus();
    });

    // Delete button
    item.querySelector('.btn-delete-model').addEventListener('click', async () => {
      if (confirm(`Удалить модель ${m.name} с диска?`)) {
        await deleteModel(m.name);
      }
    });

    container.appendChild(item);
  }
}

async function deleteModel(modelName) {
  try {
    const res = await fetch('/api/models/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName })
    });
    if (res.ok) {
      await loadInstalledModels();
      renderModelsGrid();
    }
  } catch (err) {
    console.error('Delete error:', err);
  }
}

function populateChatModelSelect() {
  const select = elements.chatModelSelect;
  const currentVal = select.value;
  select.innerHTML = '';

  if (state.installedModels.length === 0) {
    const opt = document.createElement('option');
    opt.value = 'llama3.2:1b';
    opt.textContent = 'llama3.2:1b (демо)';
    select.appendChild(opt);
    return;
  }

  for (const m of state.installedModels) {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = m.name;
    select.appendChild(opt);
  }

  if (currentVal && state.installedModels.some(m => m.name === currentVal)) {
    select.value = currentVal;
  }
}

// ============================================================================
// PLAYGROUND & STREAMING CHAT
// ============================================================================

async function sendChatMessage() {
  const text = elements.chatInput.value.trim();
  if (!text || state.isGenerating) return;

  const model = elements.chatModelSelect.value || 'llama3.2:1b';
  elements.chatInput.value = '';

  // Append user message
  appendMessage('user', text);

  // Append assistant message skeleton
  const assistantBubble = appendMessage('assistant', '');
  state.isGenerating = true;
  elements.chatSendBtn.disabled = true;

  const startTime = Date.now();
  let tokenCount = 0;
  let fullResponse = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep partial chunk

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.response) {
              fullResponse += data.response;
              tokenCount++;
              assistantBubble.innerHTML = formatMarkdown(fullResponse);
              elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

              // Calculate live Tokens Per Second
              const elapsedSec = (Date.now() - startTime) / 1000;
              if (elapsedSec > 0.3) {
                const tps = Math.round((tokenCount / elapsedSec) * 10) / 10;
                elements.tpsBadge.textContent = `⚡ ${tps} t/s`;
              }
            }
          } catch (e) {
            // ignore partial json
          }
        }
      }
    }
  } catch (err) {
    assistantBubble.innerHTML = `<span style="color: #fb7185">Ошибка генерации: ${err.message}</span>`;
  } finally {
    state.isGenerating = false;
    elements.chatSendBtn.disabled = false;
    elements.chatInput.focus();
  }
}

function appendMessage(role, text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? 'YOU' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMarkdown(text);

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  elements.chatMessages.appendChild(msgDiv);

  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  return bubble;
}

// Simple Markdown Formatter (Bold, Code, Code Blocks)
function formatMarkdown(text) {
  if (!text) return '';
  let out = escapeHtml(text);

  // Fenced Code Blocks ```lang ... ```
  out = out.replace(/```([\s\S]*?)```/g, (match, p1) => {
    return `<pre><code>${p1.trim()}</code></pre>`;
  });

  // Inline Code `code`
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italics _italic_
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Line breaks
  out = out.replace(/\n/g, '<br>');

  return out;
}

// ============================================================================
// EVENT LISTENERS & SETUP
// ============================================================================

function initEventListeners() {
  // Category tabs
  elements.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeCategory = tab.dataset.category;
      renderModelsGrid();
    });
  });

  // Custom model pull
  elements.customPullBtn.addEventListener('click', () => {
    const val = elements.customModelInput.value.trim();
    if (val) {
      pullModel(val);
      elements.customModelInput.value = '';
    }
  });

  elements.customModelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      elements.customPullBtn.click();
    }
  });

  // Master chart toggle
  elements.toggleDetailedChartBtn.addEventListener('click', () => {
    const isHidden = elements.masterChartSection.classList.toggle('hidden');
    elements.toggleDetailedChartBtn.classList.toggle('active', !isHidden);
    if (!isHidden) {
      renderMiniCharts();
    }
  });

  elements.clearChartHistoryBtn.addEventListener('click', () => {
    state.masterCpuHistory = Array(60).fill(0);
    state.masterRamHistory = Array(60).fill(0);
    renderMiniCharts();
  });

  // Refresh installed button
  elements.refreshInstalledBtn.addEventListener('click', () => {
    loadInstalledModels();
  });

  // Chat input
  elements.chatSendBtn.addEventListener('click', sendChatMessage);
  elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Setup Modal
  const openModal = () => elements.setupModal.classList.remove('hidden');
  const closeModal = () => elements.setupModal.classList.add('hidden');

  elements.ollamaStatusBtn.addEventListener('click', openModal);
  elements.openSetupModalBtn.addEventListener('click', openModal);
  elements.closeSetupModalBtn.addEventListener('click', closeModal);
  elements.modalOkBtn.addEventListener('click', closeModal);
  elements.setupModal.addEventListener('click', (e) => {
    if (e.target === elements.setupModal) closeModal();
  });

  // Copy code buttons in modal
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.dataset.copy;
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        const orig = btn.textContent;
        btn.textContent = 'Скопировано! ✓';
        setTimeout(() => btn.textContent = orig, 1800);
      }
    });
  });

  // Window resize for canvas crispness
  window.addEventListener('resize', () => {
    renderMiniCharts();
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / (1024 ** i)).toFixed(1)} ${units[i]}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadSystemSpecs();
  loadModelCatalog();
  loadInstalledModels();
  connectTelemetry();
  renderMiniCharts();
});
