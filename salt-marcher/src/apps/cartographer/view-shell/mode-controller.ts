export type ModeSwitchContext = {
    readonly signal: AbortSignal;
};

export type ModeSwitchHandler = (modeId: string, ctx: ModeSwitchContext) => Promise<void> | void;

export type ModeControllerHandle = {
    requestMode(modeId: string): Promise<void>;
    abortActive(): void;
    destroy(): void;
};

export function createModeController(options: { onSwitch: ModeSwitchHandler }): ModeControllerHandle {
    const { onSwitch } = options;
    let currentController: AbortController | null = null;
    let destroyed = false;
    let sequence = 0;

    const abortActive = () => {
        if (currentController) {
            currentController.abort();
            currentController = null;
        }
    };

    const requestMode = async (modeId: string): Promise<void> => {
        if (destroyed) return;

        sequence += 1;
        const token = sequence;

        if (currentController) {
            currentController.abort();
        }
        const controller = new AbortController();
        currentController = controller;

        try {
            await onSwitch(modeId, { signal: controller.signal });
        } catch (error) {
            if (!controller.signal.aborted) {
                throw error;
            }
        } finally {
            if (currentController === controller && token === sequence) {
                currentController = null;
            }
        }
    };

    const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        abortActive();
    };

    return {
        requestMode,
        abortActive,
        destroy,
    };
}
