package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonRoom;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundary;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonRoomTopologyClusterWork;

final class DungeonRoomBoundaryPartitionLogic {

    private static final DungeonCellTraversalSupport TRAVERSAL_SUPPORT = new DungeonCellTraversalSupport();

    List<DungeonRoom> roomsForBoundaryEdit(
            DungeonRoomTopologyClusterWork work,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel,
            DungeonRoomClusterWorkLogic.IdAllocation ids
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
                List<DungeonCell> cells = DungeonRoomCellProjection.sortedCells(component);
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
        return TRAVERSAL_SUPPORT.connectedComponents(cells, barriers, center);
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
