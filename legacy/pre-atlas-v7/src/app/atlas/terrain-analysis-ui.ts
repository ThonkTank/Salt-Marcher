import { releaseAtlasUnits, atlasFieldValue, setAtlasFieldValue } from './atlas-units';
import type { Point } from '../shared/contracts';
import type { TerrainProfile } from './terrain-profile';
import type { AtlasEntrance } from './atlas-journey-contracts';

/** Bounded, read-only measurements. Never adds a brush or changes the current author tool. */
export class TerrainAnalysisUI {
  private points: Point[] | null = null;
  private request = 0;
  private identity = '';
  private notice: HTMLOutputElement;
  private dialog: HTMLDialogElement;
  constructor(
    private input: HTMLCanvasElement,
    private host: {
      token: () => string | undefined;
      revision: () => number;
      point: (e: MouseEvent) => Point | null;
      hasDraft: () => boolean;
      error: (e: unknown) => void;
    },
  ) {
    const button = document.createElement('button');
    button.id = 'atlas-height-profile';
    button.textContent = 'Höhenprofil messen';
    this.notice = document.createElement('output');
    this.notice.id = 'terrain-profile-status';
    this.notice.style.cssText =
      'position:absolute;left:12px;bottom:12px;z-index:3;background:#fffaf0;color:#293b30;max-width:80%;';
    this.notice.setAttribute('role', 'status');
    input.parentElement!.append(this.notice);
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'terrain-profile-dialog';
    document.body.append(this.dialog);
    document.getElementById('atlas-view-popup')!.append(button);
    button.onclick = () => {
      if (this.host.hasDraft()) {
        this.host.error(Error('Zuerst die offene Bearbeitung abschließen.'));
        return;
      }
      document.getElementById('atlas-view-popup')!.hidePopover();
      this.points = [];
      this.identity = this.host.token() ?? '';
      this.request++;
      this.notice.textContent = 'Höhenprofil: Startpunkt auf der Karte wählen. Escape bricht ab.';
      this.input.focus();
    };
    // Grandparent capture precedes terrain gestures and the tilted-view canvas handler.
    const root = input.parentElement!.parentElement!;
    for (const name of ['pointerdown', 'pointermove', 'pointerup'] as const)
      root.addEventListener(
        name,
        (e) => {
          if (this.points !== null && e.target === input) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        },
        true,
      );
    root.addEventListener(
      'click',
      (e) => {
        if (this.points === null || e.target !== input) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const p = this.host.point(e);
        if (!p) return;
        this.points.push(p);
        if (this.points.length === 1)
          this.notice.textContent = 'Höhenprofil: Endpunkt wählen. Escape bricht ab.';
        else {
          const points = this.points;
          this.points = null;
          void this.measure(points).catch(this.host.error);
        }
      },
      true,
    );
    root.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.points !== null) {
          this.cancel();
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    document.getElementById('land-tool')!.addEventListener('change', () => this.cancel());
    document.addEventListener('terrain-profile-request', (event) => {
      const detail = (event as CustomEvent<{ points: Point[]; kind: string }>).detail;
      if (this.host.hasDraft()) {
        this.host.error(Error('Zuerst die offene Bearbeitung abschließen.'));
        return;
      }
      this.identity = this.host.token() ?? '';
      void this.measure(detail.points, detail.kind === 'river').catch(this.host.error);
    });
    this.dialog.addEventListener('close', () => input.focus());
  }
  cancel() {
    this.points = null;
    this.request++;
    this.notice.textContent = '';
  }
  sync(token: string, revision: number) {
    if (this.identity && this.identity !== token) {
      this.cancel();
      this.dialog.close();
      this.identity = token;
    }
    if (this.dialog.open && this.dialog.dataset.revision !== String(revision)) {
      const status = this.dialog.querySelector<HTMLElement>('[data-profile-stale]');
      if (status) status.hidden = false;
    }
  }
  private async measure(points: Point[], river = false) {
    const token = this.host.token(),
      request = ++this.request;
    if (!token) return;
    this.notice.textContent = 'Höhenprofil wird gelesen…';
    const reply = await window.campaign.atlasTerrainProfile(token, points);
    if (request !== this.request || token !== this.host.token()) return;
    this.notice.textContent = '';
    if (!reply.ok) throw Error(reply.error);
    if (reply.value.revision !== this.host.revision())
      throw Error('Gelände inzwischen geändert. Profil erneut messen.');
    this.show(reply.value, points, river);
  }
  private show(p: TerrainProfile & { revision: number }, points: Point[], river: boolean) {
    this.dialog.replaceChildren();
    this.dialog.dataset.revision = String(p.revision);
    const title = document.createElement('h2');
    title.textContent = 'Höhenprofil';
    const text = document.createElement('p');
    text.id = 'terrain-profile-summary';
    const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    const min = Math.min(...p.samples.map((s) => s.heightM)),
      max = Math.max(...p.samples.map((s) => s.heightM));
    text.textContent = `${fmt(p.distanceM)} m Strecke · ${fmt(p.ascentM)} m Aufstieg · ${fmt(p.descentM)} m Abstieg · ${fmt(min)} bis ${fmt(max)} m Höhe`;
    const warning = document.createElement('p');
    warning.id = 'terrain-profile-warning';
    warning.textContent =
      river && p.ascentM > 0.1
        ? 'Warnung: Der Fluss steigt in Zeichenrichtung abschnittsweise um insgesamt ' +
          fmt(p.ascentM) +
          ' m an. Der Verlauf bleibt unverändert.'
        : '';
    const resolution = document.createElement('p');
    resolution.textContent = `Profilproben alle höchstens ${fmt(p.sampleSpacingM)} m. Höhenraster bis ${fmt(Math.max(...p.samples.map((s) => s.resolutionM ?? 0)))} m; zwischen den Proben können weitere Formen liegen.`;
    const stale = document.createElement('p');
    stale.dataset.profileStale = 'true';
    stale.hidden = true;
    stale.textContent = 'Gelände geändert: Dieses Profil zeigt den vorherigen Stand.';
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 240;
    canvas.style.cssText = 'display:block;width:100%;max-width:720px;height:auto';
    canvas.setAttribute('aria-label', 'Höhe über Strecke; genaue Werte in der Tabelle');
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f5eddd';
    ctx.fillRect(0, 0, 720, 240);
    ctx.strokeStyle = '#5a6951';
    ctx.lineWidth = 2;
    ctx.beginPath();
    p.samples.forEach((s, i) => {
      const x = 50 + (s.distanceM / p.distanceM) * 640,
        y = 200 - ((s.heightM - min) / Math.max(1, max - min)) * 170;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = '#2e3934';
    ctx.font = '13px sans-serif';
    ctx.fillText(fmt(max) + ' m', 4, 20);
    ctx.fillText(fmt(min) + ' m', 4, 215);
    ctx.fillText('0 m', 50, 234);
    ctx.fillText(fmt(p.distanceM) + ' m', 620, 234);
    const details = document.createElement('details'),
      summary = document.createElement('summary');
    summary.textContent = 'Messwerte: Strecke, Höhe, Hangneigung';
    details.append(summary);
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const h of ['Strecke (m)', 'Höhe (m)', 'Hang (°)']) {
      const cell = document.createElement('th');
      cell.textContent = h;
      head.append(cell);
    }
    for (const s of p.samples) {
      const row = table.insertRow();
      for (const n of [s.distanceM, s.heightM, s.slopeDegrees])
        row.insertCell().textContent = fmt(n);
    }
    details.append(table);
    const refresh = document.createElement('button');
    refresh.textContent = 'Profil aktualisieren';
    refresh.onclick = () => void this.measure(points, river).catch(this.host.error);
    const close = document.createElement('button');
    close.textContent = 'Schließen';
    close.onclick = () => this.dialog.close();
    this.dialog.append(title, text, warning, resolution, stale, canvas, details, refresh, close);
    if (!this.dialog.open) this.dialog.showModal();
  }
}

export async function editEntranceHeight(
  entrances: AtlasEntrance[],
  save: (e: AtlasEntrance) => Promise<void>,
  open: (id: string) => Promise<void>,
  error: (e: unknown) => void,
) {
  if (!entrances.length) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'terrain-entrance-dialog';
  dialog.innerHTML =
    '<h2>Eingangshöhe</h2><label>Eingang<select id="terrain-entrance-choice"></select></label><label>Bindung<select id="terrain-entrance-mode"><option value="ground">Dem Gelände folgen</option><option value="fixed">Feste Höhe</option></select></label><label>Geländeversatz / feste Höhe in m<input id="terrain-entrance-offset" type="number" step="0.1"></label><button id="terrain-entrance-save">Höhe übernehmen</button><button id="terrain-entrance-room">Raum öffnen</button><button id="terrain-entrance-close">Schließen</button>';
  document.body.append(dialog);
  const choice = dialog.querySelector<HTMLSelectElement>('#terrain-entrance-choice')!,
    mode = dialog.querySelector<HTMLSelectElement>('#terrain-entrance-mode')!,
    offset = dialog.querySelector<HTMLInputElement>('#terrain-entrance-offset')!;
  for (const [i, e] of entrances.entries()) {
    const option = document.createElement('option');
    option.value = e.id;
    option.textContent = 'Eingang ' + (i + 1);
    choice.append(option);
  }
  const current = () => entrances.find((e) => e.id === choice.value)!;
  const show = () => {
    mode.value = current().terrain?.mode ?? 'ground';
    setAtlasFieldValue(offset, String(current().terrain?.offsetM ?? 0));
  };
  choice.onchange = show;
  show();
  dialog.querySelector<HTMLButtonElement>('#terrain-entrance-save')!.onclick = async () => {
    const b = dialog.querySelector<HTMLButtonElement>('#terrain-entrance-save')!;
    b.disabled = true;
    try {
      await save({
        ...current(),
        terrain: {
          mode: mode.value as 'ground' | 'fixed',
          offsetM: Number(atlasFieldValue(offset)),
        },
      });
      dialog.close();
    } catch (e) {
      error(e);
      b.disabled = false;
    }
  };
  dialog.querySelector<HTMLButtonElement>('#terrain-entrance-room')!.onclick = () => {
    const id = current().roomId;
    dialog.close();
    void open(id).catch(error);
  };
  dialog.querySelector<HTMLButtonElement>('#terrain-entrance-close')!.onclick = () =>
    dialog.close();
  dialog.addEventListener(
    'close',
    () => {
      releaseAtlasUnits(dialog);
      dialog.remove();
    },
    { once: true },
  );
  dialog.showModal();
}
