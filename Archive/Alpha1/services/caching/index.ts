// src/services/caching/index.ts
// Comprehensive cache management framework

export { CacheManager, type CacheOptions, type CacheStats, type CacheEvents } from "./cache-manager";
export { LRUCache } from "./lru-cache";
export { WatchedCache } from "./watched-cache";
export { GlobalCacheRegistry, type GlobalCacheStats } from "./cache-registry";
export {
    MemoryMonitor,
    type MemoryMonitorConfig,
    type MemoryMonitorResult,
    type MemoryPressureLevel,
} from "./memory-monitor";
