import { editTextareaText } from '../campaign/key-reading-model';
import { PassiveMapCanvas } from '../runtime/passive-map-canvas';
import {
  type Edit,
  type Result,
  type Room,
  type RoomGeometry,
  type WorkspaceGeometry,
} from '../shared/contracts';
import { EditorSession } from '../shared/editor-session';
import { validateRoom } from '../shared/room-validation';
import { workspaceGeometryOnly as geometryOnly } from './atlas-render-view';
import { atlasFieldValue, setAtlasFieldValue } from './atlas-units';
import { atlasDefaultRoomWrite, atlasHistoryWrite, atlasRoomWrite } from './campaign-atlas-author';
import {
  drawingOverlay,
  flushDrawing,
  reloadDrawing,
  roomDrawingStyle,
  syncDrawingControls,
} from './drawing-ui';
import { syncGraphBanner } from './graph-ui';
import { roomCameraBox } from './room-camera';
import { RoomDirectoryView } from './room-directory-ui';
import { appendRoomNumber } from './room-number-label';
interface RoomEditorHost {
  workspace: WorkspaceGeometry | null;
  readonly transitionPending: boolean;
  readonly activating: boolean;
  readonly activationFailed: boolean;
  leaveWorkspace(): Promise<boolean>;
  navigateRoom(id: string): Promise<void> | undefined;
  status(text: string, error?: boolean): void;
}
/** Owns room input, retained drafts, reconciliation and the room canvas. */
export function createRoomEditor(host: RoomEditorHost, editorSession: EditorSession) {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const api = window.campaign;
  const status = host.status;
  const unwrap = <T>(result: Result<T>): T => {
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  const failedEditState = editorSession.command<Edit>();
  const pendingWork = editorSession.operation<Promise<boolean>>();

  let draft: Room | null = null;
  let confirmedRoom: Room | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  let composing = false;
  let writeBlocked = false;

  let hasRetainedDraft = false;
  let roomDraftLoading = false,
    roomDraftReadFailed = false;
  let pointer: { index: number; id: number; before: Room['polygons'] } | null = null;
  const dungeonCanvas = new PassiveMapCanvas(el<SVGSVGElement & HTMLElement>('map'), {
    initial: { x: 0, y: 0, width: 24, height: 18 },
    locked: () => !!pointer,
    changed: () => draw(),
  });
  async function leaveRoom() {
    if (await flush()) return true;
    if (!host.workspace || !draft || pointer || composing) return false;
    try {
      unwrap(
        await api.keepRoomDraft(host.workspace.token, draft.id, {
          room: draft,
          points: atlasFieldValue(el<HTMLTextAreaElement>('points')),
          pointsChanged: el('points').dataset.changed === 'true',
          failedEdit: failedEditState.value,
        }),
      );
      hasRetainedDraft = true;
      return true;
    } catch (error) {
      status('Entwurf konnte nicht gesichert werden: ' + (error as Error).message, true);
      return false;
    }
  }
  const selected = () =>
    confirmedRoom?.id === host.workspace?.selectedId ? confirmedRoom : undefined;
  const roomContextCurrent = (token: string) =>
    host.workspace?.token === token &&
    !host.transitionPending &&
    !host.activating &&
    !host.activationFailed;
  const same = (a: Room, b: Room) =>
    JSON.stringify([a.name, a.polygons, a.sections]) ===
    JSON.stringify([b.name, b.polygons, b.sections]);
  function cancelTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    if (writeBlocked) {
      status('Schreiben gesperrt. Entwurf bleibt offen; zuerst den Speicherstatus prüfen.', true);
      return;
    }
    editorSession.input.version++;
    status('Eingabe offen – noch nicht gespeichert.');
    cancelTimer();
    if (!composing && !pointer)
      timer = setTimeout(() => {
        void flush();
      }, 700);
  }
  async function flush(): Promise<boolean> {
    cancelTimer();
    if (host.activating || host.activationFailed) return false;
    if (roomDraftLoading) {
      status('Arbeitsentwurf wird noch geprüft und geladen.');
      return false;
    }
    // A failed draft read is kept intact; its read-only room must not overwrite it.
    if (roomDraftReadFailed) return true;
    if (writeBlocked) return false;
    if (pendingWork.value) {
      const okay = await pendingWork.value;
      return okay ? flush() : false;
    }
    if (composing || pointer) {
      status('Bitte die laufende Eingabe abschließen.', true);
      return false;
    }
    const before = selected(),
      inputRevision = editorSession.input.version;
    if (!host.workspace || !draft || !before) return true;
    try {
      readPoints();
      validateRoom(draft);
    } catch (error) {
      status(String((error as Error).message) + ' Entwurf bleibt offen.', true);
      return false;
    }
    if (same(before, draft)) {
      if (hasRetainedDraft) {
        unwrap(await api.keepRoomDraft(host.workspace.token, draft.id, null));
        hasRetainedDraft = false;
      }
      editorSession.input.retained = inputRevision;
      status('Gespeichert.');
      return true;
    }
    const after = structuredClone(draft),
      token = host.workspace.token,
      current = editorSession.capture();
    const request: Edit = {
      commandId: crypto.randomUUID(),
      token,
      campaignId: host.workspace.campaign.id,
      roomId: after.id,
      expectedRevision: after.revision,
      name: after.name,
      polygons: after.polygons,
      sections: after.sections,
    };
    status('Wird gespeichert…');
    pendingWork.value = editorSession.run(async () => {
      let acknowledged = false;
      try {
        const next = unwrap(await atlasRoomWrite(request));
        acknowledged = true;
        if (!current() || host.workspace?.token !== token) return false;
        confirmedRoom = next.room;
        host.workspace = geometryOnly({
          ...host.workspace,
          rooms: host.workspace.rooms.map((room) => (room.id === next.room.id ? next.room : room)),
          canUndo: next.canUndo,
          canRedo: next.canRedo,
          selectedId: after.id,
        });
        if (draft?.id === after.id) draft.revision = next.room.revision;
        hasRetainedDraft = false;
        editorSession.input.retained = inputRevision;
        // A confirmed edit updates the scene without moving the user's camera.
        renderList(true);
        updateHistory();
        draw();
        status(
          draft && !same(after, draft)
            ? 'Weitere Eingabe offen – noch nicht gespeichert.'
            : 'Gespeichert.',
        );
        return true;
      } catch (error) {
        if (!current() || host.workspace?.token !== token) return false;
        if (acknowledged) {
          status(
            'Änderung gespeichert. Ansicht konnte nicht aktualisiert werden: ' +
              (error as Error).message,
            true,
          );
          return true;
        }
        writeBlocked = true;
        failedEditState.value = request;
        el('error-actions').hidden = false;
        status(
          (error as Error).message +
            ' Entwurf bleibt offen; Schreiben gesperrt bis zur Aufklärung.',
          true,
        );
        return false;
      }
    });
    const okay = await pendingWork.value;
    return okay ? flush() : false;
  }
  function readPoints() {
    if (!draft) return;
    const input = el<HTMLTextAreaElement>('points');
    if (input.dataset.changed !== 'true') return;
    const points = atlasFieldValue(input)
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const values = line.trim().split(/[,;\s]+/);
        if (values.length !== 2 || values.some((v) => !v || !Number.isFinite(Number(v))))
          throw new Error('Koordinaten als x, y eingeben.');
        return { x: Number(values[0]), y: Number(values[1]) };
      });
    const candidate = {
      ...draft,
      polygons: [{ ...draft.polygons[0]!, outer: points }, ...draft.polygons.slice(1)],
    };
    validateRoom(candidate);
    draft = candidate;
  }
  function renderRoomInputs(room: Room, token: string | undefined) {
    el<HTMLInputElement>('room-name').value = room.name;
    el('keys').replaceChildren();
    room.sections.forEach((section, index) => {
      const label = document.createElement('label');
      label.textContent =
        section.kind === 'markdown' ? `GM-Text ${index + 1}` : `Passage ${index + 1}`;
      if (section.kind !== 'markdown') {
        const text = document.createElement('p');
        text.textContent = `Türbindung: ${section.doorId} (hier noch nicht bearbeitbar)`;
        el('keys').append(label, text);
        return;
      }
      const input = document.createElement('textarea');
      input.id = `key-${index}`;
      label.htmlFor = input.id;
      input.rows = 8;
      input.value = section.markdown!;
      input.addEventListener('input', () => {
        if (
          roomDraftLoading ||
          roomDraftReadFailed ||
          host.transitionPending ||
          host.activating ||
          host.activationFailed ||
          host.workspace?.token !== token ||
          draft?.id !== room.id
        )
          return;
        draft!.sections[index]!.markdown = editTextareaText(
          draft!.sections[index]!.markdown!,
          input.value,
        );
        schedule();
      });
      input.addEventListener('blur', () => {
        if (!composing && host.workspace?.token === token && draft?.id === room.id) void flush();
      });
      el('keys').append(label, input);
    });
  }
  function roomEditable(editable: boolean) {
    for (const id of ['room-name', 'points', 'apply'])
      el<HTMLInputElement>(id).disabled = !editable;
    for (const input of el('keys').querySelectorAll<HTMLTextAreaElement>('textarea'))
      input.disabled = !editable;
  }
  async function setDraft() {
    const token = host.workspace?.token,
      id = host.workspace?.selectedId,
      request = ++editorSession.generation;
    const current = () =>
      host.workspace?.token === token &&
      host.workspace?.selectedId === id &&
      request === editorSession.generation;
    confirmedRoom = null;
    draft = null;
    roomDraftReadFailed = false;
    writeBlocked = false;
    failedEditState.value = null;
    hasRetainedDraft = false;
    el('error-actions').hidden = true;
    el('keys').replaceChildren();
    el<HTMLInputElement>('room-name').value = '';
    el('empty').textContent = 'Lege einen Raum an oder übernimm eine Dungeondatei.';
    el('editor').hidden = true;
    el('empty').hidden = false;
    roomEditable(false);
    if (!token || !id) {
      roomDraftLoading = false;
      draw();
      return;
    }
    roomDraftLoading = true;
    updateHistory();
    status('Raum wird geladen.');
    let room: Room;
    try {
      room = unwrap(await api.atlasRoom(token, id));
      if (!current()) return;
      confirmedRoom = room;
      draft = structuredClone(room);
      const { sections: unused, ...shape } = room;
      host.workspace!.rooms =
        host.workspace!.geometryCoverage === 'selected'
          ? [shape]
          : [...host.workspace!.rooms.filter((r) => r.id !== room.id), shape];
    } catch (error) {
      if (current()) {
        roomDraftLoading = false;
        roomDraftReadFailed = true;
        writeBlocked = true;
        status(
          'Raum konnte nicht geladen werden. Originaldaten bleiben erhalten: ' +
            (error as Error).message,
          true,
        );
        el('empty').textContent = 'Raum nicht verfügbar. Anderen Raum wählen oder erneut öffnen.';
        updateHistory();
      }
      return;
    }
    writeBlocked = false;
    failedEditState.value = null;
    roomDraftReadFailed = false;
    el('error-actions').hidden = true;
    hasRetainedDraft = false;
    el('editor').hidden = !room;
    el('empty').hidden = !!room;
    el('keys').replaceChildren();
    if (!room) {
      roomEditable(false);
      draw();
      return;
    }
    const floors = el<HTMLSelectElement>('floors');
    floors.replaceChildren();
    for (const floor of host.workspace!.floors) {
      const option = document.createElement('option');
      option.value = JSON.stringify([floor.scopeId, floor.id]);
      option.textContent = floor.name;
      floors.append(option);
    }
    floors.value = JSON.stringify([room.scopeId, room.floorId]);
    renderRoomInputs(room, token);
    updatePoints();
    if (
      dungeonCanvas.context(host.workspace!.campaign.id + ':' + floors.value, {
        x: 0,
        y: 0,
        width: 24,
        height: 18,
      }) &&
      !dungeonCanvas.contextRestored
    ) {
      fit(true);
      dungeonCanvas.defaultView(dungeonCanvas.view);
    }
    draw();
    if (room && token) {
      roomDraftLoading = true;
      roomEditable(false);
      updateHistory();
      status('Arbeitsentwurf wird geprüft und geladen.');
      try {
        const retained = unwrap(await api.roomDraft(token, room.id));
        if (!retained || !current()) return;
        draft = structuredClone(retained.room);
        hasRetainedDraft = true;
        renderRoomInputs(draft, token);
        setAtlasFieldValue(el<HTMLTextAreaElement>('points'), retained.points);
        el('points').dataset.changed = String(retained.pointsChanged);
        failedEditState.value = retained.failedEdit;
        writeBlocked = !!failedEditState.value;
        el('error-actions').hidden = !writeBlocked;
        draw();
        status(
          'Arbeitsentwurf wiederaufgenommen. Die Änderung ist noch nicht als Autorenstand gespeichert.',
          true,
        );
      } catch (error) {
        if (!current()) return;
        roomDraftReadFailed = true;
        writeBlocked = true;
        status(
          'Arbeitsentwurf konnte nicht gelesen werden. Originalbytes bleiben erhalten; dieser Raum bleibt schreibgeschützt: ' +
            (error as Error).message,
          true,
        );
      } finally {
        if (current()) {
          roomDraftLoading = false;
          roomEditable(!roomDraftReadFailed);
          updateHistory();
        }
      }
    }
  }
  function updatePoints() {
    if (draft) {
      const field = el<HTMLTextAreaElement>('points');
      setAtlasFieldValue(field, draft.polygons[0]!.outer.map((p) => `${p.x}, ${p.y}`).join('\n'));
      field.dataset.changed = 'false';
    }
  }
  function updateHistory() {
    el<HTMLButtonElement>('undo').disabled =
      roomDraftLoading || roomDraftReadFailed || !host.workspace?.canUndo;
    el<HTMLButtonElement>('redo').disabled =
      roomDraftLoading || roomDraftReadFailed || !host.workspace?.canRedo;
    el<HTMLButtonElement>('add-room').disabled = !host.workspace;
    el<HTMLButtonElement>('rename-campaign').disabled = !host.workspace;
  }
  const roomDirectory = new RoomDirectoryView(el('rooms'), (id) => {
    void host.navigateRoom(id);
  });
  function renderList(refresh = false) {
    roomDirectory.context(
      host.workspace?.token ?? null,
      el<HTMLInputElement>('search').value,
      host.workspace?.selectedId ?? null,
      host.workspace?.problems ?? [],
      refresh,
    );
  }
  async function selectRoom(id: string) {
    if (!(await flushDrawing())) return;
    const token = host.workspace?.token;
    if (
      !token ||
      !roomContextCurrent(token) ||
      !(await host.leaveWorkspace()) ||
      !roomContextCurrent(token)
    )
      return;
    try {
      const response = await api.select(token, id);
      if (!roomContextCurrent(token)) return;
      unwrap(response);
      host.workspace!.selectedId = id;
      await setDraft();
      if (!roomContextCurrent(token)) return;
      renderList();
      if (
        !roomDraftReadFailed &&
        (!draft || (same(draft, selected()!) && el('points').dataset.changed !== 'true'))
      )
        status('Gespeichert.');
    } catch (error) {
      if (roomContextCurrent(token)) status((error as Error).message, true);
    }
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgElement(name: string, attributes: Record<string, string>) {
    const item = document.createElementNS(svgNS, name);
    Object.entries(attributes).forEach(([key, value]) => item.setAttribute(key, value));
    return item;
  }
  function draw() {
    syncGraphBanner(host.workspace);
    syncDrawingControls();
    document.dispatchEvent(new Event('atlas-draft'));
    const visible = host.workspace?.rooms.some(
      (r) => JSON.stringify([r.scopeId, r.floorId]) === el<HTMLSelectElement>('floors').value,
    );
    dungeonCanvas.render(
      drawScene,
      visible
        ? ''
        : 'Noch keine Geometrie in dieser Ansicht. Raum anlegen oder eine andere Ebene wählen.',
    );
  }
  function drawScene(map: SVGGElement) {
    const visible: RoomGeometry[] = [];
    for (const saved of host.workspace?.rooms ?? []) {
      const room = draft?.id === saved.id ? draft : saved;
      if (JSON.stringify([room.scopeId, room.floorId]) !== el<HTMLSelectElement>('floors').value)
        continue;
      visible.push(room);
      const path = room.polygons
        .flatMap((p) => [p.outer, ...p.holes])
        .map((ring) => 'M' + ring.map((p) => `${p.x},${p.y}`).join('L') + 'Z')
        .join(' ');
      const style = roomDrawingStyle(room.id);
      const isSelected = room.id === draft?.id;
      const shape = svgElement('path', {
        d: path,
        fill: isSelected ? '#aecfdf' : (style?.fill ?? '#d7e1e9'),
        stroke: isSelected ? '#234d74' : (style?.wall ?? '#576c80'),
        'stroke-width': isSelected ? '.13' : '.08',
        'fill-rule': 'evenodd',
        cursor: 'pointer',
      });
      shape.setAttribute('data-room-id', room.id);
      const title = svgElement('title', {});
      title.textContent = `${room.number}. ${room.name}`;
      shape.append(title);
      shape.addEventListener('click', () => {
        void selectRoom(room.id);
      });
      map.append(shape);
    }
    drawingOverlay(map);
    const mapHost = el<SVGSVGElement & HTMLElement>('map'),
      box = dungeonCanvas.view;
    const unitsPerPixel = Math.max(
      box.width / mapHost.clientWidth,
      box.height / mapHost.clientHeight,
    );
    for (const room of visible) appendRoomNumber(map, room, unitsPerPixel);
    if (
      !draft ||
      JSON.stringify([draft.scopeId, draft.floorId]) !== el<HTMLSelectElement>('floors').value
    )
      return;
    draft.polygons[0]!.outer.forEach((p, index) => {
      const handle = svgElement('circle', {
        cx: String(p.x),
        cy: String(p.y),
        r: String(box.width / 85),
        class: 'handle',
      });
      handle.addEventListener('pointerdown', (event) => {
        if (
          (event as PointerEvent).button !== 0 ||
          pendingWork.value ||
          composing ||
          pointer ||
          roomDraftLoading ||
          roomDraftReadFailed ||
          host.transitionPending ||
          host.activating ||
          host.activationFailed
        )
          return;
        pointer = {
          index,
          id: (event as PointerEvent).pointerId,
          before: structuredClone(draft!.polygons),
        };
        mapHost.setPointerCapture(pointer.id);
        event.preventDefault();
      });
      map.append(handle);
    });
  }
  new ResizeObserver(() => draw()).observe(el('map'));
  function fit(all = false) {
    const visible = (host.workspace?.rooms ?? [])
      .map((saved) => (draft?.id === saved.id ? draft : saved))
      .filter(
        (room) =>
          JSON.stringify([room.scopeId, room.floorId]) === el<HTMLSelectElement>('floors').value,
      );
    const box = roomCameraBox(all ? visible : draft ? [draft] : visible);
    if (box) {
      const [x, y, width, height] = box.split(' ').map(Number);
      dungeonCanvas.set({ x: x!, y: y!, width: width!, height: height! });
    }
  }
  el('map').addEventListener('pointermove', (event) => {
    if (!pointer || !draft || event.pointerId !== pointer.id) return;
    const svg = el('map') as unknown as SVGSVGElement,
      matrix = svg.getScreenCTM();
    if (!matrix) return;
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    draft.polygons[0]!.outer[pointer.index] = {
      x: Math.round(position.x * 1000) / 1000,
      y: Math.round(position.y * 1000) / 1000,
    };
    updatePoints();
    draw();
    status('Konturvorschau – noch nicht gespeichert.');
  });
  el('map').addEventListener('pointerup', (event) => {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    void flush();
  });
  el('map').addEventListener('pointercancel', () => {
    if (pointer && draft) draft.polygons = pointer.before;
    pointer = null;
    updatePoints();
    draw();
    schedule();
  });
  el('floors').addEventListener('change', () => {
    void (async () => {
      if (!host.workspace || !(await flush())) return;
      const key = el<HTMLSelectElement>('floors').value;
      if (
        host.workspace.rooms.some(
          (r) =>
            r.id === host.workspace!.selectedId && JSON.stringify([r.scopeId, r.floorId]) === key,
        )
      ) {
        draw();
        return;
      }
      const room = host.workspace.rooms.find((r) => JSON.stringify([r.scopeId, r.floorId]) === key);
      if (room) await selectRoom(room.id);
      else {
        draft = null;
        el('editor').hidden = true;
        el('empty').hidden = false;
        draw();
      }
    })();
  });
  el('fit').onclick = () => {
    fit();
    draw();
  };
  el('fit-all').onclick = () => {
    fit(true);
    draw();
  };
  el('map-zoom-in').onclick = () => dungeonCanvas.zoom(1 / 1.2);
  el('map-zoom-out').onclick = () => dungeonCanvas.zoom(1.2);
  el('search').addEventListener('input', () => renderList());
  el('room-name').addEventListener('input', () => {
    if (
      roomDraftLoading ||
      roomDraftReadFailed ||
      host.transitionPending ||
      host.activating ||
      host.activationFailed
    )
      return;
    if (draft) draft.name = el<HTMLInputElement>('room-name').value;
    schedule();
  });
  el('room-name').addEventListener('blur', () => {
    void flush();
  });
  el('points').addEventListener('input', () => {
    if (
      roomDraftLoading ||
      roomDraftReadFailed ||
      host.transitionPending ||
      host.activating ||
      host.activationFailed
    )
      return;
    el('points').dataset.changed = 'true';
    schedule();
  });
  el('points').addEventListener('blur', () => {
    void flush();
  });
  el('apply').onclick = () => {
    void flush();
  };
  el('editor').addEventListener('submit', (event) => {
    event.preventDefault();
    void flush();
  });
  el('reconcile').onclick = () => {
    void (async () => {
      const edit = failedEditState.value,
        token = host.workspace?.token;
      if (!edit || !token || !roomContextCurrent(token)) return;
      const owns = () => roomContextCurrent(token) && failedEditState.value === edit;
      try {
        const response = await api.reconcile(edit, token);
        if (!owns()) return;
        const result = unwrap(response);
        if (result.targetChanged || result.outcome === 'conflict') {
          status(
            result.outcome === 'applied'
              ? 'Speicherung bestätigt, aber der aktuelle Raumstand ist verändert oder nicht verlässlich lesbar. Entwurf bleibt offen. Übertrage den Text vor dem Verwerfen.'
              : 'Konflikt bestätigt. Entwurf bleibt offen. Übertrage den Text vor dem Verwerfen.',
            true,
          );
          return;
        }
        host.workspace = geometryOnly({ ...result.workspace, selectedId: edit.roomId });
        if (draft) draft.revision = selected()!.revision;
        writeBlocked = false;
        failedEditState.value = null;
        el('error-actions').hidden = true;
        updateHistory();
        renderList();
        status(
          result.outcome === 'applied'
            ? 'Speicherung bestätigt. Weitere Eingaben bleiben offen.'
            : 'Diese Änderung wurde nicht gespeichert. Eingabe abschließen, um sie erneut zu übernehmen.',
        );
      } catch (error) {
        if (owns()) status((error as Error).message + ' Status bleibt ungeklärt.', true);
      }
    })();
  };
  el('discard').onclick = () => {
    void (async () => {
      const edit = failedEditState.value,
        token = host.workspace?.token,
        roomId = draft?.id;
      if (!edit || !token || !roomContextCurrent(token)) return;
      const owns = () => roomContextCurrent(token) && failedEditState.value === edit;
      try {
        const response = await api.reconcile(edit, token);
        if (!owns()) return;
        const current = unwrap(response).workspace;
        if (roomId) {
          const cleared = await api.keepRoomDraft(token, roomId, null);
          if (!owns()) return;
          unwrap(cleared);
        }
        host.workspace = geometryOnly(current);
        writeBlocked = false;
        failedEditState.value = null;
        el('error-actions').hidden = true;
        await setDraft();
        if (!roomContextCurrent(token)) return;
        renderList();
        updateHistory();
        status('Aktueller gespeicherter Stand geöffnet. Entwurf verworfen.');
      } catch (error) {
        if (owns()) status((error as Error).message, true);
      }
    })();
  };
  el('atlas').addEventListener('compositionstart', () => {
    composing = true;
    cancelTimer();
  });
  el('atlas').addEventListener('compositionend', () => {
    composing = false;
    schedule();
  });
  el('add-room').onclick = () => {
    void (async () => {
      const token = host.workspace?.token;
      if (!token || !roomContextCurrent(token) || !(await flush()) || !roomContextCurrent(token))
        return;
      try {
        const response = await atlasDefaultRoomWrite(token, host.workspace!.campaign.id);
        if (!roomContextCurrent(token)) return;
        host.workspace = geometryOnly(unwrap(response));
        await reloadDrawing();
        await setDraft();
        if (!roomContextCurrent(token)) return;
        renderList(true);
        updateHistory();
        status('Raum angelegt und gespeichert.');
      } catch (error) {
        if (roomContextCurrent(token)) status((error as Error).message, true);
      }
    })();
  };
  async function history(direction: 'undo' | 'redo') {
    if (!(await flushDrawing())) return;
    const token = host.workspace?.token;
    if (!token || !roomContextCurrent(token) || !(await flush()) || !roomContextCurrent(token))
      return;
    try {
      const response = await atlasHistoryWrite(token, host.workspace!.campaign.id, direction);
      if (!roomContextCurrent(token)) return;
      host.workspace = geometryOnly(unwrap(response));
      await reloadDrawing();
      await setDraft();
      if (!roomContextCurrent(token)) return;
      renderList(true);
      updateHistory();
      status('Gespeichert.');
    } catch (error) {
      if (roomContextCurrent(token)) status((error as Error).message, true);
    }
  }
  el('undo').onclick = () => {
    void history('undo');
  };
  el('redo').onclick = () => {
    void history('redo');
  };
  editorSession.onDeactivate(() => {
    if (timer) clearTimeout(timer);
    timer = null;
  });

  editorSession.observeDraft(() => ({
    openInput:
      !!draft &&
      !!selected() &&
      (!same(draft, selected()!) || el('points').dataset.changed === 'true'),
    retainedDraft: hasRetainedDraft,
    unresolvedCommand: !!failedEditState.value,
  }));

  return {
    flush,
    leaveRoom,
    setDraft,
    renderList,
    updateHistory,
    selectRoom,
    draw,
    history,
    get draft() {
      return draft;
    },
    get loading() {
      return roomDraftLoading;
    },
    get composing() {
      return composing;
    },
    get saved() {
      return (
        !roomDraftReadFailed &&
        (!draft ||
          !selected() ||
          (same(draft, selected()!) && el('points').dataset.changed !== 'true'))
      );
    },
    clear() {
      draft = null;
      confirmedRoom = null;
      editorSession.generation++;
    },
  };
}
