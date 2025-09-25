// src/plugins/layout-editor/utils.ts
import { LayoutEditorSnapshot, LayoutElement } from "./types";
import { isContainerType } from "./definitions";

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function cloneLayoutElement(element: LayoutElement): LayoutElement {
    return {
        ...element,
        attributes: [...element.attributes],
        options: element.options ? [...element.options] : undefined,
        layout: element.layout ? { ...element.layout } : undefined,
        children: element.children ? [...element.children] : undefined,
        viewState: element.viewState ? JSON.parse(JSON.stringify(element.viewState)) : undefined,
    };
}

function arraysAreEqual<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
    const arrA = a ?? [];
    const arrB = b ?? [];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
        if (arrA[i] !== arrB[i]) return false;
    }
    return true;
}

function recordsAreEqual(
    a: Record<string, unknown> | undefined,
    b: Record<string, unknown> | undefined,
): boolean {
    if (a === b) return true;
    if (!a || !b) return !a && !b;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        const valA = a[key];
        const valB = b[key];
        if (Array.isArray(valA) && Array.isArray(valB)) {
            if (!arraysAreEqual(valA, valB)) return false;
            continue;
        }
        if (typeof valA === "object" && valA && typeof valB === "object" && valB) {
            if (!recordsAreEqual(valA as Record<string, unknown>, valB as Record<string, unknown>)) {
                return false;
            }
            continue;
        }
        if (valA !== valB) return false;
    }
    return true;
}

export function elementsAreEqual(a: LayoutElement, b: LayoutElement): boolean {
    if (a === b) return true;
    if (
        a.id !== b.id ||
        a.type !== b.type ||
        a.x !== b.x ||
        a.y !== b.y ||
        a.width !== b.width ||
        a.height !== b.height ||
        a.label !== b.label ||
        a.description !== b.description ||
        a.placeholder !== b.placeholder ||
        a.defaultValue !== b.defaultValue ||
        a.parentId !== b.parentId
    ) {
        return false;
    }
    if (a.viewBindingId !== b.viewBindingId) return false;
    if (!recordsAreEqual(a.viewState as Record<string, unknown> | undefined, b.viewState as Record<string, unknown> | undefined)) {
        return false;
    }
    if (!arraysAreEqual(a.options, b.options)) return false;
    if (!arraysAreEqual(a.attributes, b.attributes)) return false;
    if (!arraysAreEqual(a.children, b.children)) return false;
    if (!!a.layout !== !!b.layout) return false;
    if (a.layout && b.layout) {
        if (a.layout.gap !== b.layout.gap || a.layout.padding !== b.layout.padding || a.layout.align !== b.layout.align) {
            return false;
        }
    }
    return true;
}

export function snapshotsAreEqual(a: LayoutEditorSnapshot | undefined, b: LayoutEditorSnapshot | undefined): boolean {
    if (!a || !b) return false;
    if (
        a.canvasWidth !== b.canvasWidth ||
        a.canvasHeight !== b.canvasHeight ||
        a.selectedElementId !== b.selectedElementId ||
        a.elements.length !== b.elements.length
    ) {
        return false;
    }
    for (let i = 0; i < a.elements.length; i++) {
        if (!elementsAreEqual(a.elements[i], b.elements[i])) return false;
    }
    return true;
}

export function isContainerElement(element: LayoutElement): element is LayoutElement & { children: string[] } {
    return isContainerType(element.type) && Array.isArray(element.children);
}

export function collectDescendantIds(element: LayoutElement, elements: LayoutElement[]): Set<string> {
    const lookup = new Map(elements.map(entry => [entry.id, entry] as const));
    const result = new Set<string>();
    const stack = Array.isArray(element.children) ? [...element.children] : [];
    while (stack.length) {
        const id = stack.pop()!;
        if (result.has(id)) continue;
        result.add(id);
        const child = lookup.get(id);
        if (child?.children?.length) {
            stack.push(...child.children);
        }
    }
    return result;
}

export function collectAncestorIds(element: LayoutElement, elements: LayoutElement[]): Set<string> {
    const lookup = new Map(elements.map(entry => [entry.id, entry] as const));
    const result = new Set<string>();
    let current = element.parentId ? lookup.get(element.parentId) ?? null : null;
    while (current) {
        if (result.has(current.id)) break;
        result.add(current.id);
        current = current.parentId ? lookup.get(current.parentId) ?? null : null;
    }
    return result;
}
