/**
 * SVG Renderer
 *
 * Pure renderer: takes primitives, outputs SVG.
 * No hex/square/geometry knowledge - just draws shapes.
 *
 * @module utils/render/svg-renderer
 */

import type { RenderBatch, PolygonPrimitive, TextPrimitive } from '../../schemas';
import type { CameraState } from './camera';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type RenderOptions = {
    camera?: CameraState;
};

/**
 * Render a batch of primitives to an SVG element.
 */
export function renderToSvg(batch: RenderBatch, options: RenderOptions = {}): SVGSVGElement {
    const { camera } = options;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(batch.width));
    svg.setAttribute('height', String(batch.height));
    svg.setAttribute('viewBox', `0 0 ${batch.width} ${batch.height}`);
    svg.style.overflow = 'visible';

    // Create a group for camera transform
    const g = document.createElementNS(SVG_NS, 'g');
    if (camera) {
        g.setAttribute('transform', `translate(${camera.panX}, ${camera.panY}) scale(${camera.zoom})`);
    }

    // Render polygons
    for (const polygon of batch.polygons) {
        g.appendChild(createPolygon(polygon));
    }

    // Render labels
    if (batch.labels) {
        for (const label of batch.labels) {
            g.appendChild(createText(label));
        }
    }

    svg.appendChild(g);
    return svg;
}

/**
 * Render a batch into a container element.
 * Clears existing content first.
 */
export function renderToContainer(container: HTMLElement, batch: RenderBatch, options: RenderOptions = {}): void {
    container.innerHTML = '';
    container.appendChild(renderToSvg(batch, options));
}

/**
 * Create an SVG polygon element.
 */
function createPolygon(p: PolygonPrimitive): SVGPolygonElement {
    const el = document.createElementNS(SVG_NS, 'polygon');
    el.setAttribute('points', p.points);
    el.setAttribute('fill', p.fill);

    if (p.stroke) {
        el.setAttribute('stroke', p.stroke);
    }
    if (p.strokeWidth !== undefined) {
        el.setAttribute('stroke-width', String(p.strokeWidth));
    }

    return el;
}

/**
 * Create an SVG text element.
 */
function createText(t: TextPrimitive): SVGTextElement {
    const el = document.createElementNS(SVG_NS, 'text');
    el.setAttribute('x', String(t.x));
    el.setAttribute('y', String(t.y));
    el.textContent = t.text;

    if (t.fill) {
        el.setAttribute('fill', t.fill);
    }
    if (t.fontSize !== undefined) {
        el.setAttribute('font-size', String(t.fontSize));
    }
    if (t.anchor) {
        el.setAttribute('text-anchor', t.anchor);
    }

    return el;
}
