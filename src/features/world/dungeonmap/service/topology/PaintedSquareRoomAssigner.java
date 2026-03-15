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
        List<DungeonSquarePaint> filledEdits = TopologyPaintSupport.filledEdits(intent.squareEdits());
        if (filledEdits.isEmpty() || workspace.currentSquares().isEmpty()) {
            return intent;
        }

        List<Long> overlappedRoomIds = TopologyPaintSupport.overlappedOwnerIds(
                filledEdits,
                key -> {
                    DungeonSquare previousSquare = workspace.previousSquaresByCoord().get(key);
                    return previousSquare == null ? null : previousSquare.roomId();
                });
        SquarePaintOutcome outcome = TopologyPaintSupport.classifySquarePaintOutcome(overlappedRoomIds);

        long targetRoomId;
        if (outcome == SquarePaintOutcome.NEW_ROOM) {
            targetRoomId = createDefaultRoom(conn, mapId, nextDefaultRoomNumber(workspace.rooms()), null, null);
        } else {
            Long conceptLevelId = TopologyConceptLevelSupport.requireConsistentConceptLevel(
                    overlappedRoomIds,
                    workspace.roomsById(),
                    "Malen");
            TopologyIntent priorityIntent = intent.withPrimaryRoomPriority(overlappedRoomIds);
            Long selectedRoomId = TopologyEntitySelectionSupport.selectPreferredEntityId(
                    overlappedRoomIds,
                    workspace.currentRoomSquareCounts(),
                    priorityIntent);
            targetRoomId = selectedRoomId == null ? overlappedRoomIds.get(0) : selectedRoomId;
            List<Long> targetFirstRoomIds = TopologyPaintSupport.prioritizeTargetEntity(targetRoomId, overlappedRoomIds);
            RoomMetadataMerger.updateMergedRoomMetadata(
                    conn,
                    targetRoomId,
                    overlappedRoomIds,
                    workspace.roomsById(),
                    workspace.currentRoomSquareCounts(),
                    intent.withPrimaryRoomPriority(targetFirstRoomIds));
            reassignMergedRooms(conn, targetRoomId, overlappedRoomIds, workspace.currentSquares());
            DungeonRoom targetRoom = workspace.roomsById().get(targetRoomId);
            if (conceptLevelId != null && targetRoom != null && !conceptLevelId.equals(targetRoom.conceptLevelId())) {
                throw new IllegalStateException("Malen darf keine Raeume in eine andere Graph-Ebene verschieben.");
            }
            return assignFilledSquares(conn, workspace, filledEdits, targetRoomId, intent.withPrimaryRoomPriority(targetFirstRoomIds));
        }

        return assignFilledSquares(
                conn,
                workspace,
                filledEdits,
                targetRoomId,
                intent.withPrimaryRoomPriority(TopologyPaintSupport.prioritizeTargetEntity(targetRoomId, overlappedRoomIds)));
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

    private static long createDefaultRoom(
            Connection conn,
            long mapId,
            int roomNumber,
            DungeonRoom templateRoom,
            Long conceptLevelId
    ) throws SQLException {
        String templateLightLevel = templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.lightLevel());
        String templateVisual = templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.visualDescription());
        String templateSounds = templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.soundsDescription());
        String templateSmells = templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.smellsDescription());
        String templateOther = templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.otherDescription());
        String templateGlance = templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.glanceDescription());
        String templateDetail = templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.detailDescription());
        DungeonRoom newRoom = new DungeonRoom(
                null,
                mapId,
                "Raum #" + roomNumber,
                templateLightLevel,
                templateVisual,
                templateSounds,
                templateSmells,
                templateOther,
                templateGlance,
                templateDetail,
                templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.reactiveChecks()),
                templateRoom == null ? "" : RoomMetadataMerger.coalesceText(templateRoom.gmBackground()),
                templateRoom == null ? null : templateRoom.areaId(),
                conceptLevelId);
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

    private static boolean targetRoomIdEquals(Long currentRoomId, long targetRoomId) {
        return currentRoomId != null && currentRoomId == targetRoomId;
    }
}
