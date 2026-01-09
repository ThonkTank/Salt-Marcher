// Ziel: HTTP + SSE Server für Live Training Dashboard
// Siehe: Plan indexed-sauteeing-canyon.md
//
// Verantwortlichkeiten:
// - HTTP-Server auf konfigurierbarem Port
// - Statische Dateien aus public/ servieren
// - SSE-Endpoint /events für Live-Updates
// - API-Endpoint /api/history für Reconnect

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TYPES
// ============================================================================

/**
 * Statistiken für eine Generation (aus evolve.ts).
 */
export interface GenerationStats {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  speciesCount: number;
  avgNodes: number;
  avgConnections: number;
  bestGenomeId: string;
  evalTimeMs: number;
}

/**
 * Konfiguration für das Training (Subset).
 */
export interface TrainingConfig {
  populationSize: number;
  generations: number;
  workerCount: number;
}

/**
 * Global Best Tracking.
 */
export interface GlobalBest {
  fitness: number;
  generation: number;
  genomeId: string;
}

/**
 * Evaluation progress within a generation.
 */
export interface EvalProgress {
  /** Current genome being evaluated (1-based) */
  current: number;
  /** Total genomes in population */
  total: number;
  /** Current genome ID */
  genomeId: string;
  /** Generation number */
  generation: number;
}

/**
 * Individual worker status for dashboard.
 */
export interface WorkerStatus {
  id: number;
  busy: boolean;
  jobId: number | null;
  genomeId: string | null;
  durationMs: number | null;
  jobsCompleted: number;
  avgTimeMs: number;
}

/**
 * Worker status update with detailed per-worker info.
 */
export interface WorkerStatusData {
  workers: WorkerStatus[];
  summary: { active: number; total: number };
}

/**
 * Dashboard Events die gebroadcastet werden.
 */
export type DashboardEvent =
  | { type: 'config'; data: TrainingConfig }
  | { type: 'generation'; data: GenerationStats }
  | { type: 'newBest'; data: GlobalBest }
  | { type: 'complete'; data: { totalGenerations: number; finalBestFitness: number; totalTimeMs: number } }
  | { type: 'workerStatus'; data: WorkerStatusData }
  | { type: 'evalProgress'; data: EvalProgress };

/**
 * Dashboard Server Interface.
 */
export interface DashboardServer {
  broadcast(event: DashboardEvent): void;
  stop(): Promise<void>;
  getPort(): number;
}

// ============================================================================
// SSE CLIENT MANAGEMENT
// ============================================================================

interface SSEClient {
  id: number;
  res: http.ServerResponse;
}

let clientIdCounter = 0;
const clients: Map<number, SSEClient> = new Map();

function addClient(res: http.ServerResponse): number {
  const id = ++clientIdCounter;
  clients.set(id, { id, res });
  return id;
}

function removeClient(id: number): void {
  clients.delete(id);
}

function broadcastToClients(event: string, data: unknown): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const clientCount = clients.size;

  if (clientCount > 0) {
    console.log(`  [Dashboard] Broadcasting '${event}' to ${clientCount} client(s)`);
  }

  clients.forEach((client, id) => {
    try {
      client.res.write(message);
    } catch (err) {
      // Client disconnected
      removeClient(id);
    }
  });
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

interface HistoryState {
  config: TrainingConfig | null;
  generations: GenerationStats[];
  globalBest: GlobalBest | null;
  startTime: number;
  isComplete: boolean;
}

const history: HistoryState = {
  config: null,
  generations: [],
  globalBest: null,
  startTime: Date.now(),
  isComplete: false,
};

function resetHistory(): void {
  history.config = null;
  history.generations = [];
  history.globalBest = null;
  history.startTime = Date.now();
  history.isComplete = false;
}

// ============================================================================
// MIME TYPES
// ============================================================================

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function getMimeType(filepath: string): string {
  const ext = path.extname(filepath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ============================================================================
// HTTP REQUEST HANDLER
// ============================================================================

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, publicDir: string): void {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // SSE Endpoint
  if (pathname === '/events') {
    handleSSE(req, res);
    return;
  }

  // API Endpoint: History
  if (pathname === '/api/history') {
    handleHistoryAPI(res);
    return;
  }

  // Static files
  handleStaticFile(res, pathname, publicDir);
}

function handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
  // SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Client registrieren
  const clientId = addClient(res);
  console.log(`  [Dashboard] SSE client connected (id: ${clientId})`);

  // Initial state senden (immer, auch wenn config noch null ist)
  const initData = {
    config: history.config,
    generations: history.generations,
    globalBest: history.globalBest,
    startTime: history.startTime,
    isComplete: history.isComplete,
  };
  console.log(`  [Dashboard] Sending init event:`, JSON.stringify(initData).slice(0, 100) + '...');
  const initMessage = `event: init\ndata: ${JSON.stringify(initData)}\n\n`;
  res.write(initMessage);

  // Heartbeat alle 30 Sekunden
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Client disconnect handler
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(clientId);
    console.log(`  [Dashboard] SSE client disconnected (id: ${clientId})`);
  });
}

function handleHistoryAPI(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify({
    config: history.config,
    generations: history.generations,
    globalBest: history.globalBest,
    startTime: history.startTime,
    isComplete: history.isComplete,
  }));
}

function handleStaticFile(res: http.ServerResponse, pathname: string, publicDir: string): void {
  // Default to index.html
  let filepath = pathname === '/' ? '/index.html' : pathname;
  filepath = path.join(publicDir, filepath);

  // Security: Prevent directory traversal
  if (!filepath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Read and serve file
  fs.readFile(filepath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': getMimeType(filepath) });
    res.end(data);
  });
}

// ============================================================================
// BROWSER OPENER
// ============================================================================

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' :
              process.platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${cmd} ${url}`, (err) => {
    if (err) {
      console.log(`  [Dashboard] Could not open browser: ${err.message}`);
    }
  });
}

// ============================================================================
// SERVER FACTORY
// ============================================================================

/**
 * Startet den Dashboard-Server.
 */
export function startDashboard(
  port: number = 3456,
  options: { openBrowser?: boolean } = {}
): Promise<DashboardServer> {
  return new Promise((resolve, reject) => {
    // Reset history for new training run
    resetHistory();

    // Try multiple paths for public directory (source vs compiled)
    const possiblePaths = [
      path.resolve(__dirname, 'public'),           // Source: scripts/evolution/dashboard/public
      path.resolve(__dirname, 'dashboard/public'), // Compiled: dist/evolution/ -> dashboard/public
    ];

    let publicDir = possiblePaths[0];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        publicDir = p;
        break;
      }
    }

    console.log(`  [Dashboard] Serving from: ${publicDir}`);

    const server = http.createServer((req, res) => {
      handleRequest(req, res, publicDir);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`  [Dashboard] Server running at ${url}`);

      if (options.openBrowser !== false) {
        openBrowser(url);
      }

      const dashboardServer: DashboardServer = {
        broadcast(event: DashboardEvent): void {
          // Update history
          switch (event.type) {
            case 'config':
              history.config = event.data;
              history.startTime = Date.now();
              break;
            case 'generation':
              history.generations.push(event.data);
              break;
            case 'newBest':
              history.globalBest = event.data;
              break;
            case 'complete':
              history.isComplete = true;
              break;
          }

          // Broadcast to all connected clients
          broadcastToClients(event.type, event.data);
        },

        stop(): Promise<void> {
          return new Promise((resolveStop) => {
            // Notify clients of shutdown
            broadcastToClients('shutdown', { message: 'Server shutting down' });

            // Close all SSE connections
            clients.forEach((client, id) => {
              try {
                client.res.end();
              } catch {
                // Ignore errors
              }
              removeClient(id);
            });

            // Close server
            server.close(() => {
              console.log('  [Dashboard] Server stopped');
              resolveStop();
            });
          });
        },

        getPort(): number {
          return port;
        },
      };

      resolve(dashboardServer);
    });
  });
}
