package src.domain.dungeon.map.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonBoundaryKey;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonRoomTopologyClusterWork;

final class DungeonRoomBoundaryPartitionService {

    List<DungeonRoom> roomsForBoundaryEdit(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            DungeonRoomClusterWorkService.IdAllocation ids
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
            Deque<DungeonCell> queue = new java.util.ArrayDeque<>();
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

    private record RoomComponent(
            int level,
            List<DungeonCell> cells
    ) {
        private RoomComponent {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }

        private DungeonCell anchor() {
            return cells.isEmpty() ? new DungeonCell(0, 0, level) : cells.getFirst();
        }
    }
}
