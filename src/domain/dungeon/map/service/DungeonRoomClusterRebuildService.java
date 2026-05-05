package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonCorridor;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorDoorBinding;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.RoomCatalog;
import src.domain.dungeon.map.value.SpatialTopology;

final class DungeonRoomClusterRebuildService {

    private static final DungeonRoomCellProjector CELL_PROJECTOR = new DungeonRoomCellProjector();

    List<DungeonRoomTopologyClusterWork> workClusters(DungeonMap dungeonMap) {
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(dungeonMap.rooms().rooms());
        List<DungeonRoomTopologyClusterWork> result = new ArrayList<>();
        for (DungeonRoomCluster cluster : dungeonMap.topology().roomClusters()) {
            List<DungeonRoom> rooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            result.add(new DungeonRoomTopologyClusterWork(
                    cluster,
                    rooms,
                    CELL_PROJECTOR.cellsByLevel(cluster, rooms)));
        }
        return result;
    }

    List<DungeonRoomTopologyClusterWork> affectedClusters(
            List<DungeonRoomTopologyClusterWork> clusters,
            Set<DungeonCell> cells
    ) {
        return clusters.stream()
                .filter(work -> intersects(work.cellsAt(cells.iterator().next().level()), cells))
                .toList();
    }

    IdAllocation newIdAllocation(DungeonMap dungeonMap) {
        return new IdAllocation(dungeonMap);
    }

    DungeonRoomTopologyClusterWork newClusterWork(ClusterRoomIds ids, long mapId, Set<DungeonCell> cells) {
        return new DungeonRoomTopologyClusterWork(
                newCluster(ids.clusterId(), mapId, cells),
                List.of(newRoom(ids.roomId(), mapId, ids.clusterId(), cells, null)),
                cellsByLevel(cells));
    }

    DungeonMap rebuilt(DungeonMap dungeonMap, List<DungeonRoomTopologyClusterWork> workClusters) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : workClusters.stream()
                .sorted(Comparator.comparingLong(clusterWork -> clusterWork.cluster().clusterId()))
                .toList()) {
            if (work.allCells().isEmpty()) {
                continue;
            }
            List<DungeonRoom> rebuiltRooms = roomsFor(work);
            if (rebuiltRooms.isEmpty()) {
                continue;
            }
            clusters.add(clusterFor(work));
            rooms.addAll(rebuiltRooms);
        }
        SpatialTopology nextTopology = dungeonMap.topology().withRoomClusters(clusters);
        return new DungeonMap(
                dungeonMap.metadata(),
                nextTopology,
                dungeonMap.spaces(),
                new RoomCatalog(rooms),
                dungeonMap.connections(),
                dungeonMap.features(),
                dungeonMap.revision() + 1L);
    }

    DungeonMap rebuiltPreservingRooms(DungeonMap dungeonMap, List<DungeonRoomTopologyClusterWork> workClusters) {
        List<DungeonRoomCluster> clusters = new ArrayList<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (DungeonRoomTopologyClusterWork work : workClusters.stream()
                .sorted(Comparator.comparingLong(clusterWork -> clusterWork.cluster().clusterId()))
                .toList()) {
            if (work.allCells().isEmpty() || work.rooms().isEmpty()) {
                continue;
            }
            clusters.add(work.cluster());
            rooms.addAll(work.rooms());
        }
        SpatialTopology nextTopology = dungeonMap.topology().withRoomClusters(clusters);
        return new DungeonMap(
                dungeonMap.metadata(),
                nextTopology,
                dungeonMap.spaces(),
                new RoomCatalog(rooms),
                dungeonMap.connections(),
                dungeonMap.features(),
                dungeonMap.revision() + 1L);
    }

    DungeonRoomCluster clusterWithBoundaries(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                work.cluster().relativeVerticesByLevel(),
                boundariesByLevel);
    }

    DungeonRoomCluster clusterForStretch(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work),
                boundariesByLevel);
    }

    List<DungeonRoom> roomsForBoundaryEdit(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            IdAllocation ids
    ) {
        List<RoomComponent> components = roomComponents(work, boundariesByLevel);
        Set<Long> usedRoomIds = new LinkedHashSet<>();
        List<DungeonRoom> rooms = new ArrayList<>();
        for (RoomComponent component : components) {
            DungeonRoom template = templateForComponent(work.rooms(), component, usedRoomIds);
            long roomId = template == null ? ids.reserveRoomId() : template.roomId();
            usedRoomIds.add(roomId);
            rooms.add(new DungeonRoom(
                    roomId,
                    work.cluster().mapId(),
                    work.cluster().clusterId(),
                    template == null ? "Raum " + roomId : template.name(),
                    Map.of(component.level(), component.anchor()),
                    template == null ? DungeonRoomNarration.empty() : template.narration()));
        }
        return List.copyOf(rooms);
    }

    Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap(DungeonRoomCluster cluster) {
        Map<DungeonBoundaryKey, DungeonClusterBoundary> result = new LinkedHashMap<>();
        for (List<DungeonClusterBoundary> boundaries : cluster.boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                result.put(DungeonBoundaryKey.from(boundary.absoluteEdge(cluster.center())), boundary);
            }
        }
        return result;
    }

    Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel(Iterable<DungeonClusterBoundary> boundaries) {
        Map<Integer, List<DungeonClusterBoundary>> grouped = new LinkedHashMap<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            grouped.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary);
        }
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), entry.getValue().stream()
                    .sorted(Comparator
                            .comparingInt((DungeonClusterBoundary boundary) -> boundary.relativeCell().r())
                            .thenComparingInt(boundary -> boundary.relativeCell().q())
                            .thenComparing(DungeonClusterBoundary::direction))
                    .toList());
        }
        return Map.copyOf(result);
    }

    Map<Integer, List<DungeonCell>> cellsByLevel(Iterable<DungeonCell> cells) {
        Map<Integer, List<DungeonCell>> grouped = new LinkedHashMap<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            grouped.computeIfAbsent(cell.level(), ignored -> new ArrayList<>()).add(cell);
        }
        Map<Integer, List<DungeonCell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), DungeonRoomCellProjector.sortedCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    boolean intersects(List<DungeonCell> left, Set<DungeonCell> right) {
        for (DungeonCell cell : left == null ? List.<DungeonCell>of() : left) {
            if (right.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    Map<Integer, List<DungeonClusterBoundary>> filterBoundaries(
            Iterable<DungeonClusterBoundary> boundaries,
            Map<Integer, List<DungeonCell>> cellsByLevel,
            DungeonCell center
    ) {
        List<DungeonClusterBoundary> filtered = new ArrayList<>();
        for (DungeonClusterBoundary boundary : boundaries == null ? List.<DungeonClusterBoundary>of() : boundaries) {
            Set<DungeonCell> cells = new LinkedHashSet<>(cellsByLevel.getOrDefault(boundary.level(), List.of()));
            int insideCount = touch(boundary.absoluteEdge(center), cells).insideCells().size();
            if (insideCount >= 1
                    && (boundary.kind() == DungeonClusterBoundaryKind.DOOR || insideCount == 2)) {
                filtered.add(boundary);
            }
        }
        return boundariesByLevel(filtered);
    }

    @Nullable DungeonClusterBoundary boundaryForEdge(
            Set<DungeonCell> clusterCells,
            DungeonCell center,
            long clusterId,
            DungeonEdge edge,
            DungeonClusterBoundaryKind kind,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        List<DungeonCell> touchingCells = DungeonRoomCellProjector.sortedCells(edge.touchingCells());
        if (touchingCells.size() != 2 || touchingCells.getFirst().level() != touchingCells.get(1).level()) {
            return null;
        }
        List<DungeonCell> insideCells = touchingCells.stream()
                .filter(clusterCells::contains)
                .toList();
        if (insideCells.isEmpty()
                || (kind != DungeonClusterBoundaryKind.DOOR && insideCells.size() != 2)
                || (kind == DungeonClusterBoundaryKind.DOOR && insideCells.size() > 2)) {
            return null;
        }
        DungeonCell baseCell = insideCells.getFirst();
        DungeonEdgeDirection direction = directionFrom(baseCell, edge);
        if (direction == null) {
            return null;
        }
        return new DungeonClusterBoundary(
                clusterId,
                baseCell.level(),
                new DungeonCell(baseCell.q() - center.q(), baseCell.r() - center.r(), baseCell.level()),
                direction,
                kind,
                topologyRef == null ? DungeonTopologyRef.empty() : topologyRef);
    }

    boolean touchesCorridorBinding(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level,
            Set<DungeonBoundaryKey> keys
    ) {
        if (keys == null || keys.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = corridorBindingKeys(dungeonMap, clusterCenter, clusterId, level);
        return keys.stream().anyMatch(bindingKeys::contains);
    }

    boolean touchesCorridorBinding(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level,
            List<DungeonEdge> path
    ) {
        if (path == null || path.isEmpty()) {
            return false;
        }
        Set<DungeonBoundaryKey> bindingKeys = corridorBindingKeys(dungeonMap, clusterCenter, clusterId, level);
        return path.stream()
                .map(DungeonBoundaryKey::from)
                .anyMatch(bindingKeys::contains);
    }

    private List<RoomComponent> roomComponents(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        List<RoomComponent> result = new ArrayList<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : work.cellsByLevel().entrySet()) {
            int level = entry.getKey();
            List<DungeonClusterBoundary> barriers = boundariesByLevel.getOrDefault(level, List.of());
            for (Set<DungeonCell> component : connectedComponents(entry.getValue(), barriers, work.cluster().center())) {
                List<DungeonCell> cells = DungeonRoomCellProjector.sortedCells(component);
                if (!cells.isEmpty()) {
                    result.add(new RoomComponent(level, cells));
                }
            }
        }
        return result.stream()
                .sorted(Comparator
                        .comparingInt(RoomComponent::level)
                        .thenComparingInt(component -> component.anchor().r())
                        .thenComparingInt(component -> component.anchor().q()))
                .toList();
    }

    private List<Set<DungeonCell>> connectedComponents(
            List<DungeonCell> cells,
            List<DungeonClusterBoundary> barriers,
            DungeonCell center
    ) {
        Set<DungeonCell> remaining = new LinkedHashSet<>(cells == null ? List.<DungeonCell>of() : cells);
        List<Set<DungeonCell>> components = new ArrayList<>();
        while (!remaining.isEmpty()) {
            DungeonCell start = remaining.iterator().next();
            Set<DungeonCell> component = new LinkedHashSet<>();
            Set<DungeonCell> frontier = new LinkedHashSet<>(remaining);
            java.util.ArrayDeque<DungeonCell> queue = new java.util.ArrayDeque<>();
            queue.add(start);
            frontier.remove(start);
            remaining.remove(start);
            while (!queue.isEmpty()) {
                DungeonCell current = queue.removeFirst();
                component.add(current);
                for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
                    DungeonCell neighbor = direction.neighborOf(current);
                    if (!frontier.contains(neighbor) || isBlocked(barriers, center, current, neighbor)) {
                        continue;
                    }
                    frontier.remove(neighbor);
                    remaining.remove(neighbor);
                    queue.addLast(neighbor);
                }
            }
            components.add(Set.copyOf(component));
        }
        return List.copyOf(components);
    }

    private boolean isBlocked(
            List<DungeonClusterBoundary> barriers,
            DungeonCell center,
            DungeonCell current,
            DungeonCell neighbor
    ) {
        DungeonEdge movementEdge = edgeBetweenAdjacentCells(current, neighbor);
        if (movementEdge == null) {
            return false;
        }
        DungeonBoundaryKey movement = DungeonBoundaryKey.from(movementEdge);
        for (DungeonClusterBoundary barrier : barriers == null ? List.<DungeonClusterBoundary>of() : barriers) {
            if (DungeonBoundaryKey.from(barrier.absoluteEdge(center)).equals(movement)) {
                return true;
            }
        }
        return false;
    }

    private @Nullable DungeonEdge edgeBetweenAdjacentCells(DungeonCell current, DungeonCell neighbor) {
        if (current == null || neighbor == null || current.level() != neighbor.level()) {
            return null;
        }
        int deltaQ = neighbor.q() - current.q();
        int deltaR = neighbor.r() - current.r();
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return DungeonEdge.sideOf(current, direction);
            }
        }
        return null;
    }

    private @Nullable DungeonRoom templateForComponent(
            List<DungeonRoom> rooms,
            RoomComponent component,
            Set<Long> usedRoomIds
    ) {
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            DungeonCell anchor = room.floorAnchors().get(component.level());
            if (anchor != null && component.cells().contains(anchor) && !usedRoomIds.contains(room.roomId())) {
                return room;
            }
        }
        return null;
    }

    private DungeonRoomCluster clusterFor(DungeonRoomTopologyClusterWork work) {
        return new DungeonRoomCluster(
                work.cluster().clusterId(),
                work.cluster().mapId(),
                work.cluster().center(),
                verticesByLevel(work),
                preservedBoundaries(work.cluster(), work.cellsByLevel()));
    }

    private List<DungeonRoom> roomsFor(DungeonRoomTopologyClusterWork work) {
        DungeonRoom template = work.rooms().isEmpty() ? null : work.rooms().getFirst();
        DungeonCell anchor = DungeonRoomCellProjector.sortedCells(work.allCells()).stream().findFirst().orElse(null);
        if (anchor == null) {
            return List.of();
        }
        long roomId = template == null ? nextRoomId(work.cluster(), work.rooms()) : template.roomId();
        return List.of(new DungeonRoom(
                roomId,
                work.cluster().mapId(),
                work.cluster().clusterId(),
                template == null ? "Raum " + roomId : template.name(),
                anchorsByLevel(work.cellsByLevel()),
                template == null ? DungeonRoomNarration.empty() : template.narration()));
    }

    private Map<Integer, DungeonCell> anchorsByLevel(Map<Integer, List<DungeonCell>> cellsByLevel) {
        Map<Integer, DungeonCell> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : cellsByLevel.entrySet()) {
            if (!entry.getValue().isEmpty()) {
                result.put(entry.getKey(), DungeonRoomCellProjector.sortedCells(entry.getValue()).getFirst());
            }
        }
        return Map.copyOf(result);
    }

    private Map<Integer, List<DungeonClusterBoundary>> preservedBoundaries(
            DungeonRoomCluster cluster,
            Map<Integer, List<DungeonCell>> cellsByLevel
    ) {
        Map<Integer, List<DungeonClusterBoundary>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonClusterBoundary>> entry : cluster.boundariesByLevel().entrySet()) {
            Set<DungeonCell> cells = new LinkedHashSet<>(cellsByLevel.getOrDefault(entry.getKey(), List.of()));
            List<DungeonClusterBoundary> preserved = entry.getValue().stream()
                    .filter(boundary -> cells.contains(boundary.absoluteCell(cluster.center())))
                    .toList();
            if (!preserved.isEmpty()) {
                result.put(entry.getKey(), preserved);
            }
        }
        return Map.copyOf(result);
    }

    private DungeonRoomCluster newCluster(long clusterId, long mapId, Set<DungeonCell> cells) {
        DungeonCell center = DungeonRoomCellProjector.sortedCells(cells).getFirst();
        return new DungeonRoomCluster(clusterId, mapId, center, Map.of(), Map.of());
    }

    private DungeonRoom newRoom(
            long roomId,
            long mapId,
            long clusterId,
            Set<DungeonCell> cells,
            @Nullable DungeonRoom template
    ) {
        return new DungeonRoom(
                roomId,
                mapId,
                clusterId,
                template == null ? "Raum " + roomId : template.name(),
                anchorsByLevel(cellsByLevel(cells)),
                template == null ? DungeonRoomNarration.empty() : template.narration());
    }

    private long nextRoomId(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        return rooms.stream()
                .mapToLong(DungeonRoom::roomId)
                .min()
                .orElse(Math.max(1L, cluster.clusterId()));
    }

    private Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
        }
        return Map.copyOf(result);
    }

    private Map<Integer, List<DungeonCell>> verticesByLevel(DungeonRoomTopologyClusterWork work) {
        Map<Integer, List<DungeonCell>> verticesByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : work.cellsByLevel().entrySet()) {
            if (!entry.getValue().isEmpty()) {
                verticesByLevel.put(
                        entry.getKey(),
                        CELL_PROJECTOR.relativeCellLoops(work.cluster().center(), entry.getValue()));
            }
        }
        return Map.copyOf(verticesByLevel);
    }

    private BoundaryTouch touch(DungeonEdge edge, Set<DungeonCell> clusterCells) {
        List<DungeonCell> insideCells = edge.touchingCells().stream()
                .filter(clusterCells::contains)
                .toList();
        return new BoundaryTouch(insideCells);
    }

    private Set<DungeonBoundaryKey> corridorBindingKeys(
            DungeonMap dungeonMap,
            DungeonCell clusterCenter,
            long clusterId,
            int level
    ) {
        Set<DungeonBoundaryKey> result = new LinkedHashSet<>();
        if (dungeonMap == null || clusterCenter == null || clusterId <= 0L) {
            return result;
        }
        for (DungeonCorridor corridor : dungeonMap.connections().corridors()) {
            for (DungeonCorridorDoorBinding binding : corridor.bindings().doorBindings()) {
                if (binding.clusterId() != clusterId || binding.relativeCell().level() != level) {
                    continue;
                }
                result.add(DungeonBoundaryKey.from(absoluteDoorEdge(binding, clusterCenter)));
            }
        }
        return Set.copyOf(result);
    }

    private DungeonEdge absoluteDoorEdge(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        return DungeonEdge.sideOf(absoluteRoomCell(binding, clusterCenter), binding.direction());
    }

    private DungeonCell absoluteRoomCell(DungeonCorridorDoorBinding binding, DungeonCell clusterCenter) {
        DungeonCell relativeCell = binding.relativeCell();
        return new DungeonCell(
                clusterCenter.q() + relativeCell.q(),
                clusterCenter.r() + relativeCell.r(),
                relativeCell.level());
    }

    private @Nullable DungeonEdgeDirection directionFrom(DungeonCell cell, DungeonEdge edge) {
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (DungeonBoundaryKey.from(DungeonEdge.sideOf(cell, direction)).equals(key)) {
                return direction;
            }
        }
        return null;
    }

    record ClusterRoomIds(long clusterId, long roomId) {
    }

    static final class IdAllocation {

        private long nextClusterId;
        private long nextRoomId;

        IdAllocation(DungeonMap dungeonMap) {
            this.nextClusterId = dungeonMap.topology().roomClusters().stream()
                    .mapToLong(DungeonRoomCluster::clusterId)
                    .max()
                    .orElse(0L) + 1L;
            this.nextRoomId = dungeonMap.rooms().rooms().stream()
                    .mapToLong(DungeonRoom::roomId)
                    .max()
                    .orElse(0L) + 1L;
        }

        ClusterRoomIds reserveClusterAndRoom() {
            return new ClusterRoomIds(nextClusterId++, nextRoomId++);
        }

        long reserveRoomId() {
            return nextRoomId++;
        }
    }

    private record RoomComponent(
            int level,
            List<DungeonCell> cells
    ) {
        private RoomComponent {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        DungeonCell anchor() {
            return cells.isEmpty() ? new DungeonCell(0, 0, level) : cells.getFirst();
        }
    }

    private record BoundaryTouch(List<DungeonCell> insideCells) {
        private BoundaryTouch {
            insideCells = insideCells == null ? List.of() : List.copyOf(insideCells);
        }
    }
}
