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

    function setPos(x: number, y: number) {
        vx = x; vy = y;
        el.setAttribute("transform", `translate(${x},${y})`);
    }

    function moveTo(x: number, y: number, durMs: number): Promise<void> {
        if (durMs <= 0) { setPos(x, y); return Promise.resolve(); }
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }

        const x0 = vx, y0 = vy;
        const dx = x - x0, dy = y - y0;
        const t0 = performance.now();

        return new Promise<void>((resolve) => {
            const step = () => {
                const t = (performance.now() - t0) / durMs;
                if (t >= 1) {
                    setPos(x, y);
                    rafId = null;
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
    function destroy() { if (rafId != null) cancelAnimationFrame(rafId); el.remove(); }

    hide(); // Start unsichtbar

    return { el, setPos, moveTo, show, hide, destroy };
}
