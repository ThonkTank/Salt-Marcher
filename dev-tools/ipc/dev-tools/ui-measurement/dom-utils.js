"use strict";
// dev-tools/ui-measurement/dom-utils.ts
// DOM traversal and selection utilities for UI measurement
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAncestor = findAncestor;
exports.extractLabel = extractLabel;
exports.isVisible = isVisible;
exports.getComputedStyles = getComputedStyles;
exports.getDimensions = getDimensions;
exports.groupByAncestor = groupByAncestor;
exports.waitForAnimation = waitForAnimation;
/**
 * Find the closest ancestor matching a selector
 */
function findAncestor(element, selector) {
    let current = element;
    while (current && current !== document.body) {
        if (current.matches(selector)) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}
/**
 * Extract label/name from an element using a selector
 */
function extractLabel(container, selector) {
    const element = container.querySelector(selector);
    return element?.textContent?.trim() || 'unknown';
}
/**
 * Filter elements by visibility
 */
function isVisible(element) {
    return element.offsetParent !== null;
}
/**
 * Get computed style properties for an element
 */
function getComputedStyles(element, properties) {
    const computed = window.getComputedStyle(element);
    const result = {};
    for (const prop of properties) {
        result[prop] = computed.getPropertyValue(prop);
    }
    return result;
}
/**
 * Get bounding box dimensions
 */
function getDimensions(element) {
    const bbox = element.getBoundingClientRect();
    return {
        width: bbox.width,
        height: bbox.height,
        x: bbox.x,
        y: bbox.y,
    };
}
/**
 * Group elements by their ancestor's label
 */
function groupByAncestor(elements, ancestorSelector, labelSelector) {
    const groups = new Map();
    for (const element of elements) {
        const ancestor = findAncestor(element, ancestorSelector);
        if (!ancestor)
            continue;
        const label = extractLabel(ancestor, labelSelector);
        if (!groups.has(label)) {
            groups.set(label, []);
        }
        groups.get(label).push(element);
    }
    return groups;
}
/**
 * Wait for DOM changes (useful for animations)
 */
function waitForAnimation(duration = 600) {
    return new Promise(resolve => setTimeout(resolve, duration));
}
