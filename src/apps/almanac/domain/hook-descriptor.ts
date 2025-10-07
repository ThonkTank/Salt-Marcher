// src/apps/almanac/domain/hook-descriptor.ts
// Shared hook descriptor types for calendar events and phenomena.

/**
 * Hook Descriptor
 *
 * Represents an automation that should be triggered when an occurrence fires.
 * Hooks mirror the API contracts defined for the Almanac mode and are shared
 * between calendar events and phenomena.
 */
export type HookType = 'webhook' | 'script' | 'cartographer_event';

export interface HookDescriptor {
  readonly id: string;
  readonly type: HookType;
  readonly config: Readonly<Record<string, unknown>>;
  /** Optional hook priority. Higher numbers execute first. */
  readonly priority?: number;
}

/**
 * Sort hooks descending by priority (fallback to stable id ordering).
 */
export function sortHooksByPriority(hooks: ReadonlyArray<HookDescriptor>): HookDescriptor[] {
  return [...hooks].sort((a, b) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    return a.id.localeCompare(b.id);
  });
}
