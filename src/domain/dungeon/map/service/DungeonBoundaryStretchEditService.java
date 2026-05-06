package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonBoundaryTouch;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;
import src.domain.dungeon.map.value.DungeonTopologyRef;

final class DungeonBoundaryStretchEditService {

    private static final DungeonCorridorBindingLookupService CORRIDOR_BINDING_LOOKUP_SERVICE =
            new DungeonCorridorBindingLookupService();
    private static final DungeonClusterBoundaryGeometryService GEOMETRY_SERVICE =
            new DungeonClusterBoundaryGeometryService();
    private static final DungeonRoomBoundaryPartitionService PARTITION_SERVICE =
            new DungeonRoomBoundaryPartitionService();
    private static final DungeonRoomClusterWorkService WORK_SERVICE = new DungeonRoomClusterWorkService();
    private static final DungeonRoomClusterRebuildService REBUILD_SERVICE = new DungeonRoomClusterRebuildService();

    DungeonMap moveBoundaryStretch(
            DungeonMap dungeonMap,
            long clusterId,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (invalidStretchRequest(clusterId, sourceEdges)) {
            return dungeonMap;
        }
        List<DungeonRoomTopologyClusterWork> clusters = WORK_SERVICE.workClusters(dungeonMap);
        DungeonRoomTopologyClusterWork target = clusters.stream()
                .filter(work -> work.cluster().clusterId() == clusterId)
                .findFirst()
                .orElse(null);
        if (target == null) {
            return dungeonMap;
        }
        Optional<StretchSelection> stretch = resolveStretch(target, sourceEdges, deltaQ, deltaR, deltaLevel);
        if (stretch.isEmpty() || stretch.get().stationary()) {
            return dungeonMap;
        }
        return stretch.get().outer()
                ? moveOuterStretch(dungeonMap, clusters, target, stretch.get())
                : moveInnerStretch(dungeonMap, clusters, target, stretch.get());
    }

    private Optional<StretchSelection> resolveStretch(
            DungeonRoomTopologyClusterWork target,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (changesLevel(deltaLevel)) {
            return Optional.empty();
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries = GEOMETRY_SERVICE.boundaryMap(target.cluster());
        Optional<StretchSeed> seed = stretchSeed(target, boundaries, sourceEdges);
        if (seed.isEmpty()) {
            return Optional.empty();
        }
        List<StretchEdge> sortedEdges = sortedStretchEdges(seed.get(), sourceEdges, boundaries);
        if (sortedEdges.isEmpty()) {
            return Optional.empty();
        }
        int movement = movementAlongNormal(seed.get().orientation(), deltaQ, deltaR);
        if (hasNoMovement(movement)) {
            return Optional.empty();
        }
        int startVariable = variableCoordinate(seed.get().orientation(), sortedEdges.getFirst().edge());
        Set<DungeonBoundaryKey> sourceKeys = new LinkedHashSet<>();
        for (StretchEdge stretchEdge : sortedEdges) {
            sourceKeys.add(stretchEdge.key());
        }
        return Optional.of(new StretchSelection(
                target.cluster().clusterId(),
                seed.get().level(),
                seed.get().orientation(),
                seed.get().outer(),
                seed.get().fixedCoordinate(),
                startVariable,
                startVariable + sortedEdges.size(),
                movement,
                seed.get().side(),
                sortedEdges,
                sourceKeys));
    }

    private DungeonMap moveInnerStretch(
            DungeonMap dungeonMap,
            List<DungeonRoomTopologyClusterWork> clusters,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch
    ) {
        Set<DungeonCell> levelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        if (!validInnerStretchSource(dungeonMap, target, stretch, levelCells)) {
            return dungeonMap;
        }
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries =
                new LinkedHashMap<>(GEOMETRY_SERVICE.boundaryMap(target.cluster()));
        if (!innerStretchCanMove(boundaries, stretch)
                || !applyStretchConnectors(dungeonMap, target, stretch, levelCells, boundaries, true)
                || !replaceStretchEdges(target, stretch, levelCells, boundaries)) {
            return dungeonMap;
        }
        Map<Integer, List<DungeonClusterBoundary>> nextBoundaries = GEOMETRY_SERVICE.boundariesByLevel(boundaries.values());
        DungeonRoomClusterWorkService.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
        List<DungeonRoom> rooms = PARTITION_SERVICE.roomsForBoundaryEdit(target, nextBoundaries, ids);
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == target.cluster().clusterId()
                    ? new DungeonRoomTopologyClusterWork(
                    REBUILD_SERVICE.clusterWithBoundaries(target, nextBoundaries),
                    rooms,
                    target.cellsByLevel())
                    : work);
        }
        return REBUILD_SERVICE.rebuiltPreservingRooms(dungeonMap, nextClusters);
    }

    private DungeonMap moveOuterStretch(
            DungeonMap dungeonMap,
            List<DungeonRoomTopologyClusterWork> clusters,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch
    ) {
        Map<Integer, List<DungeonCell>> nextCellsByLevel = new LinkedHashMap<>(target.cellsByLevel());
        Set<DungeonCell> currentLevelCells = new LinkedHashSet<>(target.cellsAt(stretch.level()));
        Set<DungeonCell> stripCells = stripCells(stretch);
        if (stripCells.isEmpty()) {
            return dungeonMap;
        }
        if (stretch.movesOutward()) {
            currentLevelCells.addAll(stripCells);
        } else {
            currentLevelCells.removeAll(stripCells);
        }
        if (currentLevelCells.isEmpty()) {
            return dungeonMap;
        }
        nextCellsByLevel.put(stretch.level(), DungeonRoomCellProjector.sortedCells(currentLevelCells));
        Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries =
                new LinkedHashMap<>(GEOMETRY_SERVICE.boundaryMap(target.cluster()));
        for (BoundaryVertex vertex : stretch.vertices()) {
            if (!hasPerpendicularBoundary(boundaries, stretch.sourceKeys(), vertex, stretch.orientation())) {
                continue;
            }
            if (!applyConnectorPath(dungeonMap, target, stretch, currentLevelCells, boundaries, vertex)) {
                return dungeonMap;
            }
        }
        Map<Integer, List<DungeonClusterBoundary>> nextBoundaries = GEOMETRY_SERVICE.filterBoundaries(
                boundaries.values(),
                nextCellsByLevel,
                target.cluster().center());
        DungeonRoomClusterWorkService.IdAllocation ids = WORK_SERVICE.newIdAllocation(dungeonMap);
        DungeonRoomTopologyClusterWork nextWork =
                new DungeonRoomTopologyClusterWork(target.cluster(), target.rooms(), nextCellsByLevel);
        List<DungeonRoom> rooms = PARTITION_SERVICE.roomsForBoundaryEdit(nextWork, nextBoundaries, ids);
        List<DungeonRoomTopologyClusterWork> nextClusters = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : clusters) {
            nextClusters.add(work.cluster().clusterId() == target.cluster().clusterId()
                    ? new DungeonRoomTopologyClusterWork(
                    REBUILD_SERVICE.clusterForStretch(nextWork, nextBoundaries),
                    rooms,
                    nextCellsByLevel)
                    : work);
        }
        return REBUILD_SERVICE.rebuiltPreservingRooms(dungeonMap, nextClusters);
    }

    private Optional<StretchSeed> stretchSeed(
            DungeonRoomTopologyClusterWork target,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            List<DungeonEdge> sourceEdges
    ) {
        DungeonEdge firstEdge = sourceEdges == null || sourceEdges.isEmpty() ? null : sourceEdges.getFirst();
        if (firstEdge == null || firstEdge.from() == null || firstEdge.to() == null) {
            return Optional.empty();
        }
        Optional<Orientation> orientation = Orientation.from(firstEdge);
        if (orientation.isEmpty()) {
            return Optional.empty();
        }
        int level = firstEdge.from().level();
        Set<DungeonCell> clusterCells = new LinkedHashSet<>(target.cellsAt(level));
        if (clusterCells.isEmpty()) {
            return Optional.empty();
        }
        return stretchSeed(boundaries, firstEdge, clusterCells);
    }

    private Optional<StretchSeed> stretchSeed(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonEdge edge,
            Set<DungeonCell> clusterCells
    ) {
        Optional<Orientation> orientation = Orientation.from(edge);
        if (orientation.isEmpty()) {
            return Optional.empty();
        }
        int fixedCoordinate = fixedCoordinate(orientation.get(), edge);
        DungeonBoundaryTouch touch = touch(edge, clusterCells);
        if (!touch.valid()) {
            return Optional.empty();
        }
        BoundarySide side = BoundarySide.resolve(orientation.get(), touch, fixedCoordinate);
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        DungeonClusterBoundary existing = boundaries.get(key);
        boolean outer = touch.insideCount() == 1;
        if ((outer && existing != null) || (!outer && existing == null)) {
            return Optional.empty();
        }
        return Optional.of(new StretchSeed(
                edge.from().level(),
                orientation.get(),
                fixedCoordinate,
                outer,
                side,
                Set.copyOf(clusterCells)));
    }

    private Optional<StretchEdge> matchingStretchEdge(
            StretchSeed seed,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonEdge edge
    ) {
        if (edge == null || edge.from() == null || edge.to() == null || edge.from().level() != seed.level()) {
            return Optional.empty();
        }
        Optional<Orientation> orientation = Orientation.from(edge);
        if (orientation.isEmpty() || orientation.get() != seed.orientation()
                || fixedCoordinate(orientation.get(), edge) != seed.fixedCoordinate()) {
            return Optional.empty();
        }
        DungeonBoundaryTouch touch = touch(edge, seed.clusterCells());
        if (!touch.valid()
                || seed.outer() != (touch.insideCount() == 1)
                || seed.side() != BoundarySide.resolve(orientation.get(), touch, seed.fixedCoordinate())) {
            return Optional.empty();
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        DungeonClusterBoundary existing = boundaries.get(key);
        if ((seed.outer() && existing != null) || (!seed.outer() && existing == null)) {
            return Optional.empty();
        }
        return Optional.of(new StretchEdge(edge, key, existing));
    }

    private List<StretchEdge> sortedStretchEdges(
            StretchSeed seed,
            List<DungeonEdge> sourceEdges,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        List<StretchEdge> stretchEdges = new ArrayList<>();
        for (DungeonEdge edge : sourceEdges) {
            Optional<StretchEdge> stretchEdge = matchingStretchEdge(seed, boundaries, edge);
            if (stretchEdge.isEmpty()) {
                return List.of();
            }
            stretchEdges.add(stretchEdge.get());
        }
        List<StretchEdge> sortedEdges = stretchEdges.stream()
                .sorted(java.util.Comparator.comparingInt(edge -> variableCoordinate(seed.orientation(), edge.edge())))
                .toList();
        if (sortedEdges.isEmpty()) {
            return List.of();
        }
        int startVariable = variableCoordinate(seed.orientation(), sortedEdges.getFirst().edge());
        for (int index = 0; index < sortedEdges.size(); index++) {
            if (variableCoordinate(seed.orientation(), sortedEdges.get(index).edge()) != startVariable + index) {
                return List.of();
            }
        }
        return sortedEdges;
    }

    private boolean validInnerStretchSource(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> levelCells
    ) {
        return sourceStaysInternal(stretch, levelCells)
                && !CORRIDOR_BINDING_LOOKUP_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                stretch.level(),
                stretch.sourceKeys());
    }

    private boolean innerStretchCanMove(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            StretchSelection stretch
    ) {
        List<BoundaryVertex> vertices = stretch.vertices();
        for (int index = 1; index < vertices.size() - 1; index++) {
            if (hasPerpendicularBoundary(boundaries, stretch.sourceKeys(), vertices.get(index), stretch.orientation())) {
                return false;
            }
        }
        return true;
    }

    private boolean applyStretchConnectors(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            boolean requireTouch
    ) {
        for (BoundaryVertex endpoint : List.of(stretch.vertices().getFirst(), stretch.vertices().getLast())) {
            boolean touchesOuter = touchesOuterBoundary(clusterCells, endpoint);
            boolean hasAttachment =
                    hasPerpendicularBoundary(boundaries, stretch.sourceKeys(), endpoint, stretch.orientation());
            if (requireTouch && !touchesOuter && !hasAttachment) {
                continue;
            }
            if (!applyConnectorPath(dungeonMap, target, stretch, clusterCells, boundaries, endpoint)) {
                return false;
            }
        }
        return true;
    }

    private boolean applyConnectorPath(
            DungeonMap dungeonMap,
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> clusterCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            BoundaryVertex endpoint
    ) {
        List<DungeonEdge> connectorPath = stretch.connectorPath(endpoint);
        if (connectorPath.isEmpty()) {
            return true;
        }
        if (CORRIDOR_BINDING_LOOKUP_SERVICE.touchesCorridorBinding(
                dungeonMap,
                target.cluster().center(),
                target.cluster().clusterId(),
                stretch.level(),
                connectorPath)) {
            return false;
        }
        Optional<ConnectorAction> connectorAction = connectorAction(boundaries, stretch.sourceKeys(), connectorPath);
        if (connectorAction.isEmpty()) {
            return false;
        }
        applyConnectorAction(boundaries, connectorAction.get(), target.cluster().center(), clusterCells, target.cluster().clusterId());
        return true;
    }

    private boolean replaceStretchEdges(
            DungeonRoomTopologyClusterWork target,
            StretchSelection stretch,
            Set<DungeonCell> levelCells,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        for (StretchEdge edge : stretch.edges()) {
            boundaries.remove(edge.key());
        }
        for (StretchEdge edge : stretch.edges()) {
            DungeonEdge movedEdge = moveEdge(edge.edge(), stretch.orientation(), stretch.movement());
            DungeonBoundaryKey movedKey = DungeonBoundaryKey.from(movedEdge);
            if (boundaries.containsKey(movedKey)) {
                return false;
            }
            DungeonClusterBoundary moved = GEOMETRY_SERVICE.boundaryForEdge(
                    levelCells,
                    target.cluster().center(),
                    target.cluster().clusterId(),
                    movedEdge,
                    edge.kind(),
                    preserveTopologyRef(edge, target.cluster().center()).orElse(null));
            if (moved == null) {
                return false;
            }
            boundaries.put(movedKey, moved);
        }
        return true;
    }

    private Optional<ConnectorAction> connectorAction(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            List<DungeonEdge> path
    ) {
        if (path.isEmpty()) {
            return Optional.empty();
        }
        List<DungeonBoundaryKey> keys = path.stream().map(DungeonBoundaryKey::from).toList();
        long presentCount = keys.stream()
                .filter(key -> !sourceKeys.contains(key) && boundaries.containsKey(key))
                .count();
        if (hasNoPresentBoundaries(presentCount)) {
            return Optional.of(new ConnectorAction(ConnectorMode.ADD, path));
        }
        if (presentCount != keys.size()) {
            return Optional.empty();
        }
        for (DungeonBoundaryKey key : keys) {
            DungeonClusterBoundary boundary = boundaries.get(key);
            if (boundary == null || sourceKeys.contains(key) || boundary.kind() == DungeonClusterBoundaryKind.DOOR) {
                return Optional.empty();
            }
        }
        return Optional.of(new ConnectorAction(ConnectorMode.REMOVE, path));
    }

    private void applyConnectorAction(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            ConnectorAction action,
            DungeonCell center,
            Set<DungeonCell> clusterCells,
            long clusterId
    ) {
        if (action.mode() == ConnectorMode.REMOVE) {
            for (DungeonEdge edge : action.path()) {
                boundaries.remove(DungeonBoundaryKey.from(edge));
            }
            return;
        }
        for (DungeonEdge edge : action.path()) {
            DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
            if (boundaries.containsKey(key)) {
                continue;
            }
            DungeonClusterBoundary connector = GEOMETRY_SERVICE.boundaryForEdge(
                    clusterCells,
                    center,
                    clusterId,
                    edge,
                    DungeonClusterBoundaryKind.WALL,
                    null);
            if (connector != null) {
                boundaries.put(key, connector);
            }
        }
    }

    private boolean sourceStaysInternal(StretchSelection stretch, Set<DungeonCell> clusterCells) {
        for (StretchEdge edge : stretch.edges()) {
            DungeonBoundaryTouch movedTouch =
                    touch(moveEdge(edge.edge(), stretch.orientation(), stretch.movement()), clusterCells);
            if (!movedTouch.valid() || !movedTouch.hasTwoInsideCells()) {
                return false;
            }
        }
        return true;
    }

    private boolean invalidStretchRequest(long clusterId, List<DungeonEdge> sourceEdges) {
        return clusterId <= 0L || sourceEdges == null || sourceEdges.isEmpty();
    }

    private boolean changesLevel(int deltaLevel) {
        return deltaLevel != 0;
    }

    private boolean hasNoMovement(int movement) {
        return movement == 0;
    }

    private boolean hasNoPresentBoundaries(long presentCount) {
        return presentCount == 0L;
    }

    private boolean hasPerpendicularBoundary(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            Set<DungeonBoundaryKey> sourceKeys,
            BoundaryVertex vertex,
            Orientation sourceOrientation
    ) {
        for (Map.Entry<DungeonBoundaryKey, DungeonClusterBoundary> entry : boundaries.entrySet()) {
            if (sourceKeys.contains(entry.getKey())) {
                continue;
            }
            if (sourceOrientation.perpendicularTo(Orientation.from(entry.getKey()).orElse(null))
                    && touches(entry.getKey(), vertex)) {
                return true;
            }
        }
        return false;
    }

    private boolean touches(DungeonBoundaryKey key, BoundaryVertex vertex) {
        return sameVertex(key.lower(), vertex) || sameVertex(key.upper(), vertex);
    }

    private boolean sameVertex(DungeonCell cell, BoundaryVertex vertex) {
        return cell != null
                && vertex != null
                && cell.q() == vertex.q()
                && cell.r() == vertex.r()
                && cell.level() == vertex.level();
    }

    private boolean touchesOuterBoundary(Set<DungeonCell> clusterCells, BoundaryVertex vertex) {
        for (DungeonCell cell : clusterCells) {
            for (src.domain.dungeon.map.value.DungeonEdgeDirection direction :
                    src.domain.dungeon.map.value.DungeonEdgeDirection.values()) {
                DungeonCell neighbor = direction.neighborOf(cell);
                if (clusterCells.contains(neighbor)) {
                    continue;
                }
                if (touches(DungeonBoundaryKey.from(DungeonEdge.sideOf(cell, direction)), vertex)) {
                    return true;
                }
            }
        }
        return false;
    }

    private Set<DungeonCell> stripCells(StretchSelection stretch) {
        Set<DungeonCell> result = new LinkedHashSet<>();
        if (stretch.orientation() == Orientation.VERTICAL) {
            int minQ = Math.min(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            int maxQ = Math.max(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            for (int q = minQ; q < maxQ; q++) {
                for (int r = stretch.startVariable(); r < stretch.endVariable(); r++) {
                    result.add(new DungeonCell(q, r, stretch.level()));
                }
            }
        } else {
            int minR = Math.min(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            int maxR = Math.max(stretch.fixedCoordinate(), stretch.fixedCoordinate() + stretch.movement());
            for (int r = minR; r < maxR; r++) {
                for (int q = stretch.startVariable(); q < stretch.endVariable(); q++) {
                    result.add(new DungeonCell(q, r, stretch.level()));
                }
            }
        }
        return Set.copyOf(result);
    }

    private DungeonBoundaryTouch touch(DungeonEdge edge, Set<DungeonCell> clusterCells) {
        List<DungeonCell> insideCells = edge.touchingCells().stream()
                .filter(clusterCells::contains)
                .toList();
        return new DungeonBoundaryTouch(insideCells);
    }

    private int fixedCoordinate(Orientation orientation, DungeonEdge edge) {
        return orientation == Orientation.VERTICAL ? edge.from().q() : edge.from().r();
    }

    private int variableCoordinate(Orientation orientation, DungeonEdge edge) {
        return orientation == Orientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private int movementAlongNormal(Orientation orientation, int deltaQ, int deltaR) {
        return switch (orientation) {
            case VERTICAL -> deltaR == 0 ? deltaQ : 0;
            case HORIZONTAL -> deltaQ == 0 ? deltaR : 0;
        };
    }

    private DungeonEdge moveEdge(DungeonEdge edge, Orientation orientation, int movement) {
        return switch (orientation) {
            case VERTICAL -> new DungeonEdge(
                    new DungeonCell(edge.from().q() + movement, edge.from().r(), edge.from().level()),
                    new DungeonCell(edge.to().q() + movement, edge.to().r(), edge.to().level()));
            case HORIZONTAL -> new DungeonEdge(
                    new DungeonCell(edge.from().q(), edge.from().r() + movement, edge.from().level()),
                    new DungeonCell(edge.to().q(), edge.to().r() + movement, edge.to().level()));
        };
    }

    private Optional<DungeonTopologyRef> preserveTopologyRef(
            StretchEdge edge,
            DungeonCell center
    ) {
        if (edge.existing() == null) {
            return Optional.empty();
        }
        return edge.existing().topologyRef().present()
                ? Optional.of(edge.existing().topologyRef())
                : Optional.of(edge.existing().resolvedTopologyRef(center));
    }

    private enum Orientation {
        HORIZONTAL,
        VERTICAL;

        private static Optional<Orientation> from(DungeonEdge edge) {
            if (edge == null || edge.from() == null || edge.to() == null) {
                return Optional.empty();
            }
            if (edge.from().q() == edge.to().q()) {
                return Optional.of(VERTICAL);
            }
            if (edge.from().r() == edge.to().r()) {
                return Optional.of(HORIZONTAL);
            }
            return Optional.empty();
        }

        private static Optional<Orientation> from(DungeonBoundaryKey key) {
            if (key == null) {
                return Optional.empty();
            }
            return Optional.of(key.lower().q() == key.upper().q() ? VERTICAL : HORIZONTAL);
        }

        private boolean perpendicularTo(@Nullable Orientation other) {
            return other != null && this != other;
        }
    }

    private enum BoundarySide {
        NORTH,
        SOUTH,
        EAST,
        WEST;

        private static BoundarySide resolve(Orientation orientation, DungeonBoundaryTouch touch, int fixedCoordinate) {
            if (orientation == Orientation.VERTICAL) {
                return touch.insideCells().stream().anyMatch(cell -> cell.q() == fixedCoordinate - 1)
                        ? WEST
                        : EAST;
            }
            return touch.insideCells().stream().anyMatch(cell -> cell.r() == fixedCoordinate - 1)
                    ? NORTH
                    : SOUTH;
        }
    }

    private enum ConnectorMode {
        ADD,
        REMOVE
    }

    private record ConnectorAction(ConnectorMode mode, List<DungeonEdge> path) {
    }

    private record StretchEdge(
            DungeonEdge edge,
            DungeonBoundaryKey key,
            @Nullable DungeonClusterBoundary existing
    ) {
        private DungeonClusterBoundaryKind kind() {
            return existing == null ? DungeonClusterBoundaryKind.WALL : existing.kind();
        }
    }

    private record StretchSeed(
            int level,
            Orientation orientation,
            int fixedCoordinate,
            boolean outer,
            BoundarySide side,
            Set<DungeonCell> clusterCells
    ) {
        private StretchSeed {
            clusterCells = clusterCells == null ? Set.of() : Set.copyOf(clusterCells);
        }
    }

    private record BoundaryVertex(int q, int r, int level) {
    }

    private record StretchSelection(
            long clusterId,
            int level,
            Orientation orientation,
            boolean outer,
            int fixedCoordinate,
            int startVariable,
            int endVariable,
            int movement,
            BoundarySide side,
            List<StretchEdge> edges,
            Set<DungeonBoundaryKey> sourceKeys
    ) {
        private StretchSelection {
            edges = edges == null ? List.of() : List.copyOf(edges);
            sourceKeys = sourceKeys == null ? Set.of() : Set.copyOf(sourceKeys);
        }

        private boolean stationary() {
            return movement == 0;
        }

        private boolean movesOutward() {
            return switch (side) {
                case WEST -> movement > 0;
                case EAST -> movement < 0;
                case NORTH -> movement > 0;
                case SOUTH -> movement < 0;
            };
        }

        private List<BoundaryVertex> vertices() {
            List<BoundaryVertex> result = new ArrayList<>();
            if (orientation == Orientation.VERTICAL) {
                for (int r = startVariable; r <= endVariable; r++) {
                    result.add(new BoundaryVertex(fixedCoordinate, r, level));
                }
            } else {
                for (int q = startVariable; q <= endVariable; q++) {
                    result.add(new BoundaryVertex(q, fixedCoordinate, level));
                }
            }
            return List.copyOf(result);
        }

        private List<DungeonEdge> connectorPath(BoundaryVertex vertex) {
            BoundaryVertex moved = orientation == Orientation.VERTICAL
                    ? new BoundaryVertex(vertex.q() + movement, vertex.r(), vertex.level())
                    : new BoundaryVertex(vertex.q(), vertex.r() + movement, vertex.level());
            if (vertex.equals(moved)) {
                return List.of();
            }
            List<DungeonEdge> result = new ArrayList<>();
            if (vertex.q() == moved.q()) {
                int step = Integer.compare(moved.r(), vertex.r());
                for (int r = vertex.r(); r != moved.r(); r += step) {
                    result.add(new DungeonEdge(
                            new DungeonCell(vertex.q(), r, vertex.level()),
                            new DungeonCell(vertex.q(), r + step, vertex.level())));
                }
            } else {
                int step = Integer.compare(moved.q(), vertex.q());
                for (int q = vertex.q(); q != moved.q(); q += step) {
                    result.add(new DungeonEdge(
                            new DungeonCell(q, vertex.r(), vertex.level()),
                            new DungeonCell(q + step, vertex.r(), vertex.level())));
                }
            }
            return List.copyOf(result);
        }
    }
}
