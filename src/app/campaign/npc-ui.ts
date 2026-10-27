import { editorInstanceEvents, clearEditorHandlers } from '../shared/editor-instance';
import { createEditorSurface } from '../shared/editor-surface';
import { EditorSession } from '../shared/editor-session';
import type { WorkspaceGeometry, Result } from '../shared/contracts';
import type { NpcDraft, NpcView, NpcCommand, NpcQuery } from './npc-contracts';
import { drawNpcDailyPlan } from './npc-daily-plan-ui';
import {
  rawDailyPlan,
  parseDailyPlan,
  rawDailyOverrides,
  parseDailyOverrides,
} from './npc-daily-plan';

export function createNpcEditor(host: { roots: readonly HTMLElement[]; api: Window['campaign'] }) {
  const { document, get } = createEditorSurface(host.roots);
  const window = { campaign: host.api };
  const { cleanups, listen } = editorInstanceEvents();
  let initialized = false,
    disposed = false;
  const editorSession = new EditorSession();
  const pendingWork = editorSession.operation<Promise<boolean>>();
  const keepingWork = editorSession.operation<Promise<boolean>>();

  const el = get;
  const val = (id: string) => el<HTMLInputElement>('npc-' + id).value;
  const unwrap = <T>(r: Result<T>): T => {
    if (!r.ok) throw new Error(r.error);
    return r.value;
  };
  const names = [
    'name',
    'creature',
    'faction',
    'location',
    'modifier',
    'lifecycle',
    'ancestry',
    'gender',
    'ageYears',
    'dailyPlan',
    'dailyOverrides',
    'appearance',
    'behavior',
    'history',
    'contact',
    'readAloud',
    'gmNotes',
    'hp',
    'maxHp',
    'tempHp',
    'conditions',
  ] as const;
  let workspace: WorkspaceGeometry | null = null,
    draft: NpcDraft | null = null,
    writeId: string | null = null,
    search = 0,
    offset = 0,
    total = 0;
  let listLoading = false,
    listError: string | null = null,
    listKey: string | null = null,
    listTarget = 0,
    listChanged = false,
    listComposing = false,
    listTimer: ReturnType<typeof setTimeout> | null = null;
  let recordRequest = 0,
    recordLoading = false,
    recordError: string | null = null,
    requestedNpc: { id: string; fresh: boolean; label: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let placeNavigation: (id: string) => Promise<void> = async () => {};
  function setNpcPlaceNavigation(open: (id: string) => Promise<void>) {
    placeNavigation = open;
  }
  let tell: (text: string, error?: boolean) => void,
    after: () => Promise<void>,
    enter: (id: string) => Promise<void>;
  function option(select: HTMLSelectElement, id: string, name: string) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    select.append(o);
    return o;
  }
  function populateDraft() {
    for (const name of names) {
      const input = el<HTMLInputElement | HTMLSelectElement>('npc-' + name),
        value = draft!.fields[name] ?? '';
      if (
        (name === 'faction' || name === 'location') &&
        value &&
        ![...(input as HTMLSelectElement).options].some((o) => o.value === value)
      )
        option(input as HTMLSelectElement, value, 'Nicht mehr verfügbar').disabled = true;
      input.value = value;
    }
  }
  function lock() {
    const transient = !!pendingWork.value || recordLoading || !!recordError,
      unresolved = !!draft?.pendingCommand,
      blocked = transient || unresolved;
    const check = el<HTMLButtonElement>('npc-write-check');
    check.hidden = !draft?.pendingCommand;
    check.disabled = !!pendingWork.value || recordLoading || !!recordError;
    el('npc-editor').inert = transient;
    for (const control of el('npc-editor').querySelectorAll<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement
    >('input,button,select,textarea')) {
      const text =
        control.tagName === 'TEXTAREA' ||
        (control.tagName === 'INPUT' && control.getAttribute('type') !== 'checkbox');
      control.disabled = transient || (unresolved && !text);
      if (text)
        (control as HTMLInputElement).readOnly =
          unresolved || (control.id === 'npc-creature' && !!draft?.basis?.actorRevision);
    }
    for (const button of el('npc-creature-results').querySelectorAll<HTMLButtonElement>('button'))
      button.disabled = blocked || !!draft?.basis?.actorRevision;
    el('npc-editor').setAttribute('aria-busy', String(recordLoading));
    const listBlocked = !!pendingWork.value || listLoading || !!listError || listKey !== queryKey();
    el<HTMLButtonElement>('npc-more').disabled = listBlocked || offset + 50 >= total;
    el<HTMLButtonElement>('npc-previous').disabled = listBlocked || offset === 0;
    el('npc-list').setAttribute('aria-busy', String(listLoading));
    const listStatus = el('npc-list-status');
    listStatus.hidden = !listLoading && !listError && !listChanged;
    listStatus.setAttribute('role', listError ? 'alert' : 'status');
    listStatus.textContent = listError
      ? 'NSCs konnten nicht geladen werden: ' + listError
      : listLoading
        ? 'NSCs werden geladen…'
        : 'Suche wird aktualisiert…';
    el('npc-list-retry').hidden = !listError;
    const status = el('npc-load-status'),
      retry = el<HTMLButtonElement>('npc-load-retry');
    status.hidden = !recordLoading && !recordError;
    status.setAttribute('role', recordError ? 'alert' : 'status');
    status.textContent = recordError
      ? (requestedNpc?.label || 'NSC') + ' konnte nicht geladen werden: ' + recordError
      : recordLoading
        ? (requestedNpc?.label || 'NSC') + ' wird geladen…'
        : '';
    retry.hidden = !recordError;
    retry.disabled = recordLoading || !!pendingWork.value;
  }
  const run = (fn: () => Promise<unknown>) => void fn().catch((e) => tell(e.message, true));
  function capture() {
    if (!draft || recordError || pendingWork.value || draft.pendingCommand) return;
    for (const id of names) {
      const value = val(id),
        previous = draft.fields[id] ?? '';
      if (value !== previous.replace(/\r\n?/g, '\n')) draft.fields[id] = value;
    }
    draft.concentrating = el<HTMLInputElement>('npc-concentrating').checked;
    editorSession.input.version++;
    el('npc-save-status').textContent = 'Eingabe offen.';
    if (timer) clearTimeout(timer);
    const g = editorSession.generation,
      d = draft;
    timer = setTimeout(() => {
      if (g === editorSession.generation && draft === d) run(keep);
    }, 500);
  }
  async function keep(): Promise<boolean> {
    if (timer) clearTimeout(timer);
    timer = null;
    if (keepingWork.value) {
      if (!(await keepingWork.value)) return false;
      return keep();
    }
    if (
      !workspace ||
      !draft ||
      draft.pendingCommand ||
      editorSession.input.retained === editorSession.input.version
    )
      return true;
    const w = workspace,
      g = editorSession.generation,
      n = editorSession.input.version,
      d = { ...structuredClone(draft), writeId: crypto.randomUUID() },
      expected = writeId;
    const task = Promise.resolve().then(async () => {
      try {
        unwrap(await window.campaign.keepNpcDraft(w.token, d, expected));
        if (workspace?.token !== w.token || g !== editorSession.generation) return true;
        writeId = d.writeId;
        draft!.writeId = d.writeId;
        editorSession.input.retained = n;
        el('npc-save-status').textContent = 'Entwurf gesichert · noch nicht übernommen.';
        return true;
      } catch (e) {
        if (workspace?.token === w.token && g === editorSession.generation)
          tell((e as Error).message, true);
        return false;
      }
    });
    keepingWork.value = task;
    return task;
  }
  async function flushNpcs() {
    const current = editorSession.capture();
    if ((pendingWork.value && !(await pendingWork.value)) || !current()) return false;
    if (!(await keep()) || !current()) return false;
    return (
      (editorSession.input.retained === editorSession.input.version || (await keep())) && current()
    );
  }
  function activateNpcs(w: WorkspaceGeometry) {
    workspace = w;
    editorSession.generation++;
    search++;
    if (listTimer) clearTimeout(listTimer);
    listTimer = null;
    listLoading = false;
    listError = null;
    listKey = null;
    listChanged = false;
    listComposing = false;
    offset = total = 0;
    el<HTMLInputElement>('npc-search').value = '';
    el<HTMLSelectElement>('npc-filter-life').value = 'all';
    el<HTMLSelectElement>('npc-filter-faction').value = '';
    el<HTMLSelectElement>('npc-filter-location').value = '';
    recordRequest++;
    recordLoading = false;
    recordError = null;
    requestedNpc = null;
    draft = null;
    writeId = null;
    editorSession.input.version = editorSession.input.retained = 0;
    pendingWork.value = null;
    keepingWork.value = null;
    if (timer) clearTimeout(timer);
    timer = null;
    el('npc-editor').hidden = true;
    el('npc-list').replaceChildren();
    el('npc-drafts').replaceChildren();
    lock();
  }
  function query(): Omit<NpcQuery, 'offset'> {
    return {
      text: el<HTMLInputElement>('npc-search').value,
      lifecycle: el<HTMLSelectElement>('npc-filter-life').value as NpcQuery['lifecycle'],
      factionId: el<HTMLSelectElement>('npc-filter-faction').value || null,
      locationId: el<HTMLSelectElement>('npc-filter-location').value || null,
    };
  }
  const queryKey = () => JSON.stringify(query());
  function invalidateList() {
    if (listTimer) clearTimeout(listTimer);
    listTimer = null;
    search++;
    listLoading = false;
    listError = null;
    listKey = null;
    listChanged = true;
    offset = total = 0;
    el('npc-list').replaceChildren();
    el('npc-page').textContent = '';
    lock();
  }
  function scheduleSearch() {
    invalidateList();
    if (!listComposing)
      listTimer = setTimeout(() => {
        void openNpcs();
      }, 200);
  }
  async function openNpcs(reset = true, target = reset ? 0 : offset) {
    if (listTimer) clearTimeout(listTimer);
    listTimer = null;
    if (!workspace) return;
    const w = workspace,
      g = editorSession.generation,
      s = ++search,
      q = query(),
      key = JSON.stringify(q),
      current = () =>
        workspace?.token === w.token &&
        g === editorSession.generation &&
        s === search &&
        key === queryKey();
    listLoading = true;
    listError = null;
    listChanged = false;
    listTarget = target;
    el('npc-list').replaceChildren();
    el('npc-page').textContent = '';
    lock();
    try {
      if (!(await flushNpcs())) {
        if (current()) throw new Error('Offene Eingabe zuerst sichern und erneut suchen.');
        return;
      }
      if (!current()) return;
      const [sources, page, drafts] = await Promise.all([
        window.campaign.generationSources(w.token),
        window.campaign.npcs(w.token, { ...q, offset: target }),
        window.campaign.npcDrafts(w.token),
      ]);
      if (!current()) return;
      const refs = unwrap(sources),
        entries = unwrap(drafts);
      let result = unwrap(page);
      if (result.total > 0 && target >= result.total) {
        target = Math.floor((result.total - 1) / 50) * 50;
        listTarget = target;
        result = unwrap(await window.campaign.npcs(w.token, { ...q, offset: target }));
        if (!current()) return;
      }
      if (result.offset !== target)
        throw new Error('Die NSC-Seite gehört nicht zur angefragten Auswahl.');
      for (const [id, items, empty] of [
        ['npc-filter-faction', refs.factions, 'Alle Fraktionen'],
        ['npc-filter-location', refs.locations, 'Alle Orte'],
        ['npc-faction', refs.factions, 'Ohne Fraktion'],
        ['npc-location', refs.locations, 'Ohne Ort'],
      ] as const) {
        const select = el<HTMLSelectElement>(id),
          old = select.value;
        select.replaceChildren();
        option(select, '', empty);
        for (const p of items) option(select, p.id, p.name);
        if (old && !items.some((p) => p.id === old))
          option(select, old, 'Nicht mehr verfügbar').disabled =
            id === 'npc-faction' || id === 'npc-location';
        select.value = old;
      }
      const root = el('npc-list');
      for (const row of result.rows) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent =
          row.name +
          ' · ' +
          (row.lifecycle === 'defeated'
            ? 'besiegt'
            : { friendly: 'verbündet', neutral: 'neutral', hostile: 'feindlich' }[row.role]) +
          (row.factionId
            ? ' · ' +
              (refs.factions.find((f) => f.id === row.factionId)?.name ??
                'Fraktion nicht verfügbar')
            : '');
        b.onclick = () => run(() => select(row.id, false, row.name));
        root.append(b);
      }
      offset = result.total === 0 ? 0 : target;
      total = result.total;
      listKey = key;
      el('npc-page').textContent = total
        ? offset + 1 + '–' + Math.min(offset + 50, total) + ' von ' + total + ' NSCs'
        : 'Keine passenden NSCs.';
      const draftsRoot = el('npc-drafts');
      draftsRoot.replaceChildren();
      for (const d of entries) {
        const b = document.createElement('button');
        b.textContent = 'Entwurf: ' + d.name;
        b.onclick = () => run(() => select(d.id, false, d.name));
        draftsRoot.append(b);
      }
    } catch (error) {
      if (current()) {
        listError = (error as Error).message;
      }
    } finally {
      if (current()) {
        listLoading = false;
        lock();
      }
    }
  }

  function fromView(v: NpcView | null, id: string): NpcDraft {
    return {
      id,
      writeId: '',
      basis: v,
      concentrating: v?.health?.concentrating ?? false,
      fields: {
        dailyOverrides: JSON.stringify(rawDailyOverrides(v?.record.dailyOverrides)),
        dailyPlan: JSON.stringify(rawDailyPlan(v?.record.dailyPlan)),
        name: v?.name ?? '',
        creature: v?.creatureId ?? '',
        faction: v?.record.factionId ?? '',
        location: v?.locationId ?? '',
        modifier: String(v?.record.modifier ?? 0),
        lifecycle: v?.record.lifecycle ?? 'active',
        ancestry: v?.record.demographics?.ancestry ?? '',
        gender: v?.record.demographics?.gender ?? '',
        ageYears:
          v?.record.demographics?.ageYears === null ||
          v?.record.demographics?.ageYears === undefined
            ? ''
            : String(v.record.demographics.ageYears),
        appearance: v?.record.appearance ?? '',
        behavior: v?.record.behavior ?? '',
        history: v?.record.history ?? '',
        contact: '',
        readAloud: v?.readAloud ?? '',
        gmNotes: v?.gmNotes ?? '',
        hp: String(v?.health?.hp ?? ''),
        maxHp: String(v?.health?.maxHp ?? ''),
        tempHp: String(v?.health?.tempHp ?? 0),
        conditions: v?.health?.conditions ?? '',
      },
    };
  }
  async function select(
    id: string,
    fresh = false,
    label = 'NSC',
    initial?: { name: string; locationId: string },
  ) {
    if (!workspace || pendingWork.value) return;
    const prior = draft,
      priorVersion = editorSession.input.version;
    const w = workspace,
      g = editorSession.generation,
      s = ++recordRequest,
      current = () =>
        workspace?.token === w.token && g === editorSession.generation && s === recordRequest;
    requestedNpc = { id, fresh, label };
    recordLoading = true;
    recordError = null;
    lock();
    try {
      if (!(await flushNpcs()) || !current()) return;
      const stored = fresh ? null : unwrap(await window.campaign.npcDraft(w.token, id));
      if (!current()) return;
      const v = stored
        ? stored.basis
        : fresh
          ? null
          : unwrap(await window.campaign.npc(w.token, id));
      if (!current()) return;
      if (
        (stored && (stored.id !== id || (stored.basis && stored.basis.id !== id))) ||
        (v && v.id !== id)
      )
        throw new Error('NSC-Antwort gehört zu einer anderen Figur.');
      const loaded = stored ?? fromView(v, id),
        retainInput =
          prior?.id === id && draft === prior && editorSession.input.version !== priorVersion;
      draft = retainInput ? prior : loaded;
      if (fresh && initial) {
        draft.fields.name = initial.name;
        draft.fields.location = initial.locationId;
      }
      if (!retainInput) {
        writeId = stored?.writeId ?? null;
        editorSession.input.version = stored || fresh ? 1 : 0;
        editorSession.input.retained = stored ? 1 : 0;
      }
      populateDraft();
      const calendar = unwrap(await window.campaign.npcPlanCalendar(w.token));
      if (!current()) return;
      drawNpcDailyPlan(
        el<HTMLInputElement>('npc-dailyPlan'),
        el<HTMLInputElement>('npc-dailyOverrides'),
        calendar,
        [...el<HTMLSelectElement>('npc-location').options]
          .filter((o) => o.value && !o.disabled)
          .map((o) => ({ id: o.value, name: o.textContent ?? o.value })),
      );
      el<HTMLInputElement>('npc-concentrating').checked = draft.concentrating;
      el('npc-editor').hidden = false;
      el('npc-creature-results').replaceChildren();
      el<HTMLInputElement>('npc-creature').readOnly = !!v?.actorRevision;
      el('npc-disposition').textContent = v
        ? 'Haltung ' +
          v.disposition +
          ' · ' +
          { friendly: 'verbündet', neutral: 'neutral', hostile: 'feindlich' }[v.role]
        : 'Neuer NPC · ohne Kreatur auch rein erzählerisch verwendbar.';
      el('npc-save-status').textContent = stored?.pendingCommand
        ? 'Übernahme ungeklärt. Originalauftrag prüfen; Eingaben bleiben gesichert.'
        : stored
          ? 'Gesicherter Entwurf wiederaufgenommen.'
          : 'Gespeicherter Stand.';
      if (fresh) await keep();
    } catch (e) {
      if (current()) {
        recordError = (e as Error).message;
        tell(recordError, true);
      }
    } finally {
      if (current()) {
        recordLoading = false;
        lock();
      }
    }
  }
  async function apply() {
    if (
      !workspace ||
      !draft ||
      draft.pendingCommand ||
      pendingWork.value ||
      recordLoading ||
      recordError
    )
      return false;
    const owner = draft,
      generationAtStart = editorSession.generation;
    if (
      !(await flushNpcs()) ||
      draft !== owner ||
      generationAtStart !== editorSession.generation ||
      pendingWork.value ||
      recordLoading ||
      recordError
    )
      return false;
    const w = workspace,
      g = editorSession.generation,
      d = structuredClone(draft),
      basis = d.basis,
      f = d.fields;
    const number = (key: string) => {
        if (!/^-?\d+$/.test(f[key] ?? '')) throw new Error('Ganze Zahl für ' + key + ' eingeben.');
        return Number(f[key]);
      },
      age = !f.ageYears?.trim() ? null : number('ageYears');
    if (age !== null && (age < 0 || age > 2000))
      throw new Error('Alter zwischen 0 und 2000 Jahren eingeben.');
    const c: NpcCommand = {
      commandId: crypto.randomUUID(),
      campaignId: w.campaign.id,
      token: w.token,
      draftWriteId: writeId ?? undefined,
      expectedNoteRevision: basis?.noteRevision ?? null,
      expectedRecordRevision: basis?.record.revision ?? 0,
      expectedActorRevision: basis?.actorRevision ?? null,
      expectedPositionRevision: basis?.positionRevision ?? null,
      npc: {
        id: d.id,
        name: f.name!,
        creatureId: f.creature || null,
        readAloud: f.readAloud!,
        gmNotes: f.gmNotes!,
        locationId: f.location || null,
        record: {
          id: d.id,
          revision: basis?.record.revision ?? 0,
          factionId: f.faction || null,
          modifier: number('modifier'),
          lifecycle: f.lifecycle as 'active' | 'defeated',
          appearance: f.appearance!,
          behavior: f.behavior!,
          history:
            (f.history ?? '') + (f.contact?.trim() ? (f.history ? '\n\n' : '') + f.contact : ''),
          dailyPlan: parseDailyPlan(f.dailyPlan ?? '[]'),
          dailyOverrides: parseDailyOverrides(f.dailyOverrides ?? '[]'),
          demographics: {
            ancestry: (f.ancestry ?? '').trim(),
            gender: (f.gender ?? '').trim(),
            ageYears: age,
          },
        },
        health:
          f.creature && f.hp !== '' && f.maxHp !== ''
            ? {
                hp: number('hp'),
                maxHp: number('maxHp'),
                tempHp: number('tempHp'),
                conditions: f.conditions!,
                concentrating: d.concentrating,
              }
            : null,
      },
    };

    const armed = { ...d, writeId: crypto.randomUUID() };
    c.draftWriteId = armed.writeId;
    armed.pendingCommand = c;
    delete armed.rejectedCommand;
    const expectedDraft = writeId;
    let staged = false;
    const task = Promise.resolve().then(async () => {
      try {
        if (workspace?.token !== w.token || g !== editorSession.generation) return false;
        unwrap(await window.campaign.keepNpcDraft(w.token, armed, expectedDraft));
        if (workspace?.token !== w.token || g !== editorSession.generation) return false;
        draft = armed;
        writeId = armed.writeId;
        editorSession.input.version++;
        editorSession.input.retained = editorSession.input.version;
        staged = true;
        unwrap(await window.campaign.executeNpc(c));
        if (workspace?.token !== w.token || g !== editorSession.generation) return false;
        return await finish(c, w, g);
      } catch (e) {
        if (workspace?.token !== w.token || g !== editorSession.generation) return false;
        tell((e as Error).message, true);
        if (staged)
          el('npc-save-status').textContent =
            'Übernahme ungeklärt. Originalauftrag prüfen; Eingaben bleiben gesichert.';
        else {
          pendingWork.value = null;
          await select(d.id);
        }
        return false;
      } finally {
        if (workspace?.token === w.token && g === editorSession.generation) {
          pendingWork.clear(task);
          lock();
        }
      }
    });
    pendingWork.value = task;
    lock();
    return task;
  }
  async function finish(c: NpcCommand, w: WorkspaceGeometry, g: number): Promise<boolean> {
    if (workspace?.token !== w.token || g !== editorSession.generation) return false;
    const result = unwrap(await window.campaign.reconcileNpc(c, w.token));
    if (workspace?.token !== w.token || g !== editorSession.generation) return false;
    if (result.outcome === 'not-applied') {
      if (result.draft.id !== c.npc.id || result.draft.pendingCommand)
        throw new Error('NPC-Auftragsprüfung gehört nicht zum ursprünglichen Entwurf.');
      draft = result.draft;
      writeId = draft.writeId;
      editorSession.input.version++;
      editorSession.input.retained = editorSession.input.version;
      populateDraft();
      const resumedDraft = draft,
        calendar = unwrap(await window.campaign.npcPlanCalendar(w.token));
      if (workspace?.token !== w.token || g !== editorSession.generation || draft !== resumedDraft)
        return false;
      drawNpcDailyPlan(
        el<HTMLInputElement>('npc-dailyPlan'),
        el<HTMLInputElement>('npc-dailyOverrides'),
        calendar,
        [...el<HTMLSelectElement>('npc-location').options]
          .filter((o) => o.value && !o.disabled)
          .map((o) => ({ id: o.value, name: o.textContent ?? o.value })),
      );
      el<HTMLInputElement>('npc-concentrating').checked = draft.concentrating;
      el('npc-save-status').textContent =
        'Nicht übernommen. Eingaben gesichert; erneut übernehmen ist eine neue ausdrückliche Aktion.';
      return false;
    }
    if (result.value.id !== c.npc.id) throw new Error('NPC-Beleg gehört zu einer anderen Figur.');
    writeId = null;
    draft = null;
    editorSession.input.version = editorSession.input.retained = 0;
    pendingWork.value = null;
    await select(c.npc.id);
    if (workspace?.token !== w.token || g !== editorSession.generation) return false;
    await openNpcs(false);
    if (workspace?.token !== w.token || g !== editorSession.generation) return false;
    await after();
    if (workspace?.token === w.token && g === editorSession.generation)
      tell('NPC-Weltprofil anhand des Originalbelegs bestätigt.');
    return true;
  }
  async function checkWrite() {
    const w = workspace,
      c = draft?.pendingCommand,
      g = editorSession.generation;
    if (!w || !c || pendingWork.value || recordLoading || recordError) return;
    const task = Promise.resolve().then(async () => {
      try {
        return await finish(c, w, g);
      } catch (e) {
        if (workspace?.token === w.token && g === editorSession.generation)
          tell((e as Error).message, true);
        return false;
      } finally {
        if (workspace?.token === w.token && g === editorSession.generation) {
          pendingWork.clear(task);
          lock();
        }
      }
    });
    pendingWork.value = task;
    lock();
    await task;
  }

  async function createNpcAtLocation(locationId: string, name: string) {
    const w = workspace,
      g = editorSession.generation;
    if (
      !w ||
      !(await flushNpcs()) ||
      workspace?.token !== w.token ||
      g !== editorSession.generation
    )
      throw new Error('NSC-Kontext geändert.');
    await openNpcs();
    if (workspace?.token !== w.token || g !== editorSession.generation)
      throw new Error('Kampagne gewechselt.');
    if (![...el<HTMLSelectElement>('npc-location').options].some((o) => o.value === locationId))
      throw new Error('Ort für neuen NSC nicht verfügbar.');
    const id = crypto.randomUUID();
    await select(id, true, name, { name, locationId });
    if (
      workspace?.token !== w.token ||
      g !== editorSession.generation ||
      draft?.id !== id ||
      recordError ||
      !(await apply())
    )
      throw new Error('Neuer NSC ist noch nicht übernommen. Entwurf im Weltprofil prüfen.');
    el('npc-editor').scrollIntoView({ block: 'start' });
    el('npc-appearance').focus();
    return id;
  }
  async function prepareNpcLocation(id: string, locationId: string) {
    const w = workspace,
      g = editorSession.generation;
    await openNpcProfile(id);
    if (
      !w ||
      workspace?.token !== w.token ||
      editorSession.generation !== g ||
      draft?.id !== id ||
      recordLoading ||
      recordError
    )
      throw new Error('NSC für Ortsbindung nicht verfügbar.');
    if (![...el<HTMLSelectElement>('npc-location').options].some((o) => o.value === locationId))
      throw new Error('Zielort nicht verfügbar.');
    el<HTMLSelectElement>('npc-location').value = locationId;
    capture();
    if (!(await keep())) throw new Error('Offene Ortsbindung im NSC-Profil sichern.');
    el('npc-save-status').textContent =
      'Zielort vorbelegt · NPC übernehmen bestätigt das Weltprofil. Andere offene Angaben bleiben erhalten.';
    el('npc-location').focus();
  }
  async function openNpcProfile(
    id: string,
    contact?: { date: string; sceneTitle: string },
    stillCurrent: () => boolean = () => true,
  ) {
    const token = workspace?.token;
    if (!token || !stillCurrent() || !(await flushNpcs()) || !stillCurrent()) return;
    await openNpcs();
    if (workspace?.token !== token || !stillCurrent()) return;
    await select(id);
    if (
      workspace?.token !== token ||
      !stillCurrent() ||
      draft?.id !== id ||
      recordLoading ||
      recordError
    )
      return;
    if (draft.pendingCommand) {
      el('npc-write-check').focus();
      return;
    }
    if (contact) {
      const owner = draft,
        input = el<HTMLTextAreaElement>('npc-contact');
      if (!draft.fields.contact) {
        draft.fields.contact = contact.date + ' · ' + contact.sceneTitle + '\n';
        input.value = draft.fields.contact;
        capture();
        await keep();
      }
      if (workspace?.token !== token || draft !== owner || !stillCurrent()) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.scrollIntoView({ block: 'center' });
    } else {
      el('npc-editor').scrollIntoView({ block: 'start' });
      el('npc-name').focus();
    }
  }

  function initNpcs(status: typeof tell, changed: typeof after, onEnter: typeof enter) {
    if (initialized || disposed) throw new Error('Editor already initialized or disposed');
    initialized = true;
    tell = status;
    after = changed;
    enter = onEnter;
    const root = document.createElement('section');
    root.id = 'npcs';
    root.innerHTML =
      '<h2>Einzelne NSCs</h2><form id="npc-search-form"><div class="toolbar"><label>Suche <input id="npc-search" type="search" placeholder="Name, Notiz oder Beschreibung"></label><label>Status <select id="npc-filter-life"><option value="all">Alle</option><option value="active">Aktiv</option><option value="defeated">Besiegt</option></select></label><label>Fraktion <select id="npc-filter-faction"><option value="">Alle Fraktionen</option></select></label><label>Ort <select id="npc-filter-location"><option value="">Alle Orte</option></select></label><button type="submit">Suchen</button><button id="npc-new" type="button">NPC anlegen</button></div></form><p id="npc-page"></p><div id="npc-list" class="selection-list"></div><div class="toolbar"><button id="npc-previous" type="button">Vorherige 50</button><button id="npc-more" type="button">Nächste 50</button></div><p id="npc-list-status" role="status" hidden></p><button id="npc-list-retry" type="button" hidden>Suche erneut laden</button><details><summary>Offene Entwürfe</summary><div id="npc-drafts"></div></details><p id="npc-load-status" role="status" hidden></p><button id="npc-load-retry" type="button" hidden>NSC erneut laden</button><p id="npc-save-status" role="status"></p><button id="npc-write-check" type="button" aria-describedby="npc-save-status" hidden>Originalauftrag prüfen</button><form id="npc-editor" hidden><h3>Weltprofil</h3><p id="npc-disposition"></p><div class="toolbar"><button type="submit">NPC übernehmen</button><button id="npc-reload" type="button">Entwurf verwerfen</button><button id="npc-enter" type="button">In aktuelle Begegnung übernehmen</button></div><div id="npc-fields"></div><label><input id="npc-concentrating" type="checkbox"> Konzentration</label><div class="toolbar"><label>Kreatur suchen <input id="npc-creature-search" type="search"></label><button id="npc-creature-find" type="button">Katalog durchsuchen</button></div><div id="npc-creature-results" class="selection-list"></div><p class="caption">Besiegt sperrt neue Begegnungsteilnahme. Laufende Masken bleiben bestehen. Reaktivierung ändert keine HP. Weltfolgen werden ausdrücklich durch die Spielleitung bestätigt.</p></form>';
    el('groups').prepend(root);
    const siteButton = document.createElement('button');
    siteButton.id = 'npc-places-open';
    siteButton.type = 'button';
    siteButton.textContent = 'Wohnorte, Arbeit und Dungeonraum…';
    siteButton.onclick = () =>
      run(async () => {
        const owner = workspace,
          token = owner?.token,
          id = draft?.id,
          g = editorSession.generation,
          r = recordRequest;
        if (
          !id ||
          !draft?.basis ||
          !(await flushNpcs()) ||
          workspace !== owner ||
          workspace?.token !== token ||
          editorSession.generation !== g ||
          recordRequest !== r ||
          draft?.id !== id ||
          recordLoading ||
          recordError
        )
          return;
        await placeNavigation(id);
      });
    el('npc-editor').querySelector('.toolbar')!.append(siteButton);
    const fields = el('npc-fields'),
      labels: Record<string, string> = {
        name: 'Name',
        creature: 'Kreaturreferenz (optional)',
        faction: 'Fraktion',
        location: 'Ort',
        modifier: 'Persönliche Haltung −100 bis 100',
        lifecycle: 'Lebenszyklus',
        ancestry: 'Herkunft / Spezies',
        gender: 'Geschlecht',
        ageYears: 'Alter in Jahren',
        appearance: 'Aussehen',
        behavior: 'Verhalten',
        history: 'Geschichte',
        contact: 'Neues Gespräch / Beobachtung (beim Übernehmen anhängen)',
        readAloud: 'Zum Vorlesen',
        gmNotes: 'GM-Notizen',
        hp: 'Aktuelle HP',
        maxHp: 'Maximale HP',
        tempHp: 'Temporäre HP',
        conditions: 'Zustände',
      };
    for (const id of names) {
      const label = document.createElement('label'),
        input = ['faction', 'location', 'lifecycle'].includes(id)
          ? document.createElement('select')
          : ['appearance', 'behavior', 'history', 'contact', 'readAloud', 'gmNotes'].includes(id)
            ? document.createElement('textarea')
            : document.createElement('input');
      label.textContent = labels[id]!;
      input.id = 'npc-' + id;
      if (id === 'dailyPlan' || id === 'dailyOverrides') {
        (input as HTMLInputElement).type = 'hidden';
        label.hidden = true;
      }
      if (id === 'ageYears') {
        (input as HTMLInputElement).type = 'number';
        (input as HTMLInputElement).min = '0';
        (input as HTMLInputElement).max = '2000';
        (input as HTMLInputElement).step = '1';
      }
      if (input instanceof document.defaultView!.HTMLSelectElement) {
        option(input, '', id === 'lifecycle' ? 'Aktiv' : 'Keine Auswahl');
        if (id === 'lifecycle') {
          input.replaceChildren();
          option(input, 'active', 'Aktiv');
          option(input, 'defeated', 'Besiegt');
        }
      }
      label.append(input);
      fields.append(label);
    }
    el('npc-write-check').onclick = () => run(checkWrite);
    el<HTMLFormElement>('npc-editor').oninput = capture;
    el<HTMLFormElement>('npc-editor').onsubmit = (e) => {
      e.preventDefault();
      run(apply);
    };
    el<HTMLFormElement>('npc-search-form').onsubmit = (e) => {
      e.preventDefault();
      run(() => openNpcs());
    };
    el('npc-load-retry').onclick = () => {
      const target = requestedNpc;
      if (target) run(() => select(target.id, target.fresh, target.label));
    };
    el('npc-new').onclick = () => run(() => select(crypto.randomUUID(), true));
    el('npc-more').onclick = () => {
      if (!el<HTMLButtonElement>('npc-more').disabled) void openNpcs(false, offset + 50);
    };
    el('npc-previous').onclick = () => {
      if (!el<HTMLButtonElement>('npc-previous').disabled)
        void openNpcs(false, Math.max(0, offset - 50));
    };
    el('npc-list-retry').onclick = () => void openNpcs(false, listTarget);
    listen(el('npc-search'), 'input', scheduleSearch);
    listen(el('npc-search'), 'compositionstart', () => {
      listComposing = true;
      invalidateList();
    });
    listen(el('npc-search'), 'compositionend', () => {
      listComposing = false;
      scheduleSearch();
    });
    for (const id of ['npc-filter-life', 'npc-filter-faction', 'npc-filter-location'])
      listen(el(id), 'change', () => {
        invalidateList();
        void openNpcs();
      });
    el('npc-reload').onclick = () =>
      run(async () => {
        const w = workspace,
          g = editorSession.generation,
          d = draft;
        if (
          !w ||
          !d ||
          d.pendingCommand ||
          recordLoading ||
          recordError ||
          !(await flushNpcs()) ||
          recordLoading ||
          recordError ||
          workspace?.token !== w.token ||
          g !== editorSession.generation ||
          draft !== d
        )
          return;
        const n = editorSession.input.version,
          id = d.id,
          exists = !!d.basis;
        if (writeId) unwrap(await window.campaign.discardNpcDraft(w.token, id, writeId));
        if (workspace?.token !== w.token || g !== editorSession.generation || draft !== d) return;
        writeId = null;
        if (editorSession.input.version !== n) {
          editorSession.input.retained = -1;
          await keep();
          return;
        }
        draft = null;
        editorSession.input.version = editorSession.input.retained = 0;
        if (exists) await select(id);
        else el('npc-editor').hidden = true;
        await openNpcs(false);
      });
    el('npc-enter').onclick = () =>
      run(async () => {
        const id = draft?.id,
          w = workspace,
          g = editorSession.generation;
        if (
          id &&
          (await apply()) &&
          workspace?.token === w?.token &&
          g === editorSession.generation
        )
          await enter(id);
      });
    el('npc-creature-find').onclick = () =>
      run(async () => {
        const w = workspace,
          g = editorSession.generation,
          d = draft;
        if (!w || !d || d.pendingCommand || recordLoading || recordError || pendingWork.value)
          return;
        const result = unwrap(
          await window.campaign.creatures({
            text: el<HTMLInputElement>('npc-creature-search').value,
            offset: 0,
            limit: 25,
          }),
        );
        if (
          workspace?.token !== w.token ||
          g !== editorSession.generation ||
          draft !== d ||
          recordLoading ||
          recordError
        )
          return;
        const root = el('npc-creature-results');
        root.replaceChildren();
        for (const c of result.rows) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = c.name + ' · ' + c.hp + ' HP';
          b.disabled = !!d.basis?.actorRevision;
          b.onclick = () => {
            el<HTMLInputElement>('npc-creature').value = c.id;
            el<HTMLInputElement>('npc-hp').value = String(c.hp);
            el<HTMLInputElement>('npc-maxHp').value = String(c.hp);
            el<HTMLInputElement>('npc-tempHp').value = '0';
            capture();
          };
          root.append(b);
        }
      });
  }

  editorSession.onDeactivate(() => {
    if (timer) clearTimeout(timer);
    timer = null;
  });

  editorSession.observeDraft(() => ({
    openInput: editorSession.input.version !== editorSession.input.retained,
    retainedDraft: !!draft && !!writeId,
    unresolvedCommand: !!draft?.pendingCommand,
  }));

  async function dispose(): Promise<boolean> {
    if (disposed) return true;
    if (initialized && !(await flushNpcs())) return false;
    await editorSession.settle();
    disposed = true;
    editorSession.deactivate();
    workspace = null;
    for (const cleanup of cleanups) cleanup();
    if (initialized) {
      clearEditorHandlers(el('npcs'));
      if (timer) clearTimeout(timer);
      if (listTimer) clearTimeout(listTimer);
      el('npcs').remove();
    }
    return true;
  }
  function alive<T extends (...args: never[]) => unknown>(fn: T): T {
    return ((...args: never[]) => {
      if (disposed) throw new Error('Editor disposed');
      return fn(...args);
    }) as T;
  }
  return {
    editorSession,
    setNpcPlaceNavigation: alive(setNpcPlaceNavigation),
    flushNpcs: alive(flushNpcs),
    activateNpcs: alive(activateNpcs),
    openNpcs: alive(openNpcs),
    createNpcAtLocation: alive(createNpcAtLocation),
    prepareNpcLocation: alive(prepareNpcLocation),
    openNpcProfile: alive(openNpcProfile),
    initNpcs: alive(initNpcs),
    dispose,
  };
}
export type NpcEditor = ReturnType<typeof createNpcEditor>;
