import type { WorkspaceGeometry } from '../shared/contracts';
import type { DeskRef } from './scene-desk-contracts';
import type {
  LocationMaterialKind,
  LocationMaterial,
} from '../campaign/location-notebook-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
/** Contextual reads of the existing location owners. Pinning remains an explicit Scene action. */
export class ScenePlaceBinder {
  private epoch = 0;
  constructor(
    private root: HTMLElement,
    private open: (ref: DeskRef, current: () => boolean) => Promise<void>,
    private pin: (ref: DeskRef, current: () => boolean) => Promise<void>,
  ) {}
  reset() {
    this.epoch++;
    this.root.replaceChildren();
    this.root.hidden = true;
  }
  show(owner: WorkspaceGeometry, locationId: string, title: string, owns: () => boolean) {
    this.reset();
    const epoch = this.epoch,
      current = () => epoch === this.epoch && owns();
    this.root.hidden = false;
    this.root.append(
      node('h4', 'Am Ort · ' + title),
      node(
        'p',
        'Ortsgebundene Inhalte öffnen und direkt bearbeiten. Angeheftete Inhalte bleiben auch nach dem Ortswechsel für diese Gruppe griffbereit.',
      ),
    );
    for (const [kind, label] of [
      ['npc', 'NSCs'],
      ['narrative', 'Aufträge und Gerüchte'],
      ['faction', 'Fraktionen'],
    ] as [LocationMaterialKind, string][]) {
      const section = node('section'),
        status = node('p'),
        rows = node('div'),
        more = node('button', 'Weitere ' + label),
        retry = node('button', 'Erneut laden');
      let next: number | null = null,
        busy = false;
      section.dataset.placeKind = kind;
      status.setAttribute('role', 'status');
      more.type = retry.type = 'button';
      more.hidden = retry.hidden = true;
      section.append(node('h5', label), status, rows, more, retry);
      this.root.append(section);
      const action = (
        text: string,
        item: LocationMaterial,
        fn: (ref: DeskRef, current: () => boolean) => Promise<void>,
      ) => {
        const button = node('button', text);
        button.type = 'button';
        button.disabled = !!item.unavailable || !item.ref;
        button.onclick = () => {
          if (!button.isConnected || button.disabled || !current() || !item.ref) return;
          button.disabled = true;
          void fn(item.ref, current)
            .catch((e) => {
              if (current()) status.textContent = (e as Error).message;
            })
            .finally(() => {
              if (current() && button.isConnected) button.disabled = !!item.unavailable;
            });
        };
        return button;
      };
      const load = async (offset: number) => {
        if (!current() || busy) return;
        busy = true;
        more.disabled = true;
        retry.hidden = true;
        status.textContent = 'Wird geladen…';
        try {
          const result = await window.campaign.locationMaterials(owner.token, {
            locationId,
            kind,
            text: '',
            offset,
          });
          if (!current()) return;
          if (!result.ok) throw new Error(result.error);
          if (!offset) rows.replaceChildren();
          for (const item of result.value.items) {
            const row = node('div'),
              detail = node('small', item.detail);
            row.className = 'scene-place-row';
            row.dataset.materialId = item.id;
            row.append(
              action(item.title + ' · öffnen', item, this.open),
              action('An diese Szene heften', item, this.pin),
              detail,
            );
            rows.append(row);
          }
          next = result.value.next;
          more.hidden = next === null;
          status.textContent = rows.childElementCount
            ? rows.childElementCount +
              ' Einträge geladen' +
              (next === null ? '.' : ' · weitere verfügbar.')
            : 'Keine zugeordneten Inhalte.';
        } catch (e) {
          if (current()) {
            status.textContent = 'Nicht verfügbar: ' + (e as Error).message;
            retry.hidden = false;
            retry.onclick = () => void load(offset);
          }
        } finally {
          if (current()) {
            busy = false;
            more.disabled = false;
          }
        }
      };
      more.onclick = () => {
        if (next !== null) void load(next);
      };
      void load(0);
    }
  }
}
