import type { Hex } from './world-contracts';
type Target = { hex: Hex; x: number; y: number };
/** A transient token gesture. Only the adopter may issue a placement command. */
export function installHexPartyDrag(
  root: SVGSVGElement,
  options: {
    key: () => string | null;
    begin: () => boolean;
    target: (x: number, y: number) => Target | null;
    drop: (hex: Hex, key: string) => Promise<void>;
    status: (text: string, error?: boolean) => void;
  },
) {
  let drag: {
      id: number;
      key: string;
      token: SVGElement;
      transform: string | null;
      x: number;
      y: number;
      clientX: number;
      clientY: number;
      moved: boolean;
    } | null = null,
    suppress = false;
  const cancel = (message?: string) => {
    const d = drag;
    if (!d) return;
    drag = null;
    d.token.removeAttribute('data-placement-draft');
    if (d.transform === null) d.token.removeAttribute('transform');
    else d.token.setAttribute('transform', d.transform);
    d.token.removeAttribute('opacity');
    root.removeAttribute('data-party-dragging');
    if (root.hasPointerCapture(d.id)) root.releasePointerCapture(d.id);
    if (message) options.status(message);
  };
  const current = () => {
    if (drag && options.key() !== drag.key) {
      cancel('Platzierung verworfen · Gruppe oder Karte inzwischen geändert.');
      return false;
    }
    return !!drag;
  };
  root.addEventListener(
    'pointerdown',
    (e) => {
      suppress = false;
      const token = (e.target as Element | null)?.closest<SVGElement>('[data-party-token]');
      if (!token || !root.contains(token) || e.button !== 0 || e.altKey || !e.isPrimary) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      suppress = true;
      if (drag) cancel();
      const key = options.key();
      if (!key || !options.begin()) {
        options.status(
          'Platzierung derzeit nicht verfügbar. Aktuelle Gruppe und Speicherstand prüfen.',
          true,
        );
        return;
      }
      drag = {
        id: e.pointerId,
        key,
        token,
        transform: token.getAttribute('transform'),
        x: Number(token.getAttribute('cx')),
        y: Number(token.getAttribute('cy')),
        clientX: e.clientX,
        clientY: e.clientY,
        moved: false,
      };
      root.setPointerCapture(e.pointerId);
      root.focus();
      root.dataset.partyDragging = 'true';
      options.status('Party-Token ziehen · Loslassen platziert ohne Reisezeit; Escape bricht ab.');
    },
    true,
  );
  root.addEventListener(
    'pointermove',
    (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!current()) return;
      const d = drag!;
      if (!d.moved && Math.hypot(e.clientX - d.clientX, e.clientY - d.clientY) < 4) return;
      d.moved = true;
      const target = options.target(e.clientX, e.clientY);
      d.token.setAttribute('data-placement-draft', target ? 'valid' : 'invalid');
      d.token.setAttribute('opacity', target ? '.7' : '.35');
      if (target) {
        d.token.setAttribute('transform', `translate(${target.x - d.x} ${target.y - d.y})`);
        options.status(
          'Platzieren auf Hex ' + target.hex.q + ',' + target.hex.r + ' · noch nicht bestätigt.',
        );
      } else
        options.status(
          'Hier nicht platzierbar · über ein beschriebenes Hex ziehen oder Escape drücken.',
          true,
        );
    },
    true,
  );
  root.addEventListener(
    'pointerup',
    (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!current()) return;
      const d = drag!,
        target = d.moved ? options.target(e.clientX, e.clientY) : null;
      cancel();
      if (!d.moved) {
        options.status(
          'Standort unverändert · zum Platzieren Token ziehen oder Gruppe am Cursor platzieren verwenden.',
        );
        return;
      }
      if (!target) {
        options.status(
          'Platzierung nicht übernommen · Ziel ist kein beschriebenes Hex dieser Karte.',
          true,
        );
        return;
      }
      options.status('Platzierung wird bestätigt…');
      void options
        .drop(target.hex, d.key)
        .catch((error) => options.status((error as Error).message, true));
    },
    true,
  );
  for (const name of ['pointercancel', 'lostpointercapture'])
    root.addEventListener(
      name,
      () => cancel('Platzierung abgebrochen · Standort unverändert.'),
      true,
    );
  root.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && drag) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel('Platzierung abgebrochen · Standort unverändert.');
      } else if (
        drag &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)
      )
        cancel('Platzierung abgebrochen · Tastaturauswahl übernimmt.');
    },
    true,
  );
  root.ownerDocument.defaultView?.addEventListener('blur', () =>
    cancel('Platzierung abgebrochen · Standort unverändert.'),
  );
  root.addEventListener(
    'click',
    (e) => {
      if (suppress) {
        suppress = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  return {
    get active() {
      return !!drag;
    },
    cancel,
    refresh: current,
  };
}
