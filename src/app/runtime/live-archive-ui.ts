import { openMaskHistory, closeMaskHistory } from './mask-history-ui';
import type { Result } from '../shared/contracts';
import { formatInstant } from './live-contracts';
import type { CombatState } from './combat-contracts';
import type { ChaseState } from './chase-contracts';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
function paragraph(root: HTMLElement, text: string, className = '') {
  const p = document.createElement('p');
  p.textContent = text;
  if (className) p.className = className;
  root.append(p);
  return p;
}
function loading(root: HTMLElement, text: string) {
  root.replaceChildren();
  root.setAttribute('aria-busy', 'true');
  paragraph(root, text).setAttribute('role', 'status');
}
function failure(root: HTMLElement, error: unknown, retry: () => void, label?: string) {
  root.replaceChildren();
  root.setAttribute('aria-busy', 'false');
  if (label) paragraph(root, label, 'caption');
  paragraph(root, error instanceof Error ? error.message : String(error)).setAttribute(
    'role',
    'alert',
  );
  const button = document.createElement('button');
  button.textContent = 'Erneut laden';
  button.onclick = retry;
  root.append(button);
}
function renderCombat(root: HTMLElement, combat: CombatState) {
  root.replaceChildren();
  const heading = document.createElement('h4');
  heading.textContent = combat.title;
  root.append(heading);
  paragraph(
    root,
    'Kampf · ' +
      (combat.phase === 'retired'
        ? 'archiviert ohne Kampfergebnis'
        : combat.phase === 'finished'
          ? 'abgeschlossen'
          : 'gespeicherter Stand') +
      ' · Runde ' +
      combat.round,
  );
  if (combat.outcome) paragraph(root, 'Ergebnis: ' + combat.outcome);
  if (combat.notes) paragraph(root, combat.notes);
  paragraph(root, combat.participants.length ? 'Teilnehmer:' : 'Keine Teilnehmer.', 'caption');
  for (const p of combat.participants)
    paragraph(
      root,
      p.name +
        ' · Initiative ' +
        p.initiative +
        ' · RK ' +
        (p.armorClass ?? 'offen') +
        ' · ' +
        (p.healthKnown === false ? 'HP offen' : p.hp + ' / ' + p.maxHp + ' HP') +
        ([p.conditions, p.concentrating ? 'Konzentration' : ''].filter(Boolean).length
          ? ' · ' +
            [p.conditions, p.concentrating ? 'Konzentration' : ''].filter(Boolean).join(' · ')
          : ''),
    );
}
function renderChase(root: HTMLElement, chase: ChaseState) {
  root.replaceChildren();
  const heading = document.createElement('h4');
  heading.textContent = chase.title;
  root.append(heading);
  paragraph(
    root,
    'Verfolgung · ' +
      (chase.status === 'retired'
        ? 'archiviert ohne Ergebnis'
        : chase.status === 'finished'
          ? 'abgeschlossen'
          : 'gespeicherter Stand') +
      ' · Runde ' +
      chase.round,
  );
  if (chase.goal) paragraph(root, 'Ziel: ' + chase.goal);
  if (chase.complication) paragraph(root, 'Letzte Komplikation: ' + chase.complication);
  if (chase.outcome) paragraph(root, 'Ergebnis: ' + chase.outcome);
  paragraph(root, chase.participants.length ? 'Teilnehmer:' : 'Keine Teilnehmer.', 'caption');
  for (const p of chase.participants)
    paragraph(
      root,
      p.name +
        ' · ' +
        (p.side === 'pursuer' ? 'Verfolger' : 'Flüchtend') +
        ' · Abstand ' +
        p.distance +
        ' m · Tempo ' +
        p.speed +
        ' m · Erschöpfung ' +
        p.exhaustion +
        (p.notes ? ' · ' + p.notes : ''),
    );
}

/** Read-only archive navigation has its own request lifetime, independent of live focus. */
export function initLiveArchives(
  token: () => string | null,
  flush: () => Promise<boolean>,
  campaignId: () => string | null = () => null,
) {
  let epoch = 0,
    sceneRequest = 0,
    cursor: string | null = null,
    listBusy = false;
  const current = (owner: string, run: number) => token() === owner && epoch === run;
  const invalidate = () => {
    closeMaskHistory();
    epoch++;
    sceneRequest++;
    listBusy = false;
  };
  const list = get('archive-list'),
    detail = get('archive-detail'),
    more = get<HTMLButtonElement>('archive-more'),
    dialog = get<HTMLDialogElement>('archive-dialog');
  const listStatus = document.createElement('div');
  listStatus.id = 'archive-list-status';
  list.before(listStatus);

  async function openScene(owner: string, item: { id: string; title: string }) {
    closeMaskHistory();
    const run = epoch,
      request = ++sceneRequest,
      valid = () => current(owner, run) && request === sceneRequest;
    loading(detail, (item.title || 'Frühere Gruppe') + ' wird geladen…');
    try {
      const [sceneResult, combatResult, chaseResult] = await Promise.all([
        window.campaign.liveScene(owner, item.id),
        window.campaign.combat(owner, item.id),
        window.campaign.chase(owner, item.id),
      ]);
      if (!valid()) return;
      const scene = unwrap(sceneResult),
        combat = unwrap(combatResult),
        chase = unwrap(chaseResult);
      if (
        scene.id !== item.id ||
        !scene.retired ||
        (combat.combat && combat.combat.sceneId !== item.id) ||
        (chase.chase && chase.chase.sceneId !== item.id)
      )
        throw new Error('Der Archivstand gehört nicht zur gewählten früheren Gruppe.');
      detail.replaceChildren();
      const heading = document.createElement('h3');
      heading.textContent = scene.title || 'Unbenannte frühere Gruppe';
      detail.append(heading);
      paragraph(detail, formatInstant(scene.clock.instantMs), 'caption');
      if (scene.notes) paragraph(detail, scene.notes);
      const masks = document.createElement('section'),
        title = document.createElement('h4'),
        buttons = document.createElement('div'),
        maskDetail = document.createElement('div');
      let maskRequest = 0;
      title.textContent = 'Gespeicherte Laufzeitstände';
      buttons.className = 'selection-list';
      maskDetail.id = 'archive-mask-detail';
      const searches = document.createElement('div');
      searches.className = 'toolbar';
      masks.append(title, searches, maskDetail);
      paragraph(
        masks,
        'Direktauswahl: bis zu zehn Stände je Art; weitere über die Suche.',
        'caption',
      );
      masks.append(buttons);
      detail.append(masks);
      async function openMask(kind: 'combat' | 'chase', entry: { id: string; title: string }) {
        const selection = ++maskRequest,
          selected = () => valid() && selection === maskRequest;
        loading(
          maskDetail,
          (kind === 'combat' ? 'Kampf: ' : 'Verfolgung: ') + entry.title + ' wird geladen…',
        );
        try {
          if (kind === 'combat') {
            const result = unwrap(await window.campaign.combat(owner, item.id, entry.id));
            if (!selected()) return;
            if (
              !result.combat ||
              result.combat.id !== entry.id ||
              result.combat.sceneId !== item.id
            )
              throw new Error('Der Kampf gehört nicht zum gewählten Archivstand.');
            renderCombat(maskDetail, result.combat);
          } else {
            const result = unwrap(await window.campaign.chase(owner, item.id, entry.id));
            if (!selected()) return;
            if (!result.chase || result.chase.id !== entry.id || result.chase.sceneId !== item.id)
              throw new Error('Die Verfolgung gehört nicht zum gewählten Archivstand.');
            renderChase(maskDetail, result.chase);
          }
        } catch (error) {
          if (selected())
            failure(
              maskDetail,
              error,
              () => {
                void openMask(kind, entry);
              },
              (kind === 'combat' ? 'Kampf: ' : 'Verfolgung: ') + entry.title,
            );
        } finally {
          if (selected()) {
            maskDetail.setAttribute('aria-busy', 'false');
            maskDetail.scrollIntoView?.({ block: 'nearest' });
          }
        }
      }
      for (const entry of combat.recent.slice(0, 10)) {
        const button = document.createElement('button');
        button.textContent =
          'Kampf: ' +
          entry.title +
          ' · ' +
          (entry.phase === 'retired'
            ? 'archiviert'
            : entry.phase === 'finished'
              ? 'abgeschlossen'
              : entry.phase === 'running'
                ? 'laufend'
                : 'vorbereitet');
        button.onclick = () => {
          void openMask('combat', entry);
        };
        buttons.append(button);
      }
      for (const entry of chase.recent.slice(0, 10)) {
        const button = document.createElement('button');
        button.textContent =
          'Verfolgung: ' +
          entry.title +
          ' · ' +
          (entry.status === 'retired'
            ? 'archiviert'
            : entry.status === 'finished'
              ? 'abgeschlossen'
              : 'laufend');
        button.onclick = () => {
          void openMask('chase', entry);
        };
        buttons.append(button);
      }
      for (const kind of ['combat', 'chase'] as const) {
        const all = document.createElement('button');
        all.type = 'button';
        all.textContent = kind === 'combat' ? 'Alle Kämpfe suchen' : 'Alle Verfolgungen suchen';
        all.onclick = () => {
          const cam = campaignId();
          if (!valid() || !cam) return;
          openMaskHistory({
            token: owner,
            campaignId: cam,
            sceneId: item.id,
            kind,
            current: valid,
            select: (entry) => openMask(kind, entry),
          });
        };
        searches.append(all);
      }
      if (combat.combat) renderCombat(maskDetail, combat.combat);
      else if (chase.chase) renderChase(maskDetail, chase.chase);
      else
        paragraph(
          maskDetail,
          !combat.recent.length && !chase.recent.length
            ? 'Für diese frühere Gruppe sind keine Kämpfe oder Verfolgungen gespeichert.'
            : 'Wähle einen gespeicherten Laufzeitstand aus.',
          'caption',
        );
    } catch (error) {
      if (valid())
        failure(
          detail,
          error,
          () => {
            void openScene(owner, item);
          },
          item.title || 'Frühere Gruppe',
        );
    } finally {
      if (valid()) detail.setAttribute('aria-busy', 'false');
    }
  }
  async function load(reset: boolean) {
    const owner = token();
    if (!owner || listBusy) return;
    const run = epoch;
    listBusy = true;
    more.disabled = true;
    loading(listStatus, 'Frühere Gruppen werden geladen…');
    if (reset) {
      cursor = null;
      list.replaceChildren();
      detail.replaceChildren();
      more.hidden = true;
      sceneRequest++;
    }
    try {
      const page = unwrap(await window.campaign.liveArchives(owner, reset ? null : cursor));
      if (!current(owner, run)) return;
      for (const item of page.items) {
        const button = document.createElement('button');
        button.textContent = item.title || 'Gruppe ' + item.id.slice(0, 8);
        button.onclick = () => {
          void openScene(owner, item);
        };
        list.append(button);
      }
      cursor = page.next;
      more.hidden = cursor === null;
      listStatus.replaceChildren();
      if (!list.children.length) paragraph(listStatus, 'Keine früheren Gruppen gespeichert.');
    } catch (error) {
      if (current(owner, run))
        failure(listStatus, error, () => {
          void load(reset);
        });
    } finally {
      if (current(owner, run)) {
        listBusy = false;
        more.disabled = false;
        listStatus.setAttribute('aria-busy', 'false');
      }
    }
  }
  get('live-archives').onclick = () => {
    const owner = token(),
      run = epoch;
    void (async () => {
      if (!owner || !(await flush()) || !current(owner, run) || dialog.open) return;
      invalidate();
      dialog.showModal();
      void load(true);
    })();
  };
  more.onclick = () => {
    void load(false);
  };
  get('archive-close').onclick = () => dialog.close();
  dialog.addEventListener('close', invalidate);
  return () => {
    invalidate();
    cursor = null;
    list.replaceChildren();
    detail.replaceChildren();
    listStatus.replaceChildren();
  };
}
