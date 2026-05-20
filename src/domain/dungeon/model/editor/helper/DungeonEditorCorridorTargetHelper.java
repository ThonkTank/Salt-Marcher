package src.domain.dungeon.model.editor.helper;

import org.jspecify.annotations.Nullable;
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
        DungeonEditorRoomInteractionLookupHelper roomLookup = new DungeonEditorRoomInteractionLookupHelper();
        DungeonEditorBoundaryRoomTouchHelper roomTouchService = new DungeonEditorBoundaryRoomTouchHelper();
        PendingCorridorTarget fixedDoorHandleTarget = fixedDoorHandleTarget(input.hitTarget());
        if (fixedDoorHandleTarget != null) {
            return fixedDoorHandleTarget;
        }
        PendingCorridorTarget fixedDoorTarget = fixedDoorBoundaryTarget(input, snapshot, roomTouchService, roomLookup);
        if (fixedDoorTarget != null) {
            return fixedDoorTarget;
        }
        PendingCorridorTarget perimeterWallTarget = perimeterWallTarget(input, snapshot, roomTouchService, roomLookup);
        if (perimeterWallTarget != null) {
            return perimeterWallTarget;
        }
        PendingCorridorTarget explicitAnchorTarget = explicitAnchorTarget(input.hitTarget());
        if (explicitAnchorTarget != null) {
            return explicitAnchorTarget;
        }
        PendingCorridorTarget roomTarget = roomTarget(input, snapshot, input.hitTarget(), roomLookup);
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
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorBoundaryRoomTouchHelper roomTouchService,
            DungeonEditorRoomInteractionLookupHelper roomLookup
    ) {
        BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
        BoundaryRoomTouch roomTouch = roomTouchService.singleRoomTouch(snapshot, boundary, true);
        if (roomTouch == null || boundary == null) {
            return null;
        }
        String direction = roomTouchService.boundaryDirectionForRoomCell(boundary, roomTouch.roomCell());
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                DungeonEditorMainViewInteractionValues.ROOM_PREFIX + roomTouch.room().id() + ":door:" + boundary.topologyRefId(),
                "Tür " + boundary.topologyRefId(),
                roomLookup.selectionForBoundary(boundary, roomTouch.room().clusterId()),
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
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorBoundaryRoomTouchHelper roomTouchService,
            DungeonEditorRoomInteractionLookupHelper roomLookup
    ) {
        BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
        BoundaryRoomTouch roomTouch = roomTouchService.singleRoomTouch(snapshot, boundary, false);
        if (roomTouch == null || boundary == null) {
            return null;
        }
        String direction = roomTouchService.boundaryDirectionForRoomCell(boundary, roomTouch.roomCell());
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
                roomLookup.selectionForBoundary(boundary, roomTouch.room().clusterId()),
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
            HitTarget hit,
            DungeonEditorRoomInteractionLookupHelper roomLookup
    ) {
        var room = roomLookup.roomArea(snapshot, hit);
        if (room == null) {
            return null;
        }
        var roomCell = roomLookup.corridorRoomCell(room, input.q(), input.r());
        String direction = roomLookup.corridorDirection(room, roomCell);
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
}
