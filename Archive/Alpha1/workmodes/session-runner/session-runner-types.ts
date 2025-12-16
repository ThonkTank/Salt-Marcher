// src/workmodes/session-runner/session-runner-types.ts
/**
 * Public type definitions for Session Runner workmode
 */

import type { AxialCoord } from "@geometry";

// Re-export coordinate type with legacy alias
export type { AxialCoord };
export type HexCoord = AxialCoord;

// Re-export public types from controller
export type {
  SessionRunnerContext,
  SessionRunnerLifecycleContext,
  SessionRunnerExperience,
  SessionRunnerControllerCallbacks,
} from './session-runner-controller';

// Re-export travel domain types
export type {
  Coord,
  NodeKind,
  RouteNode,
  LogicStateSnapshot,
} from './travel/engine/types';
