import { type GraphContentCounts } from './graph-content-contracts';
import type { GraphPreviewState, Point, Result, Workspace } from '../shared/contracts';
import type { DungeonBudgetSetting } from './dungeon-budget-contracts';
import { validateBudgetSettings } from './dungeon-budget-contracts';
import type { DungeonGeometry } from './dungeon-geometry-contracts';
export interface GraphIntent {
  id: string;
  fromRoomId: string | null;
  toRoomId: string | null;
  fromGroupId: string | null;
  toGroupId: string | null;
  form: 'corridor' | 'stairs' | 'ramp' | 'ladder' | 'shaft';
  name: string;
  problem: string;
}
export interface GraphLayout {
  stored?: boolean;
  budgets?: DungeonBudgetSetting[];
  id: string;
  revision: number;
  scopeId: string;
  positions: { roomId: string; x: number; y: number }[];
  intents: GraphIntent[];
}

export interface GraphView {
  geometry: DungeonGeometry;
  layout: GraphLayout;
  preview: GraphPreviewState | null;
  budget?: import('./dungeon-budget-contracts').DungeonBudgetView;
}
export type GraphEdit =
  | { kind: 'graph-move'; roomIds: string[]; dxSteps: number; dySteps: number }
  | {
      kind: 'graph-create';
      scopeId: string;
      floorId: string;
      name: string;
      point: Point;
      widthSteps: number;
      depthSteps: number;
      heightSteps: number;
    }
  | { kind: 'graph-duplicate'; roomIds: string[]; dxSteps: number; dySteps: number }
  | { kind: 'graph-hide'; roomIds: string[] }
  | { kind: 'graph-layout'; layout: GraphLayout; expectedRevision: number | null };
export type GraphAction =
  | GraphEdit
  | { kind: 'connect'; intent: GraphIntent }
  | { kind: 'resolve'; intentId: string; fromRoomId: string; toRoomId: string }
  | { kind: 'accept' }
  | { kind: 'restore' }
  | { kind: 'raster' }
  | { kind: 'reroute' }
  | { kind: 'select'; roomId: string };
export interface GraphCommand {
  commandId: string;
  token: string;
  campaignId: string;
  scopeId: string;
  action: GraphAction;
}
export interface GraphAPI {
  graph(token: string, scopeId: string): Promise<Result<GraphView>>;
  executeGraph(command: GraphCommand): Promise<Result<{ workspace: Workspace; view: GraphView }>>;
}
export interface GraphNode {
  id: string;
  name: string;
  roomIds: string[];
  point: Point;
  kind: 'room' | 'group' | 'external';
  counts: GraphContentCounts;
  levelIds: string[];
  internalSeconds?: number;
  internalDecisions?: number;
  internalLoops?: number;
  internalConnections?: {
    kind: string;
    seconds: number;
    forward: boolean;
    backward: boolean;
    secret: boolean;
  }[];
}
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  roomIds: string[];
  sourceIds: string[];
  kind: string;
  seconds: number;
  distanceMeters: number;
  forward: boolean;
  backward: boolean;
  secret: boolean;
  provisional: boolean;
  counts: GraphContentCounts;
}
export interface GraphDisplay {
  nodes: GraphNode[];
  edges: GraphEdge[];
  decisions: number;
  loops: number;
}

export interface GraphCommit {
  kind: 'graph-commit';
  changes: {
    key: { table: string; id: string; scopeId?: string; kind?: string };
    before: any;
    after: any;
  }[];
}

export function validateGraphLayout(p: unknown): asserts p is GraphLayout {
  const object = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 1000;
  const optionalId = (v: unknown) => v === null || id(v);
  const fail = (): never => {
    throw new Error('Graphinhalt ungültig oder widersprüchlich.');
  };
  if (!object(p)) throw new Error('Graphinhalt ungültig oder widersprüchlich.');
  if (
    !id(p.id) ||
    p.id !== p.scopeId ||
    !Number.isSafeInteger(p.revision) ||
    p.revision < 0 ||
    (p.stored !== undefined && typeof p.stored !== 'boolean') ||
    !Array.isArray(p.positions) ||
    p.positions.length > 5000 ||
    !Array.isArray(p.intents) ||
    p.intents.length > 1000
  )
    fail();
  const rooms = new Set<string>();
  for (const position of p.positions) {
    if (
      !object(position) ||
      !id(position.roomId) ||
      rooms.has(position.roomId) ||
      ![position.x, position.y].every(Number.isFinite)
    )
      fail();
    rooms.add(position.roomId);
  }
  const intents = new Set<string>();
  for (const intent of p.intents) {
    if (
      !object(intent) ||
      !id(intent.id) ||
      intents.has(intent.id) ||
      ![intent.fromRoomId, intent.toRoomId, intent.fromGroupId, intent.toGroupId].every(
        optionalId,
      ) ||
      !['corridor', 'stairs', 'ramp', 'ladder', 'shaft'].includes(intent.form) ||
      typeof intent.name !== 'string' ||
      !intent.name.trim() ||
      intent.name.length > 1000 ||
      typeof intent.problem !== 'string' ||
      intent.problem.length > 2000000
    )
      fail();
    intents.add(intent.id);
  }
  validateBudgetSettings(p.budgets ?? []);
}
