"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPCServer = void 0;
// src/app/ipc-server.ts
// IPC Server for external command execution via CLI
const net = __importStar(require("net"));
const plugin_logger_1 = require("./plugin-logger");
class IPCServer {
    constructor(app) {
        this.app = app;
        this.server = null;
        this.handlers = new Map();
        // Use vault-relative path to work with Flatpak/Snap sandboxes
        const vaultPath = app.vault.adapter.basePath;
        this.socketPath = `${vaultPath}/.obsidian/plugins/salt-marcher/ipc.sock`;
    }
    /**
     * Register a command handler
     */
    registerCommand(name, handler) {
        this.handlers.set(name, handler);
        plugin_logger_1.logger.log(`[IPC] Registered command: ${name}`);
    }
    /**
     * Start the IPC server
     */
    async start() {
        // Remove existing socket file if it exists
        try {
            const fs = require('fs');
            fs.unlinkSync(this.socketPath);
        }
        catch (err) {
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
                        if (!line.trim())
                            continue;
                        try {
                            const request = JSON.parse(line);
                            const response = await this.handleCommand(request);
                            socket.write(JSON.stringify(response) + '\n');
                        }
                        catch (error) {
                            const errorResponse = {
                                success: false,
                                error: String(error),
                                id: 'unknown'
                            };
                            socket.write(JSON.stringify(errorResponse) + '\n');
                        }
                    }
                });
                socket.on('error', (err) => {
                    plugin_logger_1.logger.error('[IPC] Client socket error:', err);
                });
            });
            // Handle server errors
            this.server.on('error', (err) => {
                plugin_logger_1.logger.error('[IPC] Server error:', err);
                reject(err);
            });
            // Wait for server to be listening
            this.server.on('listening', () => {
                plugin_logger_1.logger.log(`[IPC] Server started on ${this.socketPath}`);
                resolve();
            });
            this.server.listen(this.socketPath);
        });
    }
    /**
     * Handle incoming command request
     */
    async handleCommand(request) {
        const { command, args, id } = request;
        plugin_logger_1.logger.log('[IPC] Received command:', command, args);
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
            plugin_logger_1.logger.log('[IPC] Command completed:', command);
            return { success: true, data, id };
        }
        catch (error) {
            plugin_logger_1.logger.error('[IPC] Command failed:', command, error);
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
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        // Clean up socket file
        try {
            const fs = require('fs');
            fs.unlinkSync(this.socketPath);
        }
        catch (err) {
            // Socket file doesn't exist, that's fine
        }
        plugin_logger_1.logger.log('[IPC] Server stopped');
    }
}
exports.IPCServer = IPCServer;
