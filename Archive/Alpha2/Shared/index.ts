/**
 * Shared Module Index
 *
 * Re-exports all shared code for use by plugins.
 *
 * @module Shared
 */

// Schemas
export * from './schemas';

// Base Classes
export { BaseService } from './base-service';
export { BasePresenter } from './base-presenter';
export type { RenderCallback, Subscribable } from './base-presenter';
