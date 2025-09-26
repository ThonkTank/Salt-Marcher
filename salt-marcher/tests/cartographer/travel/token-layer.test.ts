import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createTokenLayer } from "../../../src/apps/cartographer/travel/ui/token-layer";

const SVG_NS = "http://www.w3.org/2000/svg";

describe("token-layer animations", () => {
    let host: SVGGElement;
    let rafQueue: Array<{ id: number; cb: FrameRequestCallback }>;
    let rafId: number;
    let now: number;
    let performanceSpy: ReturnType<typeof vi.spyOn> | null = null;

    const flushRaf = (ms: number) => {
        now += ms;
        const callbacks = rafQueue.slice();
        rafQueue = [];
        for (const { cb } of callbacks) {
            cb(now);
        }
    };

    beforeEach(() => {
        document.body.innerHTML = "";
        const svg = document.createElementNS(SVG_NS, "svg");
        host = document.createElementNS(SVG_NS, "g");
        svg.appendChild(host);
        document.body.appendChild(svg);

        now = 0;
        rafQueue = [];
        rafId = 1;

        vi.useFakeTimers();
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            const id = rafId++;
            rafQueue.push({ id, cb });
            return id;
        });
        vi.stubGlobal("cancelAnimationFrame", (id: number) => {
            rafQueue = rafQueue.filter((entry) => entry.id !== id);
        });
        performanceSpy = vi.spyOn(performance, "now").mockImplementation(() => now);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        if (performanceSpy) {
            performanceSpy.mockRestore();
            performanceSpy = null;
        }
        rafQueue = [];
        vi.useRealTimers();
    });

    it("animates towards the requested position over time", async () => {
        const token = createTokenLayer(host);
        expect(token.el.style.display).toBe("none");

        const promise = token.moveTo(90, 45, 200);

        flushRaf(100); // Halfway through the duration
        expect(token.el.getAttribute("transform")).toBe("translate(45,22.5)");

        flushRaf(100); // Finish animation
        await promise;
        expect(token.el.getAttribute("transform")).toBe("translate(90,45)");
    });

    it("cancels the previous animation when a new move starts", async () => {
        const token = createTokenLayer(host);

        const first = token.moveTo(60, 30, 400);
        flushRaf(100);

        const second = token.moveTo(100, 50, 200);
        await expect(first).rejects.toMatchObject({ name: "TokenMoveCancelled" });

        flushRaf(100);
        flushRaf(100);
        await second;
        expect(token.el.getAttribute("transform")).toBe("translate(100,50)");
    });

    it("rejects the active animation promise when stopped manually", async () => {
        const token = createTokenLayer(host);

        const pending = token.moveTo(20, 10, 300);
        flushRaf(100);

        token.stop();
        await expect(pending).rejects.toMatchObject({ name: "TokenMoveCancelled" });
    });
});
