// src/app/ipc-server.ts
// IPC Server for external command execution via CLI
import * as net from 'net';
import { App } from 'obsidian';
import { logger } from './plugin-logger';

export interface CommandRequest {
  command: string;
  args: string[];
  id: string;
}

export interface CommandResponse {
  success: boolean;
  data?: any;
  error?: string;
  id: string;
}

export type CommandHandler = (app: App, args: string[]) => Promise<any>;

export class IPCServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private handlers = new Map<string, CommandHandler>();

  constructor(private app: App) {
    // Use vault-relative path to work with Flatpak/Snap sandboxes
    const vaultPath = (app.vault.adapter as any).basePath;
    this.socketPath = `${vaultPath}/.obsidian/plugins/salt-marcher/ipc.sock`;
  }

  /**
   * Register a command handler
   */
  registerCommand(name: string, handler: CommandHandler): void {
    this.handlers.set(name, handler);
    logger.log(`[IPC] Registered command: ${name}`);
  }

  /**
   * Start the IPC server
   */
  async start(): Promise<void> {
    // Remove existing socket file if it exists
    try {
      const fs = require('fs');
      fs.unlinkSync(this.socketPath);
    } catch (err) {
      // Socket doesn't exist, that's fine
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer(async (socket) => {
        let buffer = '';

        socket.on('data', async (data) => {
          buffer += data.toString();

          // Check for complete messages (newline-delimited JSON)
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const request: CommandRequest = JSON.parse(line);
              const response = await this.handleCommand(request);
              socket.write(JSON.stringify(response) + '\n');
            } catch (error) {
              const errorResponse: CommandResponse = {
                success: false,
                error: String(error),
                id: 'unknown'
              };
              socket.write(JSON.stringify(errorResponse) + '\n');
            }
          }
        });

        socket.on('error', (err) => {
          logger.error('[IPC] Client socket error:', err);
        });
      });

      // Handle server errors
      this.server.on('error', (err) => {
        logger.error('[IPC] Server error:', err);
        reject(err);
      });

      // Wait for server to be listening
      this.server.on('listening', () => {
        logger.log(`[IPC] Server started on ${this.socketPath}`);
        resolve();
      });

      this.server.listen(this.socketPath);
    });
  }

  /**
   * Handle incoming command request
   */
  private async handleCommand(request: CommandRequest): Promise<CommandResponse> {
    const { command, args, id } = request;

    logger.log('[IPC] Received command:', command, args);

    const handler = this.handlers.get(command);
    if (!handler) {
      return {
        success: false,
        error: `Unknown command: ${command}`,
        id
      };
    }

    try {
      const data = await handler(this.app, args);
      logger.log('[IPC] Command completed:', command);
      return { success: true, data, id };
    } catch (error) {
      logger.error('[IPC] Command failed:', command, error);
      return {
        success: false,
        error: String(error),
        id
      };
    }
  }

  /**
   * Stop the IPC server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // Clean up socket file
    try {
      const fs = require('fs');
      fs.unlinkSync(this.socketPath);
    } catch (err) {
      // Socket file doesn't exist, that's fine
    }

    logger.log('[IPC] Server stopped');
  }
}
