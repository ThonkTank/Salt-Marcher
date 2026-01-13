// NEAT Evolution Dashboard - Client-Side Logic

console.log('[Dashboard] Script loaded');

// ============================================================================
// DOM ELEMENT IDS
// ============================================================================

const DOM = {
  // Header
  GENERATION_DISPLAY: 'generation-display',
  PROGRESS_PERCENT: 'progress-percent',
  CONNECTION_STATUS: 'connection-status',

  // Progress Bars
  PROGRESS_BAR: 'progress-bar',
  PROGRESS_LABEL: 'progress-label',
  EVAL_PROGRESS_BAR: 'eval-progress-bar',
  EVAL_PROGRESS_LABEL: 'eval-progress-label',

  // Stats - Current
  STAT_BEST_FITNESS: 'stat-best-fitness',
  STAT_AVG_FITNESS: 'stat-avg-fitness',
  STAT_SPECIES: 'stat-species',
  STAT_NODES: 'stat-nodes',
  STAT_CONNECTIONS: 'stat-connections',
  STAT_EVAL_TIME: 'stat-eval-time',

  // Stats - Combat (Best Tab)
  STAT_BEST_HIT_RATE: 'stat-best-hit-rate',
  STAT_BEST_KILLS: 'stat-best-kills',
  STAT_BEST_DEATHS: 'stat-best-deaths',
  STAT_BEST_HP_LOST: 'stat-best-hp-lost',
  STAT_BEST_WINS: 'stat-best-wins',
  STAT_BEST_LOSSES: 'stat-best-losses',

  // Stats - Combat (Last Tab)
  STAT_LAST_FITNESS: 'stat-last-fitness',
  STAT_LAST_HIT_RATE: 'stat-last-hit-rate',
  STAT_LAST_KILLS: 'stat-last-kills',
  STAT_LAST_DEATHS: 'stat-last-deaths',
  STAT_LAST_HP_LOST: 'stat-last-hp-lost',
  STAT_LAST_WLD: 'stat-last-wld',

  // Stats - Global
  STAT_GLOBAL_FITNESS: 'stat-global-fitness',
  STAT_GLOBAL_GEN: 'stat-global-gen',

  // Stats - Performance
  STAT_AVG_TIME: 'stat-avg-time',
  STAT_ELAPSED: 'stat-elapsed',
  STAT_ETA: 'stat-eta',

  // Workers
  WORKER_GRID: 'worker-grid',
  WORKER_SUMMARY: 'worker-summary',

  // Completion
  COMPLETION_OVERLAY: 'completion-overlay',
  COMPLETION_FITNESS: 'completion-fitness',
  COMPLETION_GENERATIONS: 'completion-generations',
  COMPLETION_TIME: 'completion-time',

  // Charts
  FITNESS_CHART: 'fitness-chart',
  SPECIES_CHART: 'species-chart',
  COMPLEXITY_CHART: 'complexity-chart',
};

/** Cached DOM elements - populated on init */
const elements = {};

function cacheElements() {
  for (const [key, id] of Object.entries(DOM)) {
    elements[key] = document.getElementById(id);
  }
}

// ============================================================================
// STATE - Logically Grouped
// ============================================================================

/** Persistent data (server-synchronized) */
const appState = {
  config: null,           // TrainingConfig from server
  generations: [],        // All GenerationStats
  globalBest: null,       // GlobalBest genome
};

/** Session metadata */
const sessionState = {
  startTime: Date.now(),
  isComplete: false,
  workerCount: 0,
  activeWorkers: 0,
};

/** Evaluation tracking (transient, reset each generation) */
const evalState = {
  current: 0,
  total: 0,
  generation: 0,
  genStartTime: Date.now(),
  lastUpdateTime: Date.now(),
  evalTimings: [],        // For ETA calculation
};

/** Running stats during evaluation */
const runningStats = {
  fitnesses: [],
  bestFitness: 0,
  avgFitness: 0,
  nodeCounts: [],
  connectionCounts: [],
  speciesIds: new Set(),
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
  const fitnessCtx = elements.FITNESS_CHART.getContext('2d');
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
  const speciesCtx = elements.SPECIES_CHART.getContext('2d');
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
  const complexityCtx = elements.COMPLEXITY_CHART.getContext('2d');
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
  const labels = appState.generations.map(g => g.generation);
  const bestFitness = appState.generations.map(g => g.bestFitness);
  const avgFitness = appState.generations.map(g => g.avgFitness);
  const speciesCounts = appState.generations.map(g => g.speciesCount);
  const avgNodes = appState.generations.map(g => g.avgNodes);
  const avgConnections = appState.generations.map(g => g.avgConnections);

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
// UTILITIES
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

// ============================================================================
// UI UPDATES - Progress
// ============================================================================

function updateGenerationProgress() {
  if (!appState.config) return;

  const currentGen = appState.generations.length > 0
    ? appState.generations[appState.generations.length - 1].generation
    : 0;
  const totalGens = appState.config.generations;
  const percent = totalGens > 0 ? (currentGen / totalGens) * 100 : 0;

  elements.GENERATION_DISPLAY.textContent = `Gen ${currentGen}/${totalGens}`;
  elements.PROGRESS_PERCENT.textContent = `(${percent.toFixed(1)}%)`;
  elements.PROGRESS_BAR.style.width = `${percent}%`;
  elements.PROGRESS_LABEL.textContent = `Generation ${currentGen} of ${totalGens}`;
}

function updateEvalProgress(data) {
  const now = Date.now();
  const prevCurrent = evalState.current;
  const prevGeneration = evalState.generation;

  // Detect new generation start - reset running stats
  if (data.generation !== prevGeneration || data.current === 1) {
    evalState.genStartTime = now;
    evalState.evalTimings = [];
    resetRunningStats();
  }

  // Track timing for this eval
  if (data.current > prevCurrent && prevCurrent > 0) {
    const timeSinceLastUpdate = now - evalState.lastUpdateTime;
    evalState.evalTimings.push(timeSinceLastUpdate);
  }

  evalState.current = data.current;
  evalState.total = data.total;
  evalState.generation = data.generation;
  evalState.lastUpdateTime = now;

  // Track fitness for running statistics
  if (data.fitness !== undefined) {
    runningStats.fitnesses.push(data.fitness);
    runningStats.bestFitness = Math.max(runningStats.bestFitness, data.fitness);
    runningStats.avgFitness =
      runningStats.fitnesses.reduce((a, b) => a + b, 0) /
      runningStats.fitnesses.length;
  }

  // Track node/connection counts
  if (data.nodeCount !== undefined) {
    runningStats.nodeCounts.push(data.nodeCount);
  }
  if (data.connectionCount !== undefined) {
    runningStats.connectionCounts.push(data.connectionCount);
  }
  if (data.speciesId !== undefined && data.speciesId > 0) {
    runningStats.speciesIds.add(data.speciesId);
  }

  // Update running stats in UI
  updateRunningStatsUI();

  // Update "Last" tab with current genome's combat stats
  updateCombatStatsLast(data);

  // Calculate ETA for current generation
  let genEtaStr = '';
  if (evalState.evalTimings.length > 0) {
    const avgEvalTime = evalState.evalTimings.reduce((a, b) => a + b, 0) / evalState.evalTimings.length;
    const remaining = data.total - data.current;
    const genEtaMs = remaining * avgEvalTime;
    genEtaStr = ` | ETA: ${formatTime(genEtaMs)}`;
  }

  const percent = data.total > 0 ? (data.current / data.total) * 100 : 0;
  elements.EVAL_PROGRESS_BAR.style.width = `${percent}%`;
  elements.EVAL_PROGRESS_LABEL.textContent =
    `Gen ${data.generation}: Evaluating genome ${data.current}/${data.total} (${percent.toFixed(0)}%)${genEtaStr}`;
}

function resetEvalProgress() {
  evalState.current = 0;
  evalState.total = 0;
  evalState.generation = 0;
  evalState.genStartTime = Date.now();
  evalState.lastUpdateTime = Date.now();
  evalState.evalTimings = [];
  resetRunningStats();
  elements.EVAL_PROGRESS_BAR.style.width = '0%';
  elements.EVAL_PROGRESS_LABEL.textContent = 'Waiting for next generation...';
}

// ============================================================================
// UI UPDATES - Stats
// ============================================================================

function updateCurrentStats(stats) {
  elements.STAT_BEST_FITNESS.textContent = stats.bestFitness.toFixed(1);
  elements.STAT_AVG_FITNESS.textContent = stats.avgFitness.toFixed(1);
  elements.STAT_SPECIES.textContent = stats.speciesCount;
  elements.STAT_NODES.textContent = stats.avgNodes.toFixed(1);
  elements.STAT_CONNECTIONS.textContent = stats.avgConnections.toFixed(1);
  elements.STAT_EVAL_TIME.textContent = `${(stats.evalTimeMs / 1000).toFixed(1)}s`;

  // Combat Statistics - "Best" Tab
  if (stats.bestGenomeStats) {
    updateCombatStatsBest(stats.bestGenomeStats);
  }

  // Calculate averages and ETA
  updatePerformanceStats(stats);
}

function updateCombatStatsBest(bs) {
  elements.STAT_BEST_HIT_RATE.textContent = `${(bs.hitRate * 100).toFixed(1)}%`;
  elements.STAT_BEST_KILLS.textContent = bs.totalKills;
  elements.STAT_BEST_DEATHS.textContent = bs.totalDeaths;
  elements.STAT_BEST_HP_LOST.textContent = `${(bs.avgHPLostPercent * 100).toFixed(1)}%`;
  elements.STAT_BEST_WINS.textContent = bs.wins;
  elements.STAT_BEST_LOSSES.textContent = bs.losses;
}

function updateCombatStatsLast(data) {
  if (data.fitness !== undefined) {
    elements.STAT_LAST_FITNESS.textContent = data.fitness.toFixed(1);
  }
  if (data.hitRate !== undefined) {
    elements.STAT_LAST_HIT_RATE.textContent = `${(data.hitRate * 100).toFixed(1)}%`;
  }
  if (data.kills !== undefined) {
    elements.STAT_LAST_KILLS.textContent = data.kills;
  }
  if (data.deaths !== undefined) {
    elements.STAT_LAST_DEATHS.textContent = data.deaths;
  }
  if (data.hpLost !== undefined) {
    elements.STAT_LAST_HP_LOST.textContent = `${(data.hpLost * 100).toFixed(1)}%`;
  }
  if (data.wins !== undefined && data.losses !== undefined && data.draws !== undefined) {
    elements.STAT_LAST_WLD.textContent = `${data.wins}/${data.losses}/${data.draws}`;
  }
}

function updateGlobalBest(best) {
  elements.STAT_GLOBAL_FITNESS.textContent = best.fitness.toFixed(1);
  elements.STAT_GLOBAL_GEN.textContent = best.generation;
}

function updatePerformanceStats(stats) {
  const avgTimeMs = appState.generations.reduce((sum, g) => sum + g.evalTimeMs, 0) / appState.generations.length;
  elements.STAT_AVG_TIME.textContent = `${(avgTimeMs / 1000).toFixed(1)}s`;

  const elapsed = Date.now() - sessionState.startTime;
  elements.STAT_ELAPSED.textContent = formatTime(elapsed);

  if (appState.config) {
    const remainingGens = appState.config.generations - stats.generation;
    const eta = remainingGens * avgTimeMs;
    elements.STAT_ETA.textContent = formatTime(eta);
  }
}

function resetRunningStats() {
  runningStats.fitnesses = [];
  runningStats.bestFitness = 0;
  runningStats.avgFitness = 0;
  runningStats.nodeCounts = [];
  runningStats.connectionCounts = [];
  runningStats.speciesIds = new Set();
}

function updateRunningStatsUI() {
  // Update Current Statistics with running values
  elements.STAT_BEST_FITNESS.textContent =
    runningStats.bestFitness > 0 ? runningStats.bestFitness.toFixed(1) : '-';
  elements.STAT_AVG_FITNESS.textContent =
    runningStats.avgFitness > 0 ? runningStats.avgFitness.toFixed(1) : '-';

  // Species: count unique species IDs from evaluated genomes
  elements.STAT_SPECIES.textContent =
    runningStats.speciesIds.size > 0 ? runningStats.speciesIds.size : '-';

  // Avg Nodes: running average from evaluated genomes
  const avgNodes = runningStats.nodeCounts.length > 0
    ? runningStats.nodeCounts.reduce((a, b) => a + b, 0) / runningStats.nodeCounts.length
    : 0;
  elements.STAT_NODES.textContent = avgNodes > 0 ? avgNodes.toFixed(1) : '-';

  // Avg Connections: running average from evaluated genomes
  const avgConnections = runningStats.connectionCounts.length > 0
    ? runningStats.connectionCounts.reduce((a, b) => a + b, 0) / runningStats.connectionCounts.length
    : 0;
  elements.STAT_CONNECTIONS.textContent = avgConnections > 0 ? avgConnections.toFixed(1) : '-';

  // Eval time: show elapsed time for current generation
  const genElapsed = Date.now() - evalState.genStartTime;
  elements.STAT_EVAL_TIME.textContent = formatTime(genElapsed);

  // Update elapsed time
  const totalElapsed = Date.now() - sessionState.startTime;
  elements.STAT_ELAPSED.textContent = formatTime(totalElapsed);

  // Update ETA based on current eval progress
  if (appState.config && evalState.evalTimings.length > 0) {
    const avgEvalTime = evalState.evalTimings.reduce((a, b) => a + b, 0) / evalState.evalTimings.length;
    const remainingGenomes = evalState.total - evalState.current;
    const currentGenEta = remainingGenomes * avgEvalTime;

    const estimatedGenTime = evalState.current > 0 && evalState.total > 0
      ? (genElapsed / evalState.current) * evalState.total
      : genElapsed + currentGenEta;

    const avgGenTime = appState.generations.length > 0
      ? appState.generations.reduce((sum, g) => sum + g.evalTimeMs, 0) / appState.generations.length
      : estimatedGenTime;
    const remainingGens = appState.config.generations - (appState.generations.length + 1);
    const totalEta = currentGenEta + (remainingGens > 0 ? remainingGens * avgGenTime : 0);

    elements.STAT_ETA.textContent = formatTime(totalEta);
  }

  // All-Time Best: show max of global best and current running best
  const globalBestFitness = appState.globalBest?.fitness ?? 0;
  const effectiveBest = Math.max(globalBestFitness, runningStats.bestFitness);
  elements.STAT_GLOBAL_FITNESS.textContent = effectiveBest > 0 ? effectiveBest.toFixed(1) : '-';

  // Flash if we found a new potential best
  if (runningStats.bestFitness > globalBestFitness && globalBestFitness > 0) {
    elements.STAT_GLOBAL_FITNESS.classList.add('updating');
    setTimeout(() => elements.STAT_GLOBAL_FITNESS.classList.remove('updating'), 300);
  }
}

// ============================================================================
// UI UPDATES - Workers
// ============================================================================

const WorkerPanel = {
  mode: 'dots',  // 'dots' | 'cards'

  update(dataOrCount, active = 0) {
    if (typeof dataOrCount === 'object' && dataOrCount.workers) {
      this.mode = 'cards';
      this.renderCards(dataOrCount);
    } else {
      this.mode = 'dots';
      this.renderDots(dataOrCount, active);
    }
  },

  renderCards(data) {
    const grid = elements.WORKER_GRID;
    grid.innerHTML = '';
    grid.className = 'worker-grid worker-grid--cards';

    for (const worker of data.workers) {
      grid.appendChild(this.createCard(worker));
    }

    elements.WORKER_SUMMARY.textContent =
      `${data.summary.active} active / ${data.summary.total} total`;
  },

  renderDots(count, active) {
    const grid = elements.WORKER_GRID;
    grid.innerHTML = '';
    grid.className = 'worker-grid';

    for (let i = 0; i < count; i++) {
      const indicator = document.createElement('div');
      indicator.className = `worker-indicator ${i < active ? 'active' : ''}`;
      grid.appendChild(indicator);
    }

    elements.WORKER_SUMMARY.textContent = `${active} active / ${count} total`;
  },

  createCard(worker) {
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

    return card;
  },
};

// ============================================================================
// UI UPDATES - Misc
// ============================================================================

function setConnectionStatus(connected) {
  if (connected) {
    elements.CONNECTION_STATUS.textContent = 'Connected';
    elements.CONNECTION_STATUS.className = 'status-indicator status-connected';
  } else {
    elements.CONNECTION_STATUS.textContent = 'Disconnected';
    elements.CONNECTION_STATUS.className = 'status-indicator status-disconnected';
  }
}

function showCompletionOverlay(data) {
  elements.COMPLETION_FITNESS.textContent = data.finalBestFitness.toFixed(1);
  elements.COMPLETION_GENERATIONS.textContent = data.totalGenerations;
  elements.COMPLETION_TIME.textContent = formatTime(data.totalTimeMs);
  elements.COMPLETION_OVERLAY.classList.add('visible');
}

// ============================================================================
// SSE EVENT HANDLERS - With Error Handling
// ============================================================================

function handleSSEEvent(eventName, handler) {
  return (event) => {
    try {
      const data = JSON.parse(event.data);
      handler(data);
    } catch (err) {
      console.error(`[Dashboard] Error parsing ${eventName}:`, err);
    }
  };
}

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
  eventSource.addEventListener('init', handleSSEEvent('init', (data) => {
    console.log('[Dashboard] Init data:', data);

    if (data.config) {
      appState.config = data.config;
      WorkerPanel.update(data.config.workerCount || 8);
    }
    if (data.generations) {
      appState.generations = data.generations;
      updateCharts();
      updateGenerationProgress();
      if (data.generations.length > 0) {
        updateCurrentStats(data.generations[data.generations.length - 1]);
      }
    }
    if (data.globalBest) {
      appState.globalBest = data.globalBest;
      updateGlobalBest(data.globalBest);
    }
    if (data.startTime) {
      sessionState.startTime = data.startTime;
    }
    if (data.isComplete) {
      const lastGen = appState.generations[appState.generations.length - 1];
      if (lastGen && appState.globalBest) {
        showCompletionOverlay({
          totalGenerations: lastGen.generation,
          finalBestFitness: appState.globalBest.fitness,
          totalTimeMs: Date.now() - sessionState.startTime,
        });
      }
    }
  }));

  // Config event
  eventSource.addEventListener('config', handleSSEEvent('config', (data) => {
    console.log('Received config:', data);
    appState.config = data;
    sessionState.startTime = Date.now();
    WorkerPanel.update(data.workerCount || 8);
    updateGenerationProgress();
  }));

  // Generation event
  eventSource.addEventListener('generation', handleSSEEvent('generation', (data) => {
    console.log('Received generation:', data.generation);
    appState.generations.push(data);
    updateCharts();
    updateGenerationProgress();
    updateCurrentStats(data);
    resetEvalProgress();
  }));

  // Evaluation progress event
  eventSource.addEventListener('evalProgress', handleSSEEvent('evalProgress', (data) => {
    updateEvalProgress(data);
  }));

  // New best event
  eventSource.addEventListener('newBest', handleSSEEvent('newBest', (data) => {
    console.log('Received newBest:', data);
    appState.globalBest = data;
    updateGlobalBest(data);

    // Flash the best fitness value
    elements.STAT_GLOBAL_FITNESS.classList.add('updating');
    setTimeout(() => elements.STAT_GLOBAL_FITNESS.classList.remove('updating'), 300);
  }));

  // Worker status event
  eventSource.addEventListener('workerStatus', handleSSEEvent('workerStatus', (data) => {
    WorkerPanel.update(data);
  }));

  // Complete event
  eventSource.addEventListener('complete', handleSSEEvent('complete', (data) => {
    console.log('Received complete:', data);
    sessionState.isComplete = true;
    showCompletionOverlay(data);
  }));

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

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      // Hide all tab contents
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      // Activate clicked tab
      tab.classList.add('active');
      // Show corresponding content
      const tabId = `tab-${tab.dataset.tab}`;
      document.getElementById(tabId).classList.remove('hidden');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Dashboard] DOM loaded, initializing...');

  // Cache all DOM elements first
  cacheElements();
  console.log('[Dashboard] Elements cached');

  try {
    initCharts();
    console.log('[Dashboard] Charts initialized');
  } catch (err) {
    console.error('[Dashboard] Chart init error:', err);
  }

  initTabs();
  console.log('[Dashboard] Tabs initialized');

  WorkerPanel.update(8); // Default, will be updated when config arrives
  console.log('[Dashboard] Workers initialized');

  connectSSE();
});
