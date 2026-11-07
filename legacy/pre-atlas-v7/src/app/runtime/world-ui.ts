import type { WorkspaceGeometry } from '../shared/contracts';
import { clearEditorHandlers } from '../shared/editor-instance';
import { WorldCalendarEditor } from './world-calendar-editor';
import { WorldEditorSurface, type WorldEditorHost } from './world-editor-surface';
import { WorldMapEditor } from './world-map-editor';
import { WorldTravelEditor } from './world-travel-editor';
import { WorldWeatherEditor } from './world-weather-editor';
import { WorldWriteCoordinator } from './world-write-coordinator';
export function createWorldEditor(host: WorldEditorHost) {
  const surface = new WorldEditorSurface(host);
  const writes: WorldWriteCoordinator = new WorldWriteCoordinator({
    surface,
    get map() {
      return map;
    },
    get weather() {
      return weather;
    },
    get calendar() {
      return calendar;
    },
    get travel() {
      return travel;
    },
  });
  const map: WorldMapEditor = new WorldMapEditor({
    surface,
    get travel() {
      return travel;
    },
    get writes() {
      return writes;
    },
    get weather() {
      return weather;
    },
    get calendar() {
      return calendar;
    },
  });
  const travel: WorldTravelEditor = new WorldTravelEditor({
    surface,
    get map() {
      return map;
    },
    get weather() {
      return weather;
    },
    get writes() {
      return writes;
    },
    get calendar() {
      return calendar;
    },
  });
  const weather: WorldWeatherEditor = new WorldWeatherEditor({
    surface,
    get map() {
      return map;
    },
    get calendar() {
      return calendar;
    },
    get travel() {
      return travel;
    },
    get writes() {
      return writes;
    },
  });
  const calendar: WorldCalendarEditor = new WorldCalendarEditor({
    surface,
    get map() {
      return map;
    },
    get writes() {
      return writes;
    },
    get weather() {
      return weather;
    },
  });
  let initialized = false,
    disposed = false;
  const initWorld = () => {
    if (initialized || disposed) return;
    initialized = true;
    map.initWorld();
  };
  const activateWorld = (w: WorkspaceGeometry) => {
    if (disposed) throw new Error('Welteditor wurde abgebaut.');
    surface.editorSession.generation++;
    calendar.activate();
    map.activate(w);
    weather.activate();
    travel.activate();
    writes.showUncertainWorldWrite();
  };
  surface.editorSession.observeDraft(() => ({
    openInput: map.dirtyMap || map.dirtyCell || calendar.dirtyCalendar || weather.dirtyPhenomenon,
    retainedDraft: false,
    unresolvedCommand: !!writes.uncertainState.value,
  }));
  const dispose = async () => {
    if (disposed) return true;
    if (!(await writes.flushWorld())) return false;
    await surface.editorSession.settle();
    if (writes.uncertainState.value) return false;
    if (weather.weatherDirty || weather.weatherBusy) {
      surface.tell('Wettereingabe zuerst speichern oder ausdrücklich verwerfen.', true);
      return false;
    }
    disposed = true;
    surface.editorSession.deactivate();
    travel.playback.stop();
    await travel.playback.settled();
    travel.travelSurface?.dispose();
    map.suspendMapPointer();
    map.partyDrag?.dispose();
    map.mapGestures?.dispose();
    map.worldCanvas?.dispose();
    for (const cleanup of surface.cleanups.splice(0)) cleanup();
    calendar.calendarRules?.remove();
    clearEditorHandlers(surface.el('world'));
    clearEditorHandlers(surface.el('live-world-panel'));
    surface.el('world-write-recovery')?.remove();
    return true;
  };
  return {
    editorSession: surface.editorSession,
    initWorld,
    activateWorld,
    dispose,
    flushWorld: writes.flushWorld,
    reconcileWorldWrite: writes.reconcileWorldWrite,
    openWorld: map.openWorld,
    openWorldCalendar: calendar.openWorldCalendar,
    setWorldSurface: travel.setWorldSurface,
    stopWorldPlayback: travel.stopWorldPlayback,
    renderLiveWorld: weather.renderLiveWorld,
    saveAgendaEvent: calendar.saveAgendaEvent,
    agendaWritePending: writes.agendaWritePending,
    recoverAgendaEvent: writes.recoverAgendaEvent,
    atlasWorldTarget: travel.atlasWorldTarget,
    previewAtlasWorldTravel: travel.previewAtlasWorldTravel,
    startAtlasWorldTravel: travel.startAtlasWorldTravel,
    atlasWorldTravelState: travel.atlasWorldTravelState,
    refreshWorldAfterAtlasTravel: travel.refreshWorldAfterAtlasTravel,
  };
}
export type WorldEditor = ReturnType<typeof createWorldEditor>;
export type WorldTravelPort = Pick<
  WorldEditor,
  | 'openWorld'
  | 'atlasWorldTravelState'
  | 'previewAtlasWorldTravel'
  | 'startAtlasWorldTravel'
  | 'refreshWorldAfterAtlasTravel'
  | 'atlasWorldTarget'
>;
export type WorldAgendaPort = Pick<
  WorldEditor,
  'saveAgendaEvent' | 'agendaWritePending' | 'recoverAgendaEvent'
>;
