import { describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import { createTerrainBootstrap } from "../../src/app/bootstrap-services";

describe("createTerrainBootstrap", () => {
    const createLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    });

    it("primes terrains and registers a watcher", async () => {
        const logger = createLogger();
        const ensureTerrainFile = vi.fn().mockResolvedValue({});
        const loadTerrains = vi.fn().mockResolvedValue({ Forest: { color: "#0f0", speed: 0.5 } });
        const setTerrains = vi.fn();
        const dispose = vi.fn();
        const watchTerrains = vi.fn((_app, _options) => dispose);

        const app = new App();
        const bootstrap = createTerrainBootstrap(app, {
            ensureTerrainFile,
            loadTerrains,
            setTerrains,
            watchTerrains,
            logger,
        });

        const primed = await bootstrap.start();

        expect(primed).toBe(true);
        expect(ensureTerrainFile).toHaveBeenCalledWith(app);
        expect(loadTerrains).toHaveBeenCalledWith(app);
        expect(setTerrains).toHaveBeenCalledWith({ Forest: { color: "#0f0", speed: 0.5 } });
        expect(watchTerrains).toHaveBeenCalledTimes(1);
        const options = watchTerrains.mock.calls[0][1];
        expect(typeof options?.onError).toBe("function");
        expect(logger.error).not.toHaveBeenCalled();

        bootstrap.stop();
        expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("logs and continues when priming fails", async () => {
        const logger = createLogger();
        const failure = new Error("read failed");
        const ensureTerrainFile = vi.fn().mockResolvedValue({});
        const loadTerrains = vi.fn().mockRejectedValue(failure);
        const setTerrains = vi.fn();
        const dispose = vi.fn();
        const watchTerrains = vi.fn((_app, options) => {
            options?.onError?.(new Error("update failed"), { reason: "modify" });
            return dispose;
        });

        const app = new App();
        const bootstrap = createTerrainBootstrap(app, {
            ensureTerrainFile,
            loadTerrains,
            setTerrains,
            watchTerrains,
            logger,
        });

        const primed = await bootstrap.start();

        expect(primed).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
            "Failed to prime terrain palette from vault",
            expect.objectContaining({ error: failure })
        );
        expect(logger.error).toHaveBeenCalledWith(
            "Terrain watcher failed to apply vault change",
            expect.objectContaining({ reason: "modify" })
        );
        expect(dispose).not.toHaveBeenCalled();
    });

    it("disposes the previous watcher when restarted", async () => {
        const logger = createLogger();
        const ensureTerrainFile = vi.fn().mockResolvedValue({});
        const loadTerrains = vi.fn().mockResolvedValue({});
        const setTerrains = vi.fn();
        const firstDispose = vi.fn();
        const secondDispose = vi.fn();
        const watchTerrains = vi
            .fn()
            .mockReturnValueOnce(firstDispose)
            .mockReturnValueOnce(secondDispose);

        const app = new App();
        const bootstrap = createTerrainBootstrap(app, {
            ensureTerrainFile,
            loadTerrains,
            setTerrains,
            watchTerrains,
            logger,
        });

        await bootstrap.start();
        await bootstrap.start();

        expect(firstDispose).toHaveBeenCalledTimes(1);
        expect(secondDispose).not.toHaveBeenCalled();
        bootstrap.stop();
        expect(secondDispose).toHaveBeenCalledTimes(1);
    });

    it("logs when watcher registration throws", async () => {
        const logger = createLogger();
        const error = new Error("listener boom");
        const ensureTerrainFile = vi.fn().mockResolvedValue({});
        const loadTerrains = vi.fn().mockResolvedValue({});
        const setTerrains = vi.fn();
        const watchTerrains = vi.fn(() => {
            throw error;
        });

        const app = new App();
        const bootstrap = createTerrainBootstrap(app, {
            ensureTerrainFile,
            loadTerrains,
            setTerrains,
            watchTerrains,
            logger,
        });

        const primed = await bootstrap.start();

        expect(primed).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
            "Failed to register terrain watcher",
            expect.objectContaining({ error })
        );
    });
});
