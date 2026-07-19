package features.dungeon.application.travel.projection;

import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.BoundaryData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.MapData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.TopologyKind;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.CellOrdering;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.stair.Stair;
import features.dungeon.domain.core.structure.transition.Transition;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Projects one sparse window and its exact Travel closure without rebuilding a DungeonMap. */
public final class TravelWindowProjectionMapper {

    private TravelWindowProjectionMapper() {
    }

    public static TravelAuthoredSurface from(
            DungeonMapHeader header,
            DungeonWindow window,
            List<DungeonEntitySnapshot> closure
    ) {
        ProjectionState state = ProjectionState.from(window, closure);
        return new TravelAuthoredSurface(
                new TravelAuthoredSurface.Header(
                        header.mapId().value(), header.mapName(), header.revision()),
                new TravelAuthoredSurface.Content(
                        state.mapData(),
                        TravelAuthoredSurfaceTransitionProjectionMapper.toTransitions(state.transitions()),
                        state.traversalLinks(),
                        state.connections(),
                        state.roomNarrations()));
    }

    public static TravelAuthoredSurface empty(DungeonMapHeader header) {
        return new TravelAuthoredSurface(
                new TravelAuthoredSurface.Header(
                        header.mapId().value(), header.mapName(), header.revision()),
                new TravelAuthoredSurface.Content(MapData.empty(), List.of(), List.of(), List.of(), List.of()));
    }

    public static boolean containsCell(DungeonWindow window, Cell cell) {
        if (window == null || cell == null) {
            return false;
        }
        for (DungeonWindowEntityFragment fragment : window.fragments()) {
            if (fragmentCells(fragment).contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private record ProjectionState(
            MapData mapData,
            List<Transition> transitions,
            List<TravelAuthoredSurface.TraversalLinkInput> traversalLinks,
            List<TravelAuthoredSurface.CorridorConnection> connections,
            List<TravelAuthoredSurface.RoomNarration> roomNarrations
    ) {
        private static ProjectionState from(
                DungeonWindow window,
                List<DungeonEntitySnapshot> closure
        ) {
            List<AreaData> areas = areas(window);
            List<BoundaryData> boundaries = boundaries(window);
            List<Stair> stairs = stairs(closure);
            List<Transition> transitions = TravelWindowProjectionMapper.transitions(closure);
            List<FeatureData> features = features(stairs, transitions);
            MapData map = new MapData(
                    TopologyKind.SQUARE,
                    width(areas),
                    height(areas),
                    areas,
                    boundaries,
                    features);
            return new ProjectionState(
                    map,
                    transitions,
                    TravelWindowProjectionMapper.traversalLinks(map, stairs),
                    TravelWindowProjectionMapper.connections(window),
                    TravelWindowProjectionMapper.roomNarrations(window));
        }
    }

    private static List<AreaData> areas(DungeonWindow window) {
        Map<String, AreaData> result = new LinkedHashMap<>();
        for (DungeonWindowEntityFragment fragment : window.fragments()) {
            if (fragment instanceof DungeonWindowEntityFragment.Room room) {
                result.put("room:" + room.entityRef().id(), new AreaData(
                        AreaKind.ROOM,
                        room.entityRef().id(),
                        room.name(),
                        room.floorCells(),
                        new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, room.entityRef().id())));
            } else if (fragment instanceof DungeonWindowEntityFragment.Corridor corridor) {
                result.put("corridor:" + corridor.entityRef().id(), new AreaData(
                        AreaKind.CORRIDOR,
                        corridor.entityRef().id(),
                        "Corridor " + corridor.entityRef().id(),
                        corridorCells(corridor),
                        new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridor.entityRef().id())));
            }
        }
        return List.copyOf(result.values());
    }

    private static List<Cell> corridorCells(DungeonWindowEntityFragment.Corridor corridor) {
        Set<Cell> cells = new LinkedHashSet<>();
        corridor.routeCells().forEach(fact -> cells.add(fact.cell()));
        corridor.waypoints().forEach(fact -> cells.add(fact.absoluteCell()));
        corridor.doorBindings().forEach(fact -> cells.add(fact.absoluteCell()));
        corridor.anchorBindings().forEach(fact -> cells.add(fact.cell()));
        corridor.anchorRefs().forEach(fact -> cells.add(fact.resolvedCell()));
        return CellOrdering.sortedCells(cells);
    }

    private static List<BoundaryData> boundaries(DungeonWindow window) {
        Map<DungeonBoundaryKey, BoundaryData> result = new LinkedHashMap<>();
        for (DungeonWindowEntityFragment fragment : window.fragments()) {
            if (fragment instanceof DungeonWindowEntityFragment.RoomCluster cluster) {
                for (DungeonWindowEntityFragment.ClusterBoundaryFact boundary : cluster.boundaries()) {
                    if (boundary.kind() != DungeonWindowEntityFragment.BoundaryKind.OPEN) {
                        addBoundary(result, boundary.cell(), boundary.direction(),
                                boundary.kind() == DungeonWindowEntityFragment.BoundaryKind.DOOR,
                                boundary.topologyRef());
                    }
                }
            } else if (fragment instanceof DungeonWindowEntityFragment.Corridor corridor) {
                for (DungeonWindowEntityFragment.CorridorDoorFact door : corridor.doorBindings()) {
                    addBoundary(result, door.absoluteCell(), door.direction(), true, door.topologyRef());
                }
            }
        }
        return List.copyOf(result.values());
    }

    private static void addBoundary(
            Map<DungeonBoundaryKey, BoundaryData> result,
            Cell cell,
            Direction direction,
            boolean door,
            DungeonTopologyRef topologyRef
    ) {
        Edge edge = direction.edgeOf(cell);
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        long id = topologyRef != null && topologyRef.present() ? topologyRef.id() : key.stableId();
        result.putIfAbsent(key, new BoundaryData(
                door,
                id,
                door ? "Door" : "Wall",
                edge,
                topologyRef));
    }

    private static List<Stair> stairs(List<DungeonEntitySnapshot> closure) {
        List<Stair> result = new ArrayList<>();
        for (DungeonEntitySnapshot snapshot : safeClosure(closure)) {
            if (snapshot instanceof DungeonEntitySnapshot.StairSnapshot stair) {
                result.add(stair.value());
            }
        }
        result.sort(Comparator.comparingLong(Stair::stairId));
        return List.copyOf(result);
    }

    private static List<Transition> transitions(List<DungeonEntitySnapshot> closure) {
        List<Transition> result = new ArrayList<>();
        for (DungeonEntitySnapshot snapshot : safeClosure(closure)) {
            if (snapshot instanceof DungeonEntitySnapshot.TransitionSnapshot transition) {
                result.add(transition.value());
            }
        }
        result.sort(Comparator.comparingLong(Transition::transitionId));
        return List.copyOf(result);
    }

    private static List<FeatureData> features(List<Stair> stairs, List<Transition> transitions) {
        List<FeatureData> result = new ArrayList<>();
        for (Stair stair : stairs) {
            if (!stair.isReadable()) {
                continue;
            }
            List<String> labels = stair.exits().stream()
                    .map(StairExit::label)
                    .filter(label -> label != null && !label.isBlank())
                    .distinct()
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
            result.add(new FeatureData(
                    FeatureKind.STAIR,
                    stair.stairId(),
                    stair.name(),
                    CellOrdering.sortedCells(stair.occupiedCells()),
                    stair.name() + " verbindet " + stair.exits().size() + " Ausgaenge.",
                    String.join(", ", labels),
                    new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stair.stairId())));
        }
        for (Transition transition : transitions) {
            if (!transition.isPlaced()) {
                continue;
            }
            List<Cell> cells = transition.anchor().isEdge() || transition.anchorCell() == null
                    ? List.of()
                    : List.of(transition.anchorCell());
            result.add(new FeatureData(
                    FeatureKind.TRANSITION,
                    transition.transitionId(),
                    transition.label(),
                    cells,
                    transition.description(),
                    transition.destination().label(),
                    new DungeonTopologyRef(DungeonTopologyElementKind.TRANSITION, transition.transitionId())));
        }
        return List.copyOf(result);
    }

    private static List<TravelAuthoredSurface.CorridorConnection> connections(DungeonWindow window) {
        Set<TravelAuthoredSurface.CorridorConnection> result = new LinkedHashSet<>();
        for (DungeonWindowEntityFragment fragment : window.fragments()) {
            if (fragment instanceof DungeonWindowEntityFragment.Corridor corridor) {
                corridor.roomIds().forEach(roomId -> result.add(
                        new TravelAuthoredSurface.CorridorConnection(corridor.entityRef().id(), roomId)));
            }
        }
        return List.copyOf(result);
    }

    private static List<TravelAuthoredSurface.RoomNarration> roomNarrations(DungeonWindow window) {
        List<TravelAuthoredSurface.RoomNarration> result = new ArrayList<>();
        for (DungeonWindowEntityFragment fragment : window.fragments()) {
            if (fragment instanceof DungeonWindowEntityFragment.Room room) {
                result.add(new TravelAuthoredSurface.RoomNarration(
                        room.entityRef().id(),
                        room.exitDescriptions().stream()
                                .map(exit -> new TravelAuthoredSurface.RoomExit(
                                        exit.cell(), exit.direction(), exit.description()))
                                .toList()));
            }
        }
        return List.copyOf(result);
    }

    private static List<TravelAuthoredSurface.TraversalLinkInput> traversalLinks(
            MapData map,
            List<Stair> stairs
    ) {
        Map<Cell, AreaData> areaByCell = areaIndex(map.areas());
        List<TravelAuthoredSurface.TraversalLinkInput> result = new ArrayList<>();
        appendDoorLinks(result, map.boundaries(), areaByCell);
        appendCorridorLinks(result, map.areas());
        appendStairLinks(result, stairs, areaByCell);
        return List.copyOf(result);
    }

    private static void appendDoorLinks(
            List<TravelAuthoredSurface.TraversalLinkInput> result,
            List<BoundaryData> boundaries,
            Map<Cell, AreaData> areaByCell
    ) {
        for (BoundaryData boundary : boundaries) {
            List<Cell> cells = boundary.edge().touchingCells();
            if (!boundary.doorBoundary() || cells.size() != 2
                    || !areaByCell.containsKey(cells.get(0)) || !areaByCell.containsKey(cells.get(1))) {
                continue;
            }
            result.add(link(
                    TraversalSourceKind.DOOR,
                    boundary.id(),
                    boundary.label(),
                    cells.get(0), areaByCell.get(cells.get(0)),
                    cells.get(1), areaByCell.get(cells.get(1))));
        }
    }

    private static void appendCorridorLinks(
            List<TravelAuthoredSurface.TraversalLinkInput> result,
            List<AreaData> areas
    ) {
        for (AreaData area : areas) {
            if (area.kind() != AreaKind.CORRIDOR) {
                continue;
            }
            Set<Cell> cells = Set.copyOf(area.cells());
            Set<String> seen = new LinkedHashSet<>();
            for (Cell first : area.cells()) {
                for (Direction direction : Direction.values()) {
                    Cell second = direction.neighborOf(first);
                    String key = pairKey(first, second);
                    if (cells.contains(second) && seen.add(key)) {
                        result.add(link(
                                TraversalSourceKind.CORRIDOR,
                                area.id(), area.label(),
                                first, area, second, area));
                    }
                }
            }
        }
    }

    private static void appendStairLinks(
            List<TravelAuthoredSurface.TraversalLinkInput> result,
            List<Stair> stairs,
            Map<Cell, AreaData> areaByCell
    ) {
        for (Stair stair : stairs) {
            for (int left = 0; left < stair.exits().size(); left++) {
                for (int right = left + 1; right < stair.exits().size(); right++) {
                    StairExit first = stair.exits().get(left);
                    StairExit second = stair.exits().get(right);
                    result.add(link(
                            TraversalSourceKind.STAIR,
                            stair.stairId(), stair.name(),
                            first.position(), areaByCell.get(first.position()), first.label(),
                            second.position(), areaByCell.get(second.position()), second.label()));
                }
            }
        }
    }

    private static TravelAuthoredSurface.TraversalLinkInput link(
            TraversalSourceKind kind,
            long id,
            String label,
            Cell first,
            AreaData firstArea,
            Cell second,
            AreaData secondArea
    ) {
        return link(kind, id, label, first, firstArea, "", second, secondArea, "");
    }

    private static TravelAuthoredSurface.TraversalLinkInput link(
            TraversalSourceKind kind,
            long id,
            String label,
            Cell first,
            AreaData firstArea,
            String firstFallbackLabel,
            Cell second,
            AreaData secondArea,
            String secondFallbackLabel
    ) {
        return new TravelAuthoredSurface.TraversalLinkInput(
                kind.name().toLowerCase(Locale.ROOT) + ":" + id + ":" + pairKey(first, second),
                new TraversalSource(kind, id, label),
                endpoint(first, firstArea, firstFallbackLabel),
                endpoint(second, secondArea, secondFallbackLabel));
    }

    private static TraversalEndpoint endpoint(Cell cell, AreaData area, String fallbackLabel) {
        return new TraversalEndpoint(
                cell,
                area == null ? 0L : area.id(),
                area == null ? fallbackLabel : area.label());
    }

    private static Map<Cell, AreaData> areaIndex(List<AreaData> areas) {
        Map<Cell, AreaData> result = new LinkedHashMap<>();
        for (AreaData area : areas) {
            area.cells().forEach(cell -> result.putIfAbsent(cell, area));
        }
        return Map.copyOf(result);
    }

    private static String pairKey(Cell first, Cell second) {
        String left = cellKey(first);
        String right = cellKey(second);
        return left.compareTo(right) <= 0 ? left + ":" + right : right + ":" + left;
    }

    private static String cellKey(Cell cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    private static int width(List<AreaData> areas) {
        return Math.max(10, bounds(areas).maxQ() - Math.min(0, bounds(areas).minQ()) + 6);
    }

    private static int height(List<AreaData> areas) {
        return Math.max(8, bounds(areas).maxR() - Math.min(0, bounds(areas).minR()) + 6);
    }

    private static Bounds bounds(List<AreaData> areas) {
        int minQ = 0;
        int minR = 0;
        int maxQ = 0;
        int maxR = 0;
        boolean found = false;
        for (AreaData area : areas) {
            for (Cell cell : area.cells()) {
                minQ = found ? Math.min(minQ, cell.q()) : cell.q();
                minR = found ? Math.min(minR, cell.r()) : cell.r();
                maxQ = found ? Math.max(maxQ, cell.q()) : cell.q();
                maxR = found ? Math.max(maxR, cell.r()) : cell.r();
                found = true;
            }
        }
        return new Bounds(minQ, minR, maxQ, maxR);
    }

    private static List<Cell> fragmentCells(DungeonWindowEntityFragment fragment) {
        if (fragment instanceof DungeonWindowEntityFragment.Room room) {
            return room.floorCells();
        }
        if (fragment instanceof DungeonWindowEntityFragment.RoomCluster cluster) {
            return cluster.memberCells().stream().map(DungeonWindowEntityFragment.ClusterMemberCellFact::cell).toList();
        }
        if (fragment instanceof DungeonWindowEntityFragment.Corridor corridor) {
            return corridorCells(corridor);
        }
        if (fragment instanceof DungeonWindowEntityFragment.Stair stair) {
            List<Cell> result = new ArrayList<>();
            stair.path().forEach(fact -> result.add(fact.cell()));
            stair.exits().forEach(fact -> result.add(fact.cell()));
            return List.copyOf(result);
        }
        if (fragment instanceof DungeonWindowEntityFragment.Transition transition) {
            return transition.anchor().travelCell() == null ? List.of() : List.of(transition.anchor().travelCell());
        }
        if (fragment instanceof DungeonWindowEntityFragment.FeatureMarker marker) {
            return List.of(marker.anchor());
        }
        return List.of();
    }

    private static List<DungeonEntitySnapshot> safeClosure(List<DungeonEntitySnapshot> closure) {
        return closure == null ? List.of() : closure;
    }

    private record Bounds(int minQ, int minR, int maxQ, int maxR) {
    }
}
