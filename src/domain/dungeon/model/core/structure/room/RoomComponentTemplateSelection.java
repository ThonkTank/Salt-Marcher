package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;

final class RoomComponentTemplateSelection {

    private RoomComponentTemplateSelection() {
    }

    static Optional<Room> templateFor(
            List<Room> rooms,
            Map<Long, Set<Cell>> previousCellSetsByRoom,
            RoomClusterRoomComponents.RoomComponent component,
            Set<Long> usedRoomIds
    ) {
        List<Candidate> candidates = new ArrayList<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null && !usedRoomIds.contains(room.roomId())) {
                Candidate candidate = candidate(room, previousCellSetsByRoom, component);
                if (candidate.represented()) {
                    candidates.add(candidate);
                }
            }
        }
        candidates.sort(RoomComponentTemplateSelection::compareCandidates);
        return candidates.isEmpty()
                ? Optional.empty()
                : Optional.of(candidates.getFirst().room());
    }

    private static Candidate candidate(
            Room room,
            Map<Long, Set<Cell>> previousCellSetsByRoom,
            RoomClusterRoomComponents.RoomComponent component
    ) {
        Cell anchor = room.floorAnchors().get(component.level());
        boolean anchorMatch = anchor != null && component.cells().contains(anchor);
        int overlap = overlapCount(component.cells(), previousCellSetsByRoom.get(room.roomId()));
        return new Candidate(room, anchorMatch, overlap);
    }

    private static int overlapCount(List<Cell> componentCells, Set<Cell> previousCells) {
        if (componentCells.isEmpty() || previousCells == null || previousCells.isEmpty()) {
            return 0;
        }
        int overlap = 0;
        for (Cell cell : componentCells) {
            if (previousCells.contains(cell)) {
                overlap += 1;
            }
        }
        return overlap;
    }

    private static int compareCandidates(Candidate left, Candidate right) {
        if (left.anchorMatch != right.anchorMatch) {
            return left.anchorMatch ? -1 : 1;
        }
        int overlap = Integer.compare(right.overlap, left.overlap);
        return overlap != 0 ? overlap : Long.compare(left.room().roomId(), right.room().roomId());
    }

    private record Candidate(
            Room room,
            boolean anchorMatch,
            int overlap
    ) {
        boolean represented() {
            return anchorMatch || overlap > 0;
        }
    }
}
