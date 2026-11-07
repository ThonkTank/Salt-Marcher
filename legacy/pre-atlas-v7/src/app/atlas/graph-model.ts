import type { GraphView, GraphNode, GraphEdge, GraphDisplay } from './graph-contracts';
import type { GraphContentCounts } from './graph-content-contracts';
const empty = (): GraphContentCounts => ({
    danger: 0,
    encounters: 0,
    treasure: 0,
    rewards: 0,
    curiosities: 0,
    puzzles: 0,
    secrets: 0,
  }),
  add = (a: GraphContentCounts, b: GraphContentCounts) => {
    for (const k of Object.keys(a) as (keyof GraphContentCounts)[]) a[k] += b[k];
  };
export function graphDisplay(
  view: GraphView,
  scopeId: string,
  detail: 'rooms' | 'routes' | 'groups' | 'melan',
  pace = 30,
): GraphDisplay {
  const g = view.geometry,
    paths = (g.drawing.paths ?? []).filter((p) => p.scopeId === scopeId),
    connectors = new Set(
      detail === 'rooms'
        ? []
        : paths
            .filter(
              (p) =>
                p.roomId &&
                !g.drawing.elements.some(
                  (e) =>
                    !e.archived &&
                    ((e.kind === 'feature' && e.roomId === p.roomId) ||
                      (['door', 'stairs'].includes(e.kind) &&
                        (e.roomId === p.roomId || e.targetRoomId === p.roomId))),
                ) &&
                !paths.some(
                  (q) => q.id !== p.id && (q.from.roomId === p.roomId || q.to.roomId === p.roomId),
                ),
            )
            .map((p) => p.roomId),
    ),
    nodes: GraphNode[] = [],
    edges: GraphEdge[] = [],
    owners = new Map<string, string>();
  for (const room of g.rooms.filter((r) => r.scopeId === scopeId && !connectors.has(r.id))) {
    const points = room.polygons.flatMap((p) => p.outer),
      position = view.layout.positions.find((p) => p.roomId === room.id),
      key = g.drawing.keyContent?.find((k) => k.id === room.id && k.kind === 'room'),
      counts = empty();
    for (const e of g.drawing.elements.filter(
      (e) => !e.archived && e.kind === 'feature' && e.roomId === room.id,
    )) {
      if (e.secret) counts.secrets++;
      if (e.feature === 'trap') counts.danger++;
      if (e.feature === 'encounter') {
        counts.encounters++;
        counts.danger++;
      }
      if (e.feature === 'loot') {
        counts.treasure++;
        counts.rewards++;
      }
      if (e.feature === 'curiosity' || e.feature === 'puzzle') counts.curiosities++;
      if (
        e.feature === 'puzzle' ||
        (e.feature === 'curiosity' && e.content?.tags.some((t) => t.toLowerCase() === 'puzzle'))
      )
        counts.puzzles++;
    }
    if (key?.secret || g.drawing.styles.some((s) => s.id === room.id && s.secret)) counts.secrets++;
    const id = detail === 'groups' && key?.groupId ? 'group:' + key.groupId : room.id;
    owners.set(room.id, id);
    const prior = nodes.find((n) => n.id === id),
      point = position ?? {
        x: points.reduce((n, p) => n + p.x, 0) / points.length,
        y: points.reduce((n, p) => n + p.y, 0) / points.length,
      };
    if (prior) {
      const n = prior.roomIds.length;
      prior.point = {
        x: (prior.point.x * n + point.x) / (n + 1),
        y: (prior.point.y * n + point.y) / (n + 1),
      };
      prior.roomIds.push(room.id);
      add(prior.counts, counts);
      if (key?.levelId && !prior.levelIds.includes(key.levelId)) prior.levelIds.push(key.levelId);
    } else
      nodes.push({
        id,
        name: id.startsWith('group:')
          ? (g.drawing.keyContent?.find((k) => k.id === key?.groupId)?.name ?? 'Gruppe')
          : room.number + '. ' + room.name,
        roomIds: [room.id],
        point: { x: point.x, y: point.y },
        kind: id.startsWith('group:') ? 'group' : 'room',
        counts,
        levelIds: key?.levelId ? [key.levelId] : [],
      });
  }
  const external = (id: string, name: string) => {
    if (!nodes.some((n) => n.id === id))
      nodes.push({
        id,
        name,
        roomIds: [],
        point: { x: Math.max(0, ...nodes.map((n) => n.point.x)) + 7.62, y: 0 },
        kind: 'external',
        counts: empty(),
        levelIds: [],
      });
    return id;
  };
  const edge = (e: GraphEdge) => {
    if (e.from === e.to) {
      const node = nodes.find((n) => n.id === e.from);
      if (node) {
        node.internalSeconds = (node.internalSeconds ?? 0) + e.seconds;
        (node.internalConnections ??= []).push({
          kind: e.kind,
          seconds: e.seconds,
          forward: e.forward,
          backward: e.backward,
          secret: e.secret,
        });
        add(node.counts, e.counts);
        for (const id of e.roomIds) if (!node.roomIds.includes(id)) node.roomIds.push(id);
      }
      return;
    }
    edges.push(e);
  };
  for (const p of paths) {
    const from = owners.get(p.from.roomId),
      to = owners.get(p.to.roomId);
    if (!from || !to) continue;
    let distance = 0,
      effort = 0;
    for (let i = 1; i < p.route.length; i++) {
      const a = p.route[i - 1]!,
        b = p.route[i]!,
        d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * 1.524;
      distance += d;
      effort += d * b.factor;
    }
    const a = g.drawing.passages?.find((a) => a.id === p.fromPassageId),
      b = g.drawing.passages?.find((a) => a.id === p.toPassageId),
      counts = empty();
    for (const e of g.drawing.elements.filter(
      (e) => e.roomId === p.roomId && e.kind === 'feature' && !e.archived,
    )) {
      if (e.feature === 'trap') counts.danger++;
      if (e.feature === 'encounter') {
        counts.danger++;
        counts.encounters++;
      }
      if (e.feature === 'loot') {
        counts.treasure++;
        counts.rewards++;
      }
      if (e.feature === 'curiosity' || e.feature === 'puzzle') counts.curiosities++;
      if (
        e.feature === 'puzzle' ||
        (e.feature === 'curiosity' && e.content?.tags.some((t) => t.toLowerCase() === 'puzzle'))
      )
        counts.puzzles++;
      if (e.secret) counts.secrets++;
    }
    const middle = p.roomId ? owners.get(p.roomId) : undefined;
    if (middle) {
      const half = distance / 2,
        base = Math.ceil((effort / Math.max(1, pace)) * 60),
        common = {
          roomIds: [],
          sourceIds: [p.id],
          kind: [...new Set(p.segments.map((s) => s.form))].join('/'),
          distanceMeters: half,
          secret: false,
          provisional: p.status !== 'ready' && p.mode !== 'area',
          counts: empty(),
        };
      edge({
        ...common,
        id: p.id + ':from',
        from,
        to: middle,
        seconds: Math.ceil(base / 2) + (a?.outbound.additionalSeconds ?? 0),
        forward: !!a?.assigned && a.outbound.passable,
        backward: !!a?.assigned && a.inbound.passable,
      });
      edge({
        ...common,
        id: p.id + ':to',
        from: middle,
        to,
        seconds: Math.floor(base / 2) + (b?.inbound.additionalSeconds ?? 0),
        forward: !!b?.assigned && b.inbound.passable,
        backward: !!b?.assigned && b.outbound.passable,
      });
      continue;
    }
    edge({
      id: p.id,
      from,
      to,
      roomIds: p.roomId ? [p.roomId] : [],
      sourceIds: [p.id],
      kind: [...new Set(p.segments.map((s) => s.form))].join('/'),
      seconds:
        Math.ceil((effort / Math.max(1, pace)) * 60) +
        (a?.outbound.additionalSeconds ?? 0) +
        (b?.inbound.additionalSeconds ?? 0),
      distanceMeters: distance,
      forward: !!a?.assigned && !!b?.assigned && a.outbound.passable && b.inbound.passable,
      backward: !!a?.assigned && !!b?.assigned && a.inbound.passable && b.outbound.passable,
      secret: false,
      provisional: p.status !== 'ready' && p.mode !== 'area',
      counts,
    });
  }
  for (const e of g.drawing.elements.filter(
    (e) =>
      !e.archived &&
      e.scopeId === scopeId &&
      ['door', 'stairs'].includes(e.kind) &&
      e.roomId &&
      e.targetRoomId,
  )) {
    const from = owners.get(e.roomId!),
      to = owners.get(e.targetRoomId!);
    if (!from || !to) continue;
    edge({
      id: e.id,
      from,
      to,
      roomIds: [],
      sourceIds: [e.id],
      kind: e.kind,
      seconds: 0,
      distanceMeters: 0,
      forward: e.passable && (e.kind !== 'door' || e.state === 'open'),
      backward: e.passable && (e.kind !== 'door' || e.state === 'open'),
      secret: e.secret,
      provisional: false,
      counts: empty(),
    });
  }
  for (const p of g.drawing.passages ?? []) {
    if (!p.assigned || p.scopeId !== scopeId) continue;
    for (const [side, label] of [
      [p.outbound, 'out'],
      [p.inbound, 'in'],
    ] as const) {
      if (side.target.kind === 'geometry') continue;
      const from = owners.get(p.roomId);
      if (!from) continue;
      const target = g.drawing.passages?.find((q) => q.id === side.target.id),
        to =
          (target && owners.get(target.roomId)) ||
          external(
            'link:' + p.id + ':' + label,
            target ? 'Passagenlink' : 'Ortslink / fehlendes Ziel',
          );
      edge({
        id: p.id + ':' + label,
        from,
        to,
        roomIds: [],
        sourceIds: [p.id],
        kind: side.target.kind,
        seconds: side.additionalSeconds,
        distanceMeters: 0,
        forward: side.passable,
        backward: false,
        secret: false,
        provisional: !side.target.id,
        counts: empty(),
      });
    }
  }
  for (const intent of view.layout.intents) {
    const from = intent.fromRoomId
        ? owners.get(intent.fromRoomId)
        : intent.fromGroupId
          ? nodes.find((n) =>
              n.roomIds.some((id) =>
                g.drawing.keyContent?.some((k) => k.id === id && k.groupId === intent.fromGroupId),
              ),
            )?.id
          : null,
      to = intent.toRoomId
        ? owners.get(intent.toRoomId)
        : intent.toGroupId
          ? nodes.find((n) =>
              n.roomIds.some((id) =>
                g.drawing.keyContent?.some((k) => k.id === id && k.groupId === intent.toGroupId),
              ),
            )?.id
          : null;
    if (from && to && !paths.some((p) => p.id === intent.id))
      edge({
        id: intent.id,
        from,
        to,
        roomIds: [],
        sourceIds: [intent.id],
        kind: 'Plan: ' + intent.form,
        seconds: 0,
        distanceMeters: 0,
        forward: false,
        backward: false,
        secret: false,
        provisional: true,
        counts: empty(),
      });
  }
  if (detail === 'routes' || detail === 'melan') {
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.kind !== 'room' || Object.values(n.counts).some((v) => v > 0)) continue;
        const adjacent = edges.filter((e) => e.from === n.id || e.to === n.id);
        if (
          adjacent.length !== 2 ||
          adjacent.some(
            (e) =>
              e.secret ||
              e.provisional ||
              !e.forward ||
              !e.backward ||
              e.kind.includes('stairs') ||
              e.kind.includes('ladder') ||
              e.kind.includes('shaft') ||
              e.kind === 'passage',
          )
        )
          continue;
        const a = adjacent[0]!,
          b = adjacent[1]!,
          from = a.from === n.id ? a.to : a.from,
          to = b.from === n.id ? b.to : b.from;
        if (
          from === to ||
          (detail === 'melan' &&
            edges.some(
              (e) =>
                e !== a &&
                e !== b &&
                ((e.from === from && e.to === to) || (e.to === from && e.from === to)),
            ))
        )
          continue;
        const counts = empty();
        add(counts, a.counts);
        add(counts, b.counts);
        add(counts, n.counts);
        edges.splice(edges.indexOf(a), 1);
        edges.splice(edges.indexOf(b), 1);
        nodes.splice(nodes.indexOf(n), 1);
        edge({
          id: a.id + '+' + b.id,
          from,
          to,
          roomIds: [...a.roomIds, ...n.roomIds, ...b.roomIds],
          sourceIds: [...a.sourceIds, ...b.sourceIds],
          kind: a.kind === b.kind ? a.kind : a.kind + '/' + b.kind,
          seconds: a.seconds + b.seconds,
          distanceMeters: a.distanceMeters + b.distanceMeters,
          forward: true,
          backward: true,
          secret: false,
          provisional: false,
          counts,
        });
        changed = true;
        break;
      }
    }
  }
  if (detail === 'melan') {
    for (const node of [...nodes]) {
      if (node.kind !== 'room' || Object.values(node.counts).some((n) => n > 0)) continue;
      const links = edges.filter((e) => e.from === node.id || e.to === node.id),
        route = links[0];
      if (
        links.length !== 1 ||
        !route ||
        route.secret ||
        route.provisional ||
        !route.forward ||
        !route.backward ||
        route.kind !== 'corridor' ||
        route.distanceMeters > 6.096
      )
        continue;
      const parent = nodes.find((n) => n.id === (route.from === node.id ? route.to : route.from));
      if (!parent) continue;
      parent.roomIds.push(...node.roomIds, ...route.roomIds);
      parent.internalSeconds = (parent.internalSeconds ?? 0) + route.seconds;
      nodes.splice(nodes.indexOf(node), 1);
      edges.splice(edges.indexOf(route), 1);
    }
  }
  let topology: GraphDisplay | null = null;
  if (detail === 'groups') {
    const full = graphDisplay(view, scopeId, 'rooms', pace);
    topology = full;
    for (const node of nodes.filter((n) => n.kind === 'group')) {
      const ids = new Set(node.roomIds),
        local = full.edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
        parent = new Map([...ids].map((id) => [id, id])),
        find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
      let loops = 0;
      for (const e of local) {
        const a = find(e.from),
          b = find(e.to);
        if (a === b) loops++;
        else parent.set(a, b);
      }
      node.internalLoops = loops;
      node.internalDecisions = full.nodes.filter(
        (n) =>
          ids.has(n.id) &&
          new Set(
            full.edges
              .filter((e) => e.from === n.id || e.to === n.id)
              .map((e) => (e.from === n.id ? e.to : e.from)),
          ).size >= 3,
      ).length;
    }
  }
  const component = new Map(nodes.map((n) => [n.id, n.id])),
    find = (id: string): string => (component.get(id) === id ? id : find(component.get(id)!));
  let loops = 0;
  const trivialPairs = new Set<string>();
  for (const e of edges.filter((e) => !e.provisional)) {
    const pair = [e.from, e.to].sort().join(':');
    if (e.seconds === 0 && e.kind === 'door') {
      if (trivialPairs.has(pair)) continue;
      trivialPairs.add(pair);
    }
    const a = find(e.from),
      b = find(e.to);
    if (a === b) loops++;
    else component.set(a, b);
  }
  return {
    nodes,
    edges,
    decisions:
      topology?.decisions ??
      nodes.filter((n) => edges.filter((e) => e.from === n.id || e.to === n.id).length >= 3).length,
    loops: topology?.loops ?? loops + nodes.reduce((n, node) => n + (node.internalLoops ?? 0), 0),
  };
}
