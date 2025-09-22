// UI: Token-Rendering + Animation. KEIN Drag hier.

import type { TokenCtl } from "../infra/adapter";

export function createTokenLayer(contentG: SVGGElement): TokenCtl & { el: SVGGElement } {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
    el.classList.add("tg-token");
    el.style.pointerEvents = "auto";
    el.style.cursor = "grab";
    contentG.appendChild(el);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "14");
    circle.classList.add("tg-token__circle");
    el.appendChild(circle);

    let vx = 0, vy = 0;
    let rafId: number | null = null;
    let pendingReject: ((reason?: unknown) => void) | null = null;

    const makeCancelError = () => {
        const err = new Error("token-move-cancelled");
        err.name = "TokenMoveCancelled";
        return err;
    };

    const cancelActiveAnimation = (reason = makeCancelError()) => {
        if (rafId != null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (pendingReject) {
            const reject = pendingReject;
            pendingReject = null;
            reject(reason);
        }
    };

    function setPos(x: number, y: number) {
        vx = x; vy = y;
        el.setAttribute("transform", `translate(${x},${y})`);
    }

    function moveTo(x: number, y: number, durMs: number): Promise<void> {
        cancelActiveAnimation();
        if (durMs <= 0) {
            setPos(x, y);
            return Promise.resolve();
        }

        const x0 = vx;
        const y0 = vy;
        const dx = x - x0;
        const dy = y - y0;
        const t0 = performance.now();

        return new Promise<void>((resolve, reject) => {
            pendingReject = reject;
            const step = () => {
                const t = (performance.now() - t0) / durMs;
                if (t >= 1) {
                    setPos(x, y);
                    rafId = null;
                    pendingReject = null;
                    resolve();
                    return;
                }
                const k = t < 0 ? 0 : t;
                setPos(x0 + dx * k, y0 + dy * k);
                rafId = requestAnimationFrame(step);
            };
            rafId = requestAnimationFrame(step);
        });
    }

    function show() { el.style.display = ""; }
    function hide() { el.style.display = "none"; }
    function stop() {
        cancelActiveAnimation();
    }

    function destroy() {
        cancelActiveAnimation();
        el.remove();
    }

    hide(); // Start unsichtbar

    return { el, setPos, moveTo, stop, show, hide, destroy };
}
