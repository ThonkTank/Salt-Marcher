import type { WorkspaceGeometry } from '../shared/contracts';
import type { LiveView } from './live-contracts';
import type { AtlasCell, Hex } from './world-cell-contracts';
import type { AtlasMap } from './world-map-contracts';
import type {
  SceneWorld,
  WorldAck,
  WorldAction,
  WorldCommand,
  WorldReconciliation,
  WorldView,
} from './world-contracts';
import type { TravelPreview } from './world-travel-contracts';

import type { WeatherIntent, WorldEdits } from './world-editor-types';

/** Borrowed models cannot expose nested mutation paths to a different owner. */
export type WorldRead<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: WorldRead<T[K]> }
    : T;

/** Explicit travel projection, independent of its implementation. */
export interface WorldTravelPort {
  readonly chooseRouteHex: (h: Hex, locationId?: string | null) => void;
  readonly clearTravelPreview: () => void;
  readonly followLiveGroup: (
    result: SceneWorld,
    context: import('./world-editor-types').MapProjectionContext,
  ) => void;
  readonly liveSurface: boolean;
  readonly liveTravelOpen: boolean;
  readonly mountTravelControls: () => void;
  readonly mountTravelLayout: () => void;
  readonly placePartyAt: (h: Hex, requireAuthored?: boolean, key?: string | null) => Promise<void>;
  readonly placementKey: () => string | null;
  readonly playback: {
    readonly stop: () => void;
    readonly busy: boolean;
  };
  readonly preview: WorldRead<TravelPreview> | null;
  readonly renderJourney: () => void;
  readonly renderRouteDraft: () => void;
  readonly resetRouteDraft: () => void;
  readonly routeCursor: WorldRead<Hex>;
  readonly routeMode: 'edit' | 'target' | 'route';
  readonly routeStops: readonly WorldRead<Hex>[];
  readonly sceneSelectionChanged: () => void;
  readonly sceneSelectionRequested: () => void;
  readonly mapCursorSelected: (hex: Hex) => void;
  readonly mapLevelChanged: (previous: number, next: number) => void;
  readonly journeyContextLoaded: () => void;
  readonly sceneSelection: number;
  readonly transportBusy: boolean;
  readonly unavailableLiveTravel: (message: string, error?: boolean) => void;
  readonly worldSurface: string;
}

/** Explicit writes projection, independent of its implementation. */
export interface WorldWritePort {
  readonly action: (a: WorldAction) => Promise<void>;
  readonly checkingWorldWriteWork: Readonly<
    Pick<
      import('../shared/editor-session').EditorOperation<Promise<WorldReconciliation | null>>,
      'value'
    >
  >;
  readonly flushWorld: () => Promise<boolean>;
  readonly pendingWork: Readonly<
    Pick<import('../shared/editor-session').EditorOperation<Promise<boolean>>, 'value'>
  >;
  readonly raw: (
    action: WorldAction,
    stillCurrent?: () => boolean,
    weatherIntent?: WeatherIntent,
  ) => Promise<WorldAck>;
  readonly reconcileWorldWrite: () => Promise<boolean>;
  readonly resolveWorldWrite: () => Promise<WorldReconciliation | null>;
  readonly showUncertainWorldWrite: () => void;
  readonly uncertainState: {
    readonly value: WorldRead<{
      command: WorldCommand;
      versions: WorldEdits;
      weatherIntent?: WeatherIntent;
      generation: number;
    }> | null;
  };
  readonly worldWrites: ReadonlySet<Promise<void>>;
}

/** Explicit weather projection, independent of its implementation. */
export interface WorldWeatherPort {
  readonly acceptConfirmed: (
    command: WorldCommand,
    ack: import('./world-contracts').WorldAck,
    versions: WorldEdits,
  ) => void;
  readonly acceptOwnWeather: (intent: WeatherIntent, next: SceneWorld | null | undefined) => void;
  readonly dirtyPhenomenon: boolean;
  readonly flushDraft: () => Promise<void>;
  readonly liveFocusId: string | null;
  readonly liveRequest: number;
  readonly liveWorld: WorldRead<SceneWorld> | null;
  readonly mountWeatherControls: () => void;
  readonly phenomenonEdits: number;
  readonly renderLiveWorld: (
    token: string,
    sceneId: string,
    confirmed?: SceneWorld,
  ) => Promise<void>;
  readonly renderPhenomenonOptions: () => void;
  readonly weatherBusy: boolean;
  readonly weatherDirty: boolean;
}

/** Explicit calendar projection, independent of its implementation. */
export interface WorldCalendarPort {
  readonly acceptConfirmed: (command: WorldCommand, ack: WorldAck, versions: WorldEdits) => void;
  readonly agendaPending: (message: string, busy?: boolean) => void;
  readonly calendarEdits: number;
  readonly calendarRules: Readonly<Pick<HTMLDialogElement, 'open'>> | null;
  readonly calendarStatus: (message: string) => void;
  readonly dirtyCalendar: boolean;
  readonly flushDraft: () => Promise<void>;
  readonly installCalendarRules: () => void;
  readonly renderCalendar: () => void;
  readonly renderLiveAgenda: (token: string, sceneId: string, request: number) => Promise<void>;
}

/** Explicit map projection, independent of its implementation. */
export interface WorldMapPort {
  readonly readTravelCell: (hex: Hex) => WorldRead<AtlasCell> | null;
  readonly projectionContext: () => import('./world-editor-types').MapProjectionContext;
  readonly projectLiveGroup: (
    result: SceneWorld,
    context: import('./world-editor-types').MapProjectionContext,
    first: boolean,
  ) => { changed: boolean; basisChanged: boolean; cursor: Hex | null } | null;
  readonly acceptWeatherProjection: (token: string, next: SceneWorld) => void;
  readonly prepareLiveScene: (sceneId: string) => void;
  readonly unavailableScene: () => void;
  readonly closeLiveRead: () => void;
  readonly useAtlasTargetLevel: () => void;
  readonly navigateCursor: (hex: Hex, select: boolean) => void;
  readonly acceptConfirmed: (
    command: WorldCommand,
    ack: import('./world-contracts').WorldAck,
    versions: WorldEdits,
  ) => void;
  readonly acceptSnapshot: (ack: import('./world-contracts').WorldAck) => void;
  readonly center: WorldRead<Hex>;
  readonly collectCell: () => void;
  readonly dirtyCell: boolean;
  readonly dirtyMap: boolean;
  readonly flushDraft: () => Promise<void>;
  readonly flushMarker: () => Promise<boolean>;
  readonly frame: WorldRead<SceneWorld> | null;
  readonly level: number;
  readonly live: WorldRead<LiveView> | null;
  readonly mapDraft: WorldRead<AtlasMap> | null;
  readonly mapEdits: number;
  readonly mapGestures: { readonly finish: () => void } | null;
  readonly mapSelection: number;
  readonly markerEdits: number;
  readonly openWorld: () => Promise<SceneWorld | undefined>;
  readonly partyDrag: { readonly cancel: (message?: string) => void } | null;
  readonly reloadScene: () => Promise<SceneWorld | undefined>;
  readonly renderCell: () => void;
  readonly renderMap: (restoreView?: unknown) => void;
  readonly renderMapFields: () => void;
  readonly selected: WorldRead<Hex>;
  readonly viewZoom: number;
  readonly workspace: WorldRead<WorkspaceGeometry> | null;
  readonly world: WorldRead<WorldView> | null;
}
