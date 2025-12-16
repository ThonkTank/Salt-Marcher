// src/app/ipc-server.ts
// IPC Server for external command execution via CLI
import * as net from 'net';
import type { App } from 'obsidian';
import { getErrorNotificationService } from '@services/error-notification-service';
import { ensureError, getErrorMessage } from '@services/error-handling';
import { configurableLogger } from '@services/logging/configurable-logger';
const logger = configurableLogger.forModule('ipc-server');

export interface CommandRequest {
  command: string;
  args: string[];
  id: string;
}

export interface CommandResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  id: string;
}

export type CommandHandler = (app: App, args: string[]) => Promise<unknown>;

/**
 * Vault adapter interface for accessing the vault's base path
 * Needed for getting file system paths in sandboxed environments (Flatpak/Snap)
 */
interface VaultAdapter {
  basePath: string;
  [key: string]: unknown;
}

export class IPCServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private handlers = new Map<string, CommandHandler>();
  private registeredCommands: string[] = [];

  constructor(private app: App) {
    // Use vault-relative path to work with Flatpak/Snap sandboxes
    const adapter = app.vault.adapter as VaultAdapter;
    const vaultPath = adapter.basePath;
    this.socketPath = `${vaultPath}/.obsidian/plugins/salt-marcher/ipc.sock`;
  }

  /**
   * Register a command handler
   */
  registerCommand(name: string, handler: CommandHandler): void {
    this.handlers.set(name, handler);
    this.registeredCommands.push(name);
  }

  /**
   * Log summary of all registered commands
   * Call this after all registerCommand calls are complete
   */
  logRegisteredCommands(category?: string): void {
    const count = this.registeredCommands.length;
    if (count === 0) return;

    const preview = this.registeredCommands.slice(0, 3).join(', ');
    const suffix = count > 3 ? ` (+${count - 3} more)` : '';
    const prefix = category ? `${category}: ` : '';

    logger.info(`${prefix}Registered ${count} commands: ${preview}${suffix}`);

    // Reset for next batch (e.g., dev commands)
    this.registeredCommands = [];
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
          logger.error('Client socket error:', err);
        });
      });

      // Handle server errors
      this.server.on('error', (err) => {
        logger.error('Server error:', err);
        reject(err);
      });

      // Wait for server to be listening
      this.server.on('listening', () => {
        logger.debug(`Server started on ${this.socketPath}`);
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

    logger.debug('Received command:', command, args);

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
      logger.debug('Command completed:', command);
      return { success: true, data, id };
    } catch (error) {
      const err = ensureError(error);
      const notificationService = getErrorNotificationService(logger);

      notificationService.error(
        `IPC command failed: ${command}`,
        err,
        { showToUser: false, context: 'ipc' }
      );

      return {
        success: false,
        error: getErrorMessage(err),
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

    logger.debug('Server stopped');
  }
}

// ============================================================================
// DOM Inspection Utilities
// ============================================================================

interface DOMInspectOptions {
  selector: string;
  depth: number;
  includeAttributes: boolean;
  includeStyles: boolean;
}

/**
 * Serialize DOM tree to HTML string with indentation
 */
function serializeDOMTree(
  element: Element,
  options: DOMInspectOptions,
  currentDepth: number = 0
): string {
  const indent = "  ".repeat(currentDepth);
  const tagName = element.tagName.toLowerCase();
  let html = `${indent}<${tagName}`;

  // Add attributes
  if (options.includeAttributes && element.attributes.length > 0) {
    const attrs: string[] = [];
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      // Escape quotes in attribute values
      const value = attr.value.replace(/"/g, '&quot;');
      attrs.push(`${attr.name}="${value}"`);
    }
    html += " " + attrs.join(" ");
  }

  // Add computed styles
  if (options.includeStyles && element instanceof HTMLElement) {
    const styles = window.getComputedStyle(element);
    if (styles.cssText) {
      html += ` style="${styles.cssText.replace(/"/g, '&quot;')}"`;
    }
  }

  html += ">";

  // Handle text nodes
  const textContent = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim())
    .filter(Boolean)
    .join(" ");

  if (textContent && textContent.length < 100) {
    html += textContent;
  }

  // Recursively add children (element nodes only)
  const children = Array.from(element.children);
  if (children.length > 0) {
    html += "\n";

    if (currentDepth < options.depth) {
      for (const child of children) {
        html += serializeDOMTree(child, options, currentDepth + 1);
      }
    } else {
      html += `${indent}  <!-- ${children.length} children (max depth reached) -->\n`;
    }

    html += indent;
  }

  html += `</${tagName}>\n`;
  return html;
}

interface DOMInspectResult {
  selector: string;
  count: number;
  html: string;
}

/**
 * DOM inspection command handler
 *
 * Usage: dom-inspect <selector> [depth] [--attributes] [--styles]
 */
export async function handleDOMInspect(app: App, args: string[]): Promise<DOMInspectResult> {
  // Parse arguments
  const selector = args[0] || "body";
  const depth = parseInt(args[1]) || 10;
  const includeAttributes = !args.includes("--no-attributes");
  const includeStyles = args.includes("--styles");

  logger.debug("DOM inspect:", { selector, depth, includeAttributes, includeStyles });

  // Find element(s)
  const elements = document.querySelectorAll(selector);

  if (elements.length === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }

  // Serialize all matching elements
  let html = "";
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    if (elements.length > 1) {
      html += `<!-- Element ${i + 1} of ${elements.length} -->\n`;
    }

    html += serializeDOMTree(element, {
      selector,
      depth,
      includeAttributes,
      includeStyles
    });

    if (i < elements.length - 1) {
      html += "\n";
    }
  }

  return {
    selector,
    count: elements.length,
    html
  };
}
