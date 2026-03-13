package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class PaintedSquareRoomAssigner {

    private static final Pattern DEFAULT_ROOM_NAME = Pattern.compile("^Raum #(\\d+)$");

    private PaintedSquareRoomAssigner() {
    }

    static TopologyIntent assignPaintedSquaresToRooms(
            Connection conn,
            long mapId,
            TopologyIntent intent,
            TopologyWorkspace workspace
    ) throws SQLException {
        /*
         * Room ownership is determined only by direct overlap with pre-existing room squares:
         * - no overlap => create a new room, even when the paint is merely adjacent to rooms
         * - overlap one room => extend that room across the painted empty cells
         * - overlap multiple rooms => merge all overlapped rooms into one room
         */
        List<DungeonSquarePaint> filledEdits = filledEdits(intent.squareEdits());
        if (filledEdits.isEmpty() || workspace.currentSquares().isEmpty()) {
            return intent;
        }

        List<Long> overlappedRoomIds = overlappedRoomIds(filledEdits, workspace.previousSquaresByCoord());
        SquarePaintOutcome outcome = classifySquarePaintOutcome(overlappedRoomIds);

        long targetRoomId;
        if (outcome == SquarePaintOutcome.NEW_ROOM) {
            targetRoomId = createDefaultRoom(conn, mapId, nextDefaultRoomNumber(workspace.rooms()), null);
        } else {
            TopologyIntent priorityIntent = intent.withPrimaryRoomPriority(overlappedRoomIds);
            Long selectedRoomId = PreferredRoomSelector.selectPreferredRoomId(
                    overlappedRoomIds,
                    workspace.currentRoomSquareCounts(),
                    priorityIntent);
            targetRoomId = selectedRoomId == null ? overlappedRoomIds.get(0) : selectedRoomId;
            List<Long> targetFirstRoomIds = prioritizeTargetRoom(targetRoomId, overlappedRoomIds);
            RoomMetadataMerger.updateMergedRoomMetadata(
                    conn,
                    targetRoomId,
                    overlappedRoomIds,
                    workspace.roomsById(),
                    workspace.currentRoomSquareCounts(),
                    intent.withPrimaryRoomPriority(targetFirstRoomIds));
            reassignMergedRooms(conn, targetRoomId, overlappedRoomIds, workspace.currentSquares());
            return assignFilledSquares(conn, workspace, filledEdits, targetRoomId, intent.withPrimaryRoomPriority(targetFirstRoomIds));
        }

        return assignFilledSquares(
                conn,
                workspace,
                filledEdits,
                targetRoomId,
                intent.withPrimaryRoomPriority(prioritizeTargetRoom(targetRoomId, overlappedRoomIds)));
    }

    private static TopologyIntent assignFilledSquares(
            Connection conn,
            TopologyWorkspace workspace,
            List<DungeonSquarePaint> filledEdits,
            long targetRoomId,
            TopologyIntent updatedIntent
    ) throws SQLException {
        for (DungeonSquarePaint edit : filledEdits) {
            DungeonSquare square = workspace.currentSquaresByCoord().get(TopologyWorkspace.coordKey(edit.x(), edit.y()));
            if (square != null && !targetRoomIdEquals(square.roomId(), targetRoomId)) {
                DungeonSquareRepository.assignSquareRoom(conn, square.squareId(), targetRoomId);
            }
        }
        return updatedIntent;
    }

    private static void reassignMergedRooms(
            Connection conn,
            long targetRoomId,
            List<Long> mergedRoomIds,
            List<DungeonSquare> currentSquares
    ) throws SQLException {
        if (mergedRoomIds.size() <= 1) {
            return;
        }
        Set<Long> roomIdsToMerge = new HashSet<>(mergedRoomIds);
        roomIdsToMerge.remove(targetRoomId);
        if (roomIdsToMerge.isEmpty()) {
            return;
        }
        for (DungeonSquare square : currentSquares) {
            if (square.roomId() != null && roomIdsToMerge.contains(square.roomId())) {
                DungeonSquareRepository.assignSquareRoom(conn, square.squareId(), targetRoomId);
            }
        }
    }

    private static List<DungeonSquarePaint> filledEdits(List<DungeonSquarePaint> edits) {
        List<DungeonSquarePaint> result = new ArrayList<>();
        for (DungeonSquarePaint edit : edits) {
            if (edit.filled()) {
                result.add(edit);
            }
        }
        return result;
    }

    private static List<Long> overlappedRoomIds(
            List<DungeonSquarePaint> filledEdits,
            java.util.Map<String, DungeonSquare> previousSquaresByCoord
    ) {
        List<Long> result = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();
        for (DungeonSquarePaint edit : filledEdits) {
            DungeonSquare previousSquare = previousSquaresByCoord.get(TopologyWorkspace.coordKey(edit.x(), edit.y()));
            if (previousSquare != null && previousSquare.roomId() != null && seen.add(previousSquare.roomId())) {
                result.add(previousSquare.roomId());
            }
        }
        return result;
    }

    private static List<Long> prioritizeTargetRoom(long targetRoomId, List<Long> relatedRoomIds) {
        LinkedHashSet<Long> ordered = new LinkedHashSet<>();
        ordered.add(targetRoomId);
        if (relatedRoomIds != null) {
            ordered.addAll(relatedRoomIds);
        }
        return List.copyOf(ordered);
    }

    private static long createDefaultRoom(Connection conn, long mapId, int roomNumber, DungeonRoom templateRoom) throws SQLException {
        DungeonRoom newRoom = new DungeonRoom(
                null,
                mapId,
                "Raum #" + roomNumber,
                templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.description()),
                templateRoom == null ? null : templateRoom.areaId());
        return DungeonRoomRepository.upsertRoom(conn, newRoom);
    }

    static int nextDefaultRoomNumber(List<DungeonRoom> rooms) {
        int next = 1;
        for (DungeonRoom room : rooms) {
            if (room == null || room.name() == null) {
                continue;
            }
            Matcher matcher = DEFAULT_ROOM_NAME.matcher(room.name().trim());
            if (matcher.matches()) {
                next = Math.max(next, Integer.parseInt(matcher.group(1)) + 1);
            }
        }
        return next;
    }

    private static SquarePaintOutcome classifySquarePaintOutcome(List<Long> overlappedRoomIds) {
        if (overlappedRoomIds.isEmpty()) {
            return SquarePaintOutcome.NEW_ROOM;
        }
        if (overlappedRoomIds.size() == 1) {
            return SquarePaintOutcome.EXTEND_EXISTING_ROOM;
        }
        return SquarePaintOutcome.MERGE_EXISTING_ROOMS;
    }

    private static boolean targetRoomIdEquals(Long currentRoomId, long targetRoomId) {
        return currentRoomId != null && currentRoomId == targetRoomId;
    }
}
