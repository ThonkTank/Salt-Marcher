/*
}


export function getRingBuffer(): LogEntry[] {
return [...state.ring];
}


export interface Logger {
error: (msg: string, ctx?: unknown) => void;
warn: (msg: string, ctx?: unknown) => void;
info: (msg: string, ctx?: unknown) => void;
debug: (msg: string, ctx?: unknown) => void;
trace: (msg: string, ctx?: unknown) => void;
}


export function createLogger(ns: string): Logger {
state.knownNamespaces.add(ns);


const emit = (level: LogLevel, msg: string, ctx?: unknown) => {
if (!shouldLog(ns, level)) return;


const ts = nowISO();
const safeCtx = ctx === undefined ? undefined : clampContext(ctx, state.cfg.maxContextChars);


// Konsole
if (state.cfg.enableConsole) {
// Einheitliches Format
const prefix = `[${level.toUpperCase()}][${ns}]`;
const args = safeCtx === undefined ? [`${prefix} ${msg}`] : [`${prefix} ${msg}`, safeCtx];
switch (level) {
case "error": console.error(...args); break;
case "warn": console.warn(...args); break;
case "info": console.info(...args); break;
case "debug": console.debug(...args); break;
case "trace": console.debug(...args); break; // trace → debug‑Kanal
}
}


// Ring-Buffer (immer)
const entry: LogEntry = { ts, level, ns, msg, ctx: safeCtx };
pushRing(entry);


// Optional: Notice für warn/error – UI Feedback für GM
if (state.cfg.enableNotice && (level === "warn" || level === "error")) {
// Lazy load, um harte Abhängigkeit zu vermeiden (während Tests)
try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Notice = (window as any).app?.plugins?.plugins?.["salt-marcher"]?.Notice ?? (window as any).Notice;
if (Notice) new Notice(`[${ns}] ${level.toUpperCase()}: ${msg}`, 4_000);
} catch {/* ignore */}
}
};


return {
error: (m, c) => emit("error", m, c),
warn: (m, c) => emit("warn", m, c),
info: (m, c) => emit("info", m, c),
debug: (m, c) => emit("debug", m, c),
trace: (m, c) => emit("trace", m, c),
};
}


// Bequeme Singleton‑Logger für Kernmodule (optional)
export const logCore = createLogger("Core");
export const logHex = createLogger("HexView");
export const logNotes = createLogger("Notes");
export const logTravel = createLogger("Travel");
export const logClock = createLogger("Clock");
export const logChron = createLogger("Chronicle");
