/*
* Salt Marcher – Settings Typen & Defaults
*/
import type { LogLevel } from "./logger";


export interface SaltSettings {
logGlobalLevel: LogLevel;
logPerNamespace: Record<string, LogLevel | undefined>;
logEnableConsole: boolean;
logEnableNotice: boolean;
logRingBufferSize: number;
logMaxContextChars: number;
}


export const DEFAULT_SETTINGS: SaltSettings = {
logGlobalLevel: "info",
logPerNamespace: {},
logEnableConsole: true,
logEnableNotice: true,
logRingBufferSize: 500,
logMaxContextChars: 10_000,
};
