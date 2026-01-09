// NEAT Evolution Dashboard - Client-Side Logic

console.log('[Dashboard] Script loaded');

// ============================================================================
// STATE
// ============================================================================

const state = {
  config: null,
  generations: [],
  globalBest: null,
  startTime: Date.now(),
  isComplete: false,
  workerCount: 0,
  activeWorkers: 0,
  evalProgress: {
    current: 0,
    total: 0,
    generation: 0,
    genStartTime: Date.now(),  // When current generation started
    lastUpdateTime: Date.now(),
    evalTimings: [],           // Array of individual eval times for averaging
  },
};

// ============================================================================
// CHARTS
// ============================================================================

let fitnessChart = null;
let speciesChart = null;
let complexityChart = null;

const chartColors = {
  green: 'rgb(16, 185, 129)',
  blue: 'rgb(59, 130, 246)',
  yellow: 'rgb(245, 158, 11)',
  purple: 'rgb(139, 92, 246)',
  red: 'rgb(239, 68, 68)',
  greenAlpha: 'rgba(16, 185, 129, 0.2)',
  blueAlpha: 'rgba(59, 130, 246, 0.2)',
};

const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  animation: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#a0a0a0',
        font: { size: 11 },
        padding: 15,
      },
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: '#6b7280', font: { size: 10 } },
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: '#6b7280', font: { size: 10 } },
    },
  },
};

function initCharts() {
  // Fitness Chart
  const fitnessCtx = document.getElementById('fitness-chart').getContext('2d');
  fitnessChart = new Chart(fitnessCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Best Fitness',
          data: [],
          borderColor: chartColors.green,
          backgroundColor: chartColors.greenAlpha,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'Avg Fitness',
          data: [],
          borderColor: chartColors.blue,
          backgroundColor: chartColors.blueAlpha,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      ...defaultChartOptions,
      scales: {
        ...defaultChartOptions.scales,
        y: {
          ...defaultChartOptions.scales.y,
          beginAtZero: true,
        },
      },
    },
  });

  // Species Chart
  const speciesCtx = document.getElementById('species-chart').getContext('2d');
  speciesChart = new Chart(speciesCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Species Count',
          data: [],
          borderColor: chartColors.purple,
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      ...defaultChartOptions,
      scales: {
        ...defaultChartOptions.scales,
        y: {
          ...defaultChartOptions.scales.y,
          beginAtZero: true,
          ticks: {
            ...defaultChartOptions.scales.y.ticks,
            stepSize: 1,
          },
        },
      },
    },
  });

  // Complexity Chart
  const complexityCtx = document.getElementById('complexity-chart').getContext('2d');
  complexityChart = new Chart(complexityCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Avg Nodes',
          data: [],
          borderColor: chartColors.yellow,
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y',
        },
        {
          label: 'Avg Connections',
          data: [],
          borderColor: chartColors.red,
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      ...defaultChartOptions,
      scales: {
        x: defaultChartOptions.scales.x,
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: chartColors.yellow, font: { size: 10 } },
          beginAtZero: true,
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: chartColors.red, font: { size: 10 } },
          beginAtZero: true,
        },
      },
    },
  });
}

function updateCharts() {
  const labels = state.generations.map(g => g.generation);
  const bestFitness = state.generations.map(g => g.bestFitness);
  const avgFitness = state.generations.map(g => g.avgFitness);
  const speciesCounts = state.generations.map(g => g.speciesCount);
  const avgNodes = state.generations.map(g => g.avgNodes);
  const avgConnections = state.generations.map(g => g.avgConnections);

  // Limit to last 200 data points for performance
  const maxPoints = 200;
  const startIdx = Math.max(0, labels.length - maxPoints);

  fitnessChart.data.labels = labels.slice(startIdx);
  fitnessChart.data.datasets[0].data = bestFitness.slice(startIdx);
  fitnessChart.data.datasets[1].data = avgFitness.slice(startIdx);
  fitnessChart.update('none');

  speciesChart.data.labels = labels.slice(startIdx);
  speciesChart.data.datasets[0].data = speciesCounts.slice(startIdx);
  speciesChart.update('none');

  complexityChart.data.labels = labels.slice(startIdx);
  complexityChart.data.datasets[0].data = avgNodes.slice(startIdx);
  complexityChart.data.datasets[1].data = avgConnections.slice(startIdx);
  complexityChart.update('none');
}

// ============================================================================
// UI UPDATES
// ============================================================================

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function updateProgress() {
  if (!state.config) return;

  const currentGen = state.generations.length > 0
    ? state.generations[state.generations.length - 1].generation
    : 0;
  const totalGens = state.config.generations;
  const percent = totalGens > 0 ? (currentGen / totalGens) * 100 : 0;

  document.getElementById('generation-display').textContent = `Gen ${currentGen}/${totalGens}`;
  document.getElementById('progress-percent').textContent = `(${percent.toFixed(1)}%)`;
  document.getElementById('progress-bar').style.width = `${percent}%`;
  document.getElementById('progress-label').textContent = `Generation ${currentGen} of ${totalGens}`;
}

function updateStats(stats) {
  document.getElementById('stat-best-fitness').textContent = stats.bestFitness.toFixed(1);
  document.getElementById('stat-avg-fitness').textContent = stats.avgFitness.toFixed(1);
  document.getElementById('stat-species').textContent = stats.speciesCount;
  document.getElementById('stat-nodes').textContent = stats.avgNodes.toFixed(1);
  document.getElementById('stat-connections').textContent = stats.avgConnections.toFixed(1);
  document.getElementById('stat-eval-time').textContent = `${(stats.evalTimeMs / 1000).toFixed(1)}s`;

  // Calculate averages and ETA
  const avgTimeMs = state.generations.reduce((sum, g) => sum + g.evalTimeMs, 0) / state.generations.length;
  document.getElementById('stat-avg-time').textContent = `${(avgTimeMs / 1000).toFixed(1)}s`;

  const elapsed = Date.now() - state.startTime;
  document.getElementById('stat-elapsed').textContent = formatTime(elapsed);

  if (state.config) {
    const remainingGens = state.config.generations - stats.generation;
    const eta = remainingGens * avgTimeMs;
    document.getElementById('stat-eta').textContent = formatTime(eta);
  }
}

function updateGlobalBest(best) {
  document.getElementById('stat-global-fitness').textContent = best.fitness.toFixed(1);
  document.getElementById('stat-global-gen').textContent = best.generation;
}

/**
 * Update workers with detailed status (new format with worker cards)
 * @param {Object} data - Worker status data with workers array and summary
 */
function updateWorkersDetailed(data) {
  const grid = document.getElementById('worker-grid');
  grid.innerHTML = '';
  grid.className = 'worker-cards';

  for (const worker of data.workers) {
    const card = document.createElement('div');
    card.className = `worker-card ${worker.busy ? 'active' : 'idle'}`;

    const durationStr = worker.durationMs
      ? `${(worker.durationMs / 1000).toFixed(1)}s`
      : '-';
    const avgStr = worker.avgTimeMs > 0
      ? `${(worker.avgTimeMs / 1000).toFixed(1)}s`
      : '-';

    card.innerHTML = `
      <div class="header">
        <div class="spinner"></div>
        <div class="status-dot"></div>
        <span>Worker ${worker.id}</span>
      </div>
      <div class="details">
        ${worker.busy ? `
          <div>Job: <span class="job-id">#${worker.jobId}</span></div>
          <div>Duration: <span class="duration">${durationStr}</span></div>
        ` : '<div class="idle-text">Idle</div>'}
      </div>
      <div class="stats">
        ${worker.jobsCompleted} jobs · avg ${avgStr}
      </div>
    `;

    grid.appendChild(card);
  }

  document.getElementById('worker-summary').textContent =
    `${data.summary.active} active / ${data.summary.total} total`;
}

/**
 * Legacy update workers (simple count + active)
 * Used when only count is provided (e.g., init without detailed status)
 */
function updateWorkersSimple(count, active = 0) {
  const grid = document.getElementById('worker-grid');
  grid.innerHTML = '';
  grid.className = 'worker-grid';

  for (let i = 0; i < count; i++) {
    const indicator = document.createElement('div');
    indicator.className = `worker-indicator ${i < active ? 'active' : ''}`;
    grid.appendChild(indicator);
  }

  document.getElementById('worker-summary').textContent = `${active} active / ${count} total`;
}

/**
 * Update workers - handles both legacy and new format
 */
function updateWorkers(dataOrCount, active = 0) {
  // Check if this is the new detailed format
  if (typeof dataOrCount === 'object' && dataOrCount.workers) {
    updateWorkersDetailed(dataOrCount);
  } else {
    // Legacy format: just count and active
    updateWorkersSimple(dataOrCount, active);
  }
}

function updateEvalProgress(data) {
  const now = Date.now();
  const prevCurrent = state.evalProgress.current;
  const prevGeneration = state.evalProgress.generation;

  // Detect new generation start
  if (data.generation !== prevGeneration || data.current === 1) {
    state.evalProgress.genStartTime = now;
    state.evalProgress.evalTimings = [];
  }

  // Track timing for this eval
  if (data.current > prevCurrent && prevCurrent > 0) {
    const timeSinceLastUpdate = now - state.evalProgress.lastUpdateTime;
    state.evalProgress.evalTimings.push(timeSinceLastUpdate);
  }

  state.evalProgress.current = data.current;
  state.evalProgress.total = data.total;
  state.evalProgress.generation = data.generation;
  state.evalProgress.lastUpdateTime = now;

  // Calculate ETA for current generation
  let genEtaStr = '';
  if (state.evalProgress.evalTimings.length > 0) {
    const avgEvalTime = state.evalProgress.evalTimings.reduce((a, b) => a + b, 0) / state.evalProgress.evalTimings.length;
    const remaining = data.total - data.current;
    const genEtaMs = remaining * avgEvalTime;
    genEtaStr = ` | ETA: ${formatTime(genEtaMs)}`;
  }

  const percent = data.total > 0 ? (data.current / data.total) * 100 : 0;
  document.getElementById('eval-progress-bar').style.width = `${percent}%`;
  document.getElementById('eval-progress-label').textContent =
    `Gen ${data.generation}: Evaluating genome ${data.current}/${data.total} (${percent.toFixed(0)}%)${genEtaStr}`;
}

function resetEvalProgress() {
  state.evalProgress = {
    current: 0,
    total: 0,
    generation: 0,
    genStartTime: Date.now(),
    lastUpdateTime: Date.now(),
    evalTimings: [],
  };
  document.getElementById('eval-progress-bar').style.width = '0%';
  document.getElementById('eval-progress-label').textContent = 'Waiting for next generation...';
}

function showCompletion(data) {
  document.getElementById('completion-fitness').textContent = data.finalBestFitness.toFixed(1);
  document.getElementById('completion-generations').textContent = data.totalGenerations;
  document.getElementById('completion-time').textContent = formatTime(data.totalTimeMs);
  document.getElementById('completion-overlay').classList.add('visible');
}

function setConnectionStatus(connected) {
  const statusEl = document.getElementById('connection-status');
  if (connected) {
    statusEl.textContent = 'Connected';
    statusEl.className = 'status-indicator status-connected';
  } else {
    statusEl.textContent = 'Disconnected';
    statusEl.className = 'status-indicator status-disconnected';
  }
}

// ============================================================================
// SSE CONNECTION
// ============================================================================

function connectSSE() {
  console.log('[Dashboard] Connecting to SSE...');
  const eventSource = new EventSource('/events');

  eventSource.onopen = () => {
    console.log('[Dashboard] SSE connected');
    setConnectionStatus(true);
  };

  eventSource.onerror = (err) => {
    console.error('[Dashboard] SSE error:', err);
    setConnectionStatus(false);

    // Reconnect after 2 seconds
    setTimeout(() => {
      console.log('[Dashboard] Reconnecting...');
      eventSource.close();
      connectSSE();
    }, 2000);
  };

  // Generic message handler to catch all events
  eventSource.onmessage = (event) => {
    console.log('[Dashboard] Generic message:', event.data);
  };

  // Init event - sent on connection with full history
  eventSource.addEventListener('init', (event) => {
    console.log('[Dashboard] Received init event');
    const data = JSON.parse(event.data);
    console.log('[Dashboard] Init data:', data);

    if (data.config) {
      state.config = data.config;
      updateWorkers(data.config.workerCount || 8);
    }
    if (data.generations) {
      state.generations = data.generations;
      updateCharts();
      updateProgress();
      if (data.generations.length > 0) {
        updateStats(data.generations[data.generations.length - 1]);
      }
    }
    if (data.globalBest) {
      state.globalBest = data.globalBest;
      updateGlobalBest(data.globalBest);
    }
    if (data.startTime) {
      state.startTime = data.startTime;
    }
    if (data.isComplete) {
      // Show completion overlay if training already finished
      const lastGen = state.generations[state.generations.length - 1];
      if (lastGen && state.globalBest) {
        showCompletion({
          totalGenerations: lastGen.generation,
          finalBestFitness: state.globalBest.fitness,
          totalTimeMs: Date.now() - state.startTime,
        });
      }
    }
  });

  // Config event
  eventSource.addEventListener('config', (event) => {
    const data = JSON.parse(event.data);
    console.log('Received config:', data);
    state.config = data;
    state.startTime = Date.now();
    updateWorkers(data.workerCount || 8);
    updateProgress();
  });

  // Generation event
  eventSource.addEventListener('generation', (event) => {
    const data = JSON.parse(event.data);
    console.log('Received generation:', data.generation);
    state.generations.push(data);
    updateCharts();
    updateProgress();
    updateStats(data);
    // Reset eval progress when generation completes
    resetEvalProgress();
  });

  // Evaluation progress event (genome-by-genome updates)
  eventSource.addEventListener('evalProgress', (event) => {
    const data = JSON.parse(event.data);
    updateEvalProgress(data);
  });

  // New best event
  eventSource.addEventListener('newBest', (event) => {
    const data = JSON.parse(event.data);
    console.log('Received newBest:', data);
    state.globalBest = data;
    updateGlobalBest(data);

    // Flash the best fitness value
    const el = document.getElementById('stat-global-fitness');
    el.classList.add('updating');
    setTimeout(() => el.classList.remove('updating'), 300);
  });

  // Worker status event (detailed format with per-worker info)
  eventSource.addEventListener('workerStatus', (event) => {
    const data = JSON.parse(event.data);
    // Pass full data object - updateWorkers handles both old and new formats
    updateWorkers(data);
  });

  // Complete event
  eventSource.addEventListener('complete', (event) => {
    const data = JSON.parse(event.data);
    console.log('Received complete:', data);
    state.isComplete = true;
    showCompletion(data);
  });

  // Shutdown event
  eventSource.addEventListener('shutdown', (event) => {
    console.log('Server shutting down');
    setConnectionStatus(false);
    eventSource.close();
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Dashboard] DOM loaded, initializing...');
  try {
    initCharts();
    console.log('[Dashboard] Charts initialized');
  } catch (err) {
    console.error('[Dashboard] Chart init error:', err);
  }
  updateWorkers(8); // Default, will be updated when config arrives
  console.log('[Dashboard] Workers initialized');
  connectSSE();
});
