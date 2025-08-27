/*
* Salt Marcher – Logger
* Ziel: Einheitliches Debugging mit Namespaces, Level-Filter & optionalem Notice-Sink.
*/


export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";


export interface LoggerConfig {
globalLevel: LogLevel;
perNamespace: Record<string, LogLevel | undefined>; // optionaler Override
enableConsole: boolean; // DevTools Konsole
enableNotice: boolean; // Obsidian Notice für warn/error (UI‑Toast)
ringBufferSize: number; // zuletzt gemerkte Logzeilen
maxContextChars: number; // gegen Rauschen/perf Kosten
}


export interface LogEntry {
ts: string;
level: LogLevel;
ns: string;
msg: string;
ctx?: unknown;
}


const LEVEL_ORDER: Record<LogLevel, number> = {
error: 0,
warn: 1,
info: 2,
debug: 3,
trace: 4,
};


// Globale, aber intern gekapselte Runtime‑State (wird von Settings überschrieben)
const state: {
cfg: LoggerConfig;
ring: LogEntry[];
knownNamespaces: Set<string>;
} = {
cfg: {
globalLevel: "info",
perNamespace: {},
enableConsole: true,
enableNotice: true,
ringBufferSize: 500,
maxContextChars: 10_000,
},
ring: [],
knownNamespaces: new Set(),
};


// ——————————————————————————————————————————————————————————————
// Utilities
// ——————————————————————————————————————————————————————————————
function nowISO() {
return new Date().toISOString();
export const logChron = createLogger("Chronicle");
