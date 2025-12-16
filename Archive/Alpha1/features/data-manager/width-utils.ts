// src/features/data-manager/width-utils.ts
// Utility for calculating rendered text width

export interface TextWidthOptions {
  /**
   * Include padding from reference element in calculation.
   * Default: false
   */
  includePadding?: boolean;

  /**
   * Include border from reference element in calculation.
   * Default: false
   */
  includeBorder?: boolean;

  /**
   * Additional space to add to calculated width.
   * Default: 0
   */
  extraSpace?: number;
}

/**
 * Calculates the rendered width of text using a reference element's font styles.
 *
 * This function creates a hidden mirror element, copies the reference element's
 * font styles, measures the text width, and optionally includes padding/border
 * from the reference element.
 *
 * @param text - The text to measure
 * @param referenceElement - Element to copy font styles from
 * @param options - Optional configuration for padding, border, and extra space
 * @returns Width in pixels
 *
 * @example
 * // Simple text measurement
 * const width = calculateTextWidth("Hello", inputElement);
 *
 * @example
 * // Include padding and border (for sizing inputs)
 * const width = calculateTextWidth("Hello", inputElement, {
 *   includePadding: true,
 *   includeBorder: true,
 *   extraSpace: 8
 * });
 */
export function calculateTextWidth(
  text: string,
  referenceElement: HTMLElement,
  options?: TextWidthOptions
): number {
  const opts = {
    includePadding: options?.includePadding ?? false,
    includeBorder: options?.includeBorder ?? false,
    extraSpace: options?.extraSpace ?? 0,
  };

  // Create hidden mirror element for text measurement
  const mirror = document.createElement("span");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre";
  mirror.style.pointerEvents = "none";
  mirror.textContent = text;

  // Copy font styles from reference element
  const computedStyle = window.getComputedStyle(referenceElement);
  mirror.style.fontSize = computedStyle.fontSize;
  mirror.style.fontFamily = computedStyle.fontFamily;
  mirror.style.fontWeight = computedStyle.fontWeight;
  mirror.style.letterSpacing = computedStyle.letterSpacing;
  mirror.style.fontStyle = computedStyle.fontStyle;
  mirror.style.textTransform = computedStyle.textTransform;

  // Append to DOM to measure (use reference element's parent or body)
  const container = referenceElement.parentElement || document.body;
  container.appendChild(mirror);

  // Measure text width
  let width = mirror.getBoundingClientRect().width;

  // Include padding if requested
  if (opts.includePadding) {
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    width += paddingLeft + paddingRight;
  }

  // Include border if requested
  if (opts.includeBorder) {
    const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
    const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
    width += borderLeft + borderRight;
  }

  // Add extra space
  width += opts.extraSpace;

  // Cleanup
  container.removeChild(mirror);

  return width;
}
