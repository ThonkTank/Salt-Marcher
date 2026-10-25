export function bindAnchoredPopup(trigger: HTMLButtonElement, popup: HTMLElement, width: number) {
  const view = popup.ownerDocument.defaultView!,
    gap = 8;
  const opened = () => popup.matches(':popover-open');
  const visible = (anchor: DOMRect) =>
    trigger.isConnected &&
    anchor.width > 0 &&
    anchor.height > 0 &&
    anchor.right > 0 &&
    anchor.left < view.innerWidth &&
    anchor.bottom > 0 &&
    anchor.top < view.innerHeight;
  const close = () => {
    if (opened()) popup.hidePopover();
    trigger.setAttribute('aria-expanded', 'false');
  };
  const place = () => {
    if (!opened()) return;
    const anchor = trigger.getBoundingClientRect();
    if (!visible(anchor)) {
      close();
      return;
    }
    const below = Math.max(0, view.innerHeight - anchor.bottom - gap * 2),
      above = Math.max(0, anchor.top - gap * 2);
    const height = popup.scrollHeight + 2,
      under = height <= below || below >= above;
    popup.style.maxHeight = (under ? below : above) + 'px';
    const bounds = popup.getBoundingClientRect();
    popup.style.left =
      Math.max(gap, Math.min(anchor.right - bounds.width, view.innerWidth - bounds.width - gap)) +
      'px';
    popup.style.top =
      (under ? anchor.bottom + gap : Math.max(gap, anchor.top - gap - bounds.height)) + 'px';
  };
  popup.style.position = 'fixed';
  popup.style.inset = 'auto';
  popup.style.margin = '0';
  popup.style.width = 'min(' + width + 'px, calc(100vw - ' + gap * 2 + 'px))';
  trigger.setAttribute('aria-controls', popup.id);
  trigger.setAttribute('aria-expanded', 'false');
  // Native auto popovers own Escape, light-dismiss and focus restoration. The
  // invoker is focused before even a programmatic opening captures return focus.
  popup.addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState === 'open') trigger.focus({ preventScroll: true });
  });
  const observer = view.ResizeObserver ? new view.ResizeObserver(place) : null;
  popup.addEventListener('toggle', () => {
    trigger.setAttribute('aria-expanded', String(opened()));
    if (opened()) {
      place();
      view.addEventListener('resize', place);
      view.addEventListener('scroll', place, true);
      observer?.observe(popup);
      observer?.observe(trigger);
    } else {
      view.removeEventListener('resize', place);
      view.removeEventListener('scroll', place, true);
      observer?.disconnect();
    }
  });
  const open = () => {
    if (trigger.disabled || !visible(trigger.getBoundingClientRect())) return false;
    if (!opened())
      (popup.showPopover as (options: { source: HTMLElement }) => void).call(popup, {
        source: trigger,
      });
    trigger.setAttribute('aria-expanded', 'true');
    return true;
  };
  return {
    open,
    close,
    toggle: () => {
      if (opened()) {
        close();
        return false;
      }
      return open();
    },
  };
}
