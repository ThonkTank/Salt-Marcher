/** Reveal a normalized textarea offset without changing the authored value. */
export function scrollTextareaToOffset(
  area: HTMLTextAreaElement,
  offset: number,
  bounds?: { viewport: HTMLElement; header: HTMLElement },
) {
  if (typeof getComputedStyle !== 'function' || !area.clientWidth) return;
  const mirror = document.createElement('div'),
    marker = document.createElement('span'),
    style = getComputedStyle(area);
  for (const property of [
    'font',
    'letter-spacing',
    'line-height',
    'word-spacing',
    'text-indent',
    'tab-size',
    'padding',
    'white-space',
    'word-break',
    'overflow-wrap',
  ])
    mirror.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(mirror.style, {
    position: 'absolute',
    left: '-10000px',
    top: '0',
    visibility: 'hidden',
    width: area.clientWidth + 'px',
    boxSizing: 'border-box',
    border: '0',
    height: 'auto',
    overflow: 'visible',
  });
  mirror.setAttribute('aria-hidden', 'true');
  mirror.append(document.createTextNode(area.value.slice(0, offset)));
  marker.textContent = area.value.slice(offset) || '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  try {
    let center = area.clientHeight / 2;
    if (bounds) {
      const field = area.getBoundingClientRect(),
        viewport = bounds.viewport.getBoundingClientRect(),
        header = bounds.header.getBoundingClientRect(),
        dialog = bounds.viewport.closest('dialog')?.getBoundingClientRect();
      const top = Math.max(field.top, viewport.top, header.bottom, dialog?.top ?? 0, 0);
      const bottom = Math.min(
        field.bottom,
        viewport.bottom,
        dialog?.bottom ?? window.innerHeight,
        window.innerHeight,
      );
      if (bottom > top) center = (top + bottom) / 2 - field.top - area.clientTop;
    }
    area.scrollTop = Math.max(
      0,
      marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top - center,
    );
  } finally {
    mirror.remove();
  }
}
