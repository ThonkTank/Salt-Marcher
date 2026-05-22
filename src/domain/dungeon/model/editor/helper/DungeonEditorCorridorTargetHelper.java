package src.domain.dungeon.model.editor.helper;

import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorBoundaryTouchGeometry;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.CellKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.TravelHeading;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HandleTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class DungeonEditorCorridorTargetHelper {
    public @Nullable PendingCorridorTarget resolveCreateTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        PendingCorridorTarget fixedDoorHandleTarget = fixedDoorHandleTarget(input.hitTarget());
        if (fixedDoorHandleTarget != null) {
            return fixedDoorHandleTarget;
        }
        PendingCorridorTarget fixedDoorTarget = fixedDoorBoundaryTarget(input, snapshot);
        if (fixedDoorTarget != null) {
            return fixedDoorTarget;
        }
        PendingCorridorTarget perimeterWallTarget = perimeterWallTarget(input, snapshot);
        if (perimeterWallTarget != null) {
            return perimeterWallTarget;
        }
        PendingCorridorTarget explicitAnchorTarget = explicitAnchorTarget(input.hitTarget());
        if (explicitAnchorTarget != null) {
            return explicitAnchorTarget;
        }
        PendingCorridorTarget roomTarget = roomTarget(input, snapshot, input.hitTarget());
        if (roomTarget != null) {
            return roomTarget;
        }
        return corridorTarget(input);
    }

    public @Nullable PendingCorridorTarget resolveDeleteTarget(PointerState input) {
        PendingCorridorTarget explicitAnchorTarget = explicitAnchorTarget(input.hitTarget());
        return explicitAnchorTarget != null ? explicitAnchorTarget : corridorTarget(input);
    }

    private @Nullable PendingCorridorTarget fixedDoorHandleTarget(@Nullable HitTarget hit) {
        if (hit == null
                || hit.handleRef() == null
                || !hit.handleRef().doorHandle()
                || !DungeonEditorWorkspaceValues.hasId(hit.handleRef().roomId())
                || !DungeonEditorWorkspaceValues.hasId(hit.handleRef().clusterId())
                || hit.handleRef().direction().isBlank()
                || !DungeonEditorWorkspaceValues.hasId(hit.topologyRefId())) {
            return null;
        }
        HandleTarget handleRef = hit.handleRef();
        return new PendingCorridorTarget.EndpointTarget(
                DungeonEditorMainViewInteractionValues.ROOM_PREFIX + handleRef.roomId() + ":door:" + hit.topologyRefId(),
                "Tür " + hit.topologyRefId(),
                new DungeonEditorSessionValues.Selection(
                        new DungeonTopologyRef(
                                DungeonTopologyElementKind.DOOR,
                                hit.topologyRefId()),
                        handleRef.clusterId(),
                        false,
                        handleRef.toWorkspaceHandleRef()),
                0L,
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        handleRef.roomId(),
                        handleRef.clusterId(),
                        handleRef.anchor().toWorkspaceCell(),
                        handleRef.direction(),
                        new DungeonTopologyRef(
                                DungeonTopologyElementKind.DOOR,
                                hit.topologyRefId())));
    }

    private @Nullable PendingCorridorTarget fixedDoorBoundaryTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
        BoundaryRoomTouch roomTouch = boundaryRoomTouch(snapshot, boundary, true);
        if (roomTouch == null || boundary == null) {
            return null;
        }
        String direction = DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef())
                .directionForCell(roomTouch.roomCell());
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                DungeonEditorMainViewInteractionValues.ROOM_PREFIX + roomTouch.room().id() + ":door:" + boundary.topologyRefId(),
                "Tür " + boundary.topologyRefId(),
                selectionForBoundary(boundary, roomTouch.room().clusterId()),
                0L,
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        roomTouch.room().id(),
                        roomTouch.room().clusterId(),
                        roomTouch.roomCell(),
                        direction,
                        new DungeonTopologyRef(
                                DungeonEditorMainViewInteractionValues.toTopologyKind(boundary.topologyRefKind()),
                                boundary.topologyRefId())));
    }

    private @Nullable PendingCorridorTarget perimeterWallTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
        BoundaryRoomTouch roomTouch = boundaryRoomTouch(snapshot, boundary, false);
        if (roomTouch == null || boundary == null) {
            return null;
        }
        String direction = DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef())
                .directionForCell(roomTouch.roomCell());
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                DungeonEditorMainViewInteractionValues.ROOM_PREFIX
                        + roomTouch.room().id()
                        + ":wall:"
                        + boundary.start().q()
                        + ":"
                        + boundary.start().r()
                        + ":"
                        + boundary.end().q()
                        + ":"
                        + boundary.end().r()
                        + ":"
                        + boundary.start().level(),
                roomTouch.room().label().isBlank() ? "Raum " + roomTouch.room().id() : roomTouch.room().label(),
                selectionForBoundary(boundary, roomTouch.room().clusterId()),
                0L,
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        roomTouch.room().id(),
                        roomTouch.room().clusterId(),
                        roomTouch.roomCell(),
                        direction,
                        src.domain.dungeon.model.map.model.DungeonTopologyRef.empty()));
    }

    private static @Nullable PendingCorridorTarget explicitAnchorTarget(@Nullable HitTarget hit) {
        if (hit == null || hit.handleRef() == null || !hit.handleRef().corridorAnchor()) {
            return null;
        }
        long hostCorridorId = hit.handleRef().corridorId();
        if (!DungeonEditorWorkspaceValues.hasId(hostCorridorId)) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "anchor:" + hit.topologyRefId(),
                "Anker " + hit.topologyRefId(),
                new DungeonEditorSessionValues.Selection(
                        new DungeonTopologyRef(
                                DungeonTopologyElementKind.CORRIDOR,
                                hostCorridorId),
                        0L,
                        false,
                        DungeonEditorSessionValues.emptyHandleRef()),
                hostCorridorId,
                new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                        hostCorridorId,
                        hit.handleRef().anchor().toWorkspaceCell(),
                        new DungeonTopologyRef(
                                DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                hit.topologyRefId())));
    }

    private static @Nullable PendingCorridorTarget corridorTarget(@Nullable PointerState input) {
        if (input == null) {
            return null;
        }
        HitTarget hit = input.hitTarget();
        if (hit == null) {
            return null;
        }
        long corridorId = DungeonEditorWorkspaceValues.hasId(hit.topologyRefId())
                && DungeonTopologyElementKind.valueOf(hit.topologyRefKind()).isCorridor()
                ? hit.topologyRefId()
                : hit.kind() == HitKind.CORRIDOR ? hit.ownerId() : 0L;
        if (!DungeonEditorWorkspaceValues.hasId(corridorId)) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "corridor:" + corridorId + ":" + input.q() + ":" + input.r() + ":" + input.level(),
                "Korridor " + corridorId,
                new DungeonEditorSessionValues.Selection(
                        new DungeonTopologyRef(
                                DungeonTopologyElementKind.CORRIDOR,
                                corridorId),
                        0L,
                        false,
                        DungeonEditorSessionValues.emptyHandleRef()),
                corridorId,
                new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                        corridorId,
                        new DungeonEditorWorkspaceValues.Cell(input.q(), input.r(), input.level()),
                        src.domain.dungeon.model.map.model.DungeonTopologyRef.empty()));
    }

    private @Nullable PendingCorridorTarget roomTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            HitTarget hit
    ) {
        var room = roomArea(snapshot, hit);
        if (room == null) {
            return null;
        }
        var roomCell = corridorRoomCell(room, input.q(), input.r());
        String direction = corridorDirection(room, roomCell);
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                DungeonEditorMainViewInteractionValues.ROOM_PREFIX + room.id(),
                room.label().isBlank() ? "Raum " + room.id() : room.label(),
                new DungeonEditorSessionValues.Selection(
                        room.topologyRef(),
                        room.clusterId(),
                        false,
                        DungeonEditorSessionValues.emptyHandleRef()),
                room.clusterId(),
                new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                        room.id(),
                        room.clusterId(),
                        roomCell,
                        direction,
                        src.domain.dungeon.model.map.model.DungeonTopologyRef.empty()));
    }

    private static @Nullable BoundaryRoomTouch boundaryRoomTouch(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable BoundaryTarget boundary,
            boolean requireDoorBoundary
    ) {
        if (snapshot == null || boundary == null || !boundary.present()) {
            return null;
        }
        if (requireDoorBoundary != boundary.doorKind()) {
            return null;
        }
        return DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef()).singleRoomTouch(snapshot);
    }

    private static DungeonEditorSessionValues.Selection selectionForBoundary(BoundaryTarget boundary, long clusterId) {
        return new DungeonEditorSessionValues.Selection(
                new DungeonTopologyRef(
                        DungeonEditorMainViewInteractionValues.toTopologyKind(boundary.topologyRefKind()),
                        boundary.topologyRefId()),
                clusterId,
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private static DungeonEditorWorkspaceValues.@Nullable Area roomArea(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            @Nullable HitTarget hit
    ) {
        if (snapshot == null || hit == null) {
            return null;
        }
        if (roomHit(hit)) {
            return roomAreaById(snapshot, hit.ownerId());
        }
        if (roomLabelHit(hit)) {
            return roomAreaById(snapshot, hit.topologyRefId());
        }
        if (!clusterLabelHit(hit)) {
            return null;
        }
        return firstRoomAreaInCluster(snapshot, hit.clusterId());
    }

    private static DungeonEditorWorkspaceValues.@Nullable Area roomAreaById(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long roomId
    ) {
        if (!DungeonEditorWorkspaceValues.hasId(roomId)) {
            return null;
        }
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (area.kind().isRoom() && area.id() == roomId) {
                return area;
            }
        }
        return null;
    }

    private static DungeonEditorWorkspaceValues.@Nullable Area firstRoomAreaInCluster(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId
    ) {
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (area.kind().isRoom() && area.clusterId() == clusterId) {
                return area;
            }
        }
        return null;
    }

    private static DungeonEditorWorkspaceValues.Cell corridorRoomCell(
            DungeonEditorWorkspaceValues.Area room,
            int pointerQ,
            int pointerR
    ) {
        DungeonEditorWorkspaceValues.Cell bestCell = null;
        int bestDistance = Integer.MAX_VALUE;
        for (DungeonEditorWorkspaceValues.Cell cell : room.cells()) {
            int distance = Math.abs(cell.q() - pointerQ) + Math.abs(cell.r() - pointerR);
            if (bestCell == null || closerRoomCell(cell, distance, bestCell, bestDistance)) {
                bestCell = cell;
                bestDistance = distance;
            }
        }
        return bestCell == null ? new DungeonEditorWorkspaceValues.Cell(pointerQ, pointerR, 0) : bestCell;
    }

    private static boolean closerRoomCell(
            DungeonEditorWorkspaceValues.Cell cell,
            int distance,
            DungeonEditorWorkspaceValues.Cell bestCell,
            int bestDistance
    ) {
        if (distance != bestDistance) {
            return distance < bestDistance;
        }
        if (cell.r() != bestCell.r()) {
            return cell.r() < bestCell.r();
        }
        return cell.q() < bestCell.q();
    }

    private static String corridorDirection(
            DungeonEditorWorkspaceValues.Area room,
            DungeonEditorWorkspaceValues.Cell roomCell
    ) {
        Set<CellKey> roomCells = new LinkedHashSet<>();
        for (DungeonEditorWorkspaceValues.Cell cell : room.cells()) {
            roomCells.add(new CellKey(cell.q(), cell.r(), cell.level()));
        }
        CellKey key = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (TravelHeading direction : TravelHeading.values()) {
            if (!roomCells.contains(key.neighbor(direction))) {
                return direction.name();
            }
        }
        return "";
    }

    private static boolean roomHit(HitTarget hit) {
        return hit.kind() == HitKind.ROOM && DungeonEditorWorkspaceValues.hasId(hit.ownerId());
    }

    private static boolean roomLabelHit(HitTarget hit) {
        return hit.kind() == HitKind.LABEL
                && DungeonEditorMainViewInteractionValues.ROOM_KIND.equals(hit.topologyRefKind())
                && DungeonEditorWorkspaceValues.hasId(hit.topologyRefId());
    }

    private static boolean clusterLabelHit(HitTarget hit) {
        return hit.kind() == HitKind.LABEL && DungeonEditorWorkspaceValues.hasId(hit.clusterId());
    }
}
