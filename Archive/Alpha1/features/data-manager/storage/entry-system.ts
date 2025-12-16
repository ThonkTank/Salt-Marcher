// src/features/data-manager/storage/entry-system.ts
// Barrel file for backward compatibility - unified entry system exports
//
// This file re-exports all functionality from entry-card and entry-manager.
// It exists to maintain backward compatibility with existing imports.
//
// For new code, prefer importing directly from:
// - ./entry-card - For card rendering logic
// - ./entry-manager - For list management logic

export * from "./entry-card";
export * from "./entry-manager";
