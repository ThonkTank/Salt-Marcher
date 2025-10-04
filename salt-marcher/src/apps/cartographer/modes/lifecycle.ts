// src/apps/cartographer/modes/lifecycle.ts
// Teilt Lifecycle-Helfer für Cartographer-Modi.
import type { CartographerModeLifecycleContext } from "../controller";

export type ModeLifecycle = {
    bind: (ctx: CartographerModeLifecycleContext) => AbortSignal;
    get: () => AbortSignal | null;
    isAborted: () => boolean;
    reset: () => void;
};

export function createModeLifecycle(): ModeLifecycle {
    let signal: AbortSignal | null = null;

    return {
        bind(ctx) {
            signal = ctx.signal;
            return signal;
        },
        get() {
            return signal;
        },
        isAborted() {
            return signal?.aborted ?? false;
        },
        reset() {
            signal = null;
        },
    } satisfies ModeLifecycle;
}
