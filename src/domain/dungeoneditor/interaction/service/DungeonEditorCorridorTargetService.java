package src.domain.dungeoneditor.interaction.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.HandleTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.HitTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorCorridorTargetService {
    public @Nullable PendingCorridorTarget resolveCreateTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        DungeonEditorRoomInteractionLookupService roomLookup = new DungeonEditorRoomInteractionLookupService();
        DungeonEditorBoundaryRoomTouchService roomTouchService = new DungeonEditorBoundaryRoomTouchService();
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
                || hit.handleRef().roomId() <= 0L
                || hit.handleRef().clusterId() <= 0L
                || hit.handleRef().direction().isBlank()
                || hit.topologyRefId() <= 0L) {
            return null;
        }
        HandleTarget handleRef = hit.handleRef();
        return new PendingCorridorTarget.EndpointTarget(
                DungeonEditorMainViewInteractionValues.ROOM_PREFIX + handleRef.roomId() + ":door:" + hit.topologyRefId(),
                "Tür " + hit.topologyRefId(),
                new DungeonEditorSessionValues.Selection(
                        new DungeonEditorWorkspaceValues.TopologyElementRef(
                                DungeonEditorWorkspaceValues.TopologyElementKind.DOOR,
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
                        new DungeonEditorWorkspaceValues.TopologyElementRef(
                                DungeonEditorWorkspaceValues.TopologyElementKind.DOOR,
                                hit.topologyRefId())));
    }

    private @Nullable PendingCorridorTarget fixedDoorBoundaryTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorBoundaryRoomTouchService roomTouchService,
            DungeonEditorRoomInteractionLookupService roomLookup
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
                        new DungeonEditorWorkspaceValues.TopologyElementRef(
                                DungeonEditorMainViewInteractionValues.toTopologyKind(boundary.topologyRefKind()),
                                boundary.topologyRefId())));
    }

    private @Nullable PendingCorridorTarget perimeterWallTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorBoundaryRoomTouchService roomTouchService,
            DungeonEditorRoomInteractionLookupService roomLookup
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
                        DungeonEditorWorkspaceValues.TopologyElementRef.empty()));
    }

    private static @Nullable PendingCorridorTarget explicitAnchorTarget(@Nullable HitTarget hit) {
        if (hit == null || hit.handleRef() == null || !hit.handleRef().corridorAnchor()) {
            return null;
        }
        long hostCorridorId = hit.handleRef().corridorId();
        if (hostCorridorId <= 0L) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "anchor:" + hit.topologyRefId(),
                "Anker " + hit.topologyRefId(),
                new DungeonEditorSessionValues.Selection(
                        new DungeonEditorWorkspaceValues.TopologyElementRef(
                                DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR,
                                hostCorridorId),
                        0L,
                        false,
                        DungeonEditorSessionValues.emptyHandleRef()),
                hostCorridorId,
                new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                        hostCorridorId,
                        hit.handleRef().anchor().toWorkspaceCell(),
                        new DungeonEditorWorkspaceValues.TopologyElementRef(
                                DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR_ANCHOR,
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
        long corridorId = hit.topologyRefId() > 0L
                && DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR.name().equals(hit.topologyRefKind())
                ? hit.topologyRefId()
                : hit.kind() == HitKind.CORRIDOR ? hit.ownerId() : 0L;
        if (corridorId <= 0L) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "corridor:" + corridorId + ":" + input.q() + ":" + input.r() + ":" + input.level(),
                "Korridor " + corridorId,
                new DungeonEditorSessionValues.Selection(
                        new DungeonEditorWorkspaceValues.TopologyElementRef(
                                DungeonEditorWorkspaceValues.TopologyElementKind.CORRIDOR,
                                corridorId),
                        0L,
                        false,
                        DungeonEditorSessionValues.emptyHandleRef()),
                corridorId,
                new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                        corridorId,
                        new DungeonEditorWorkspaceValues.Cell(input.q(), input.r(), input.level()),
                        DungeonEditorWorkspaceValues.TopologyElementRef.empty()));
    }

    private @Nullable PendingCorridorTarget roomTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            HitTarget hit,
            DungeonEditorRoomInteractionLookupService roomLookup
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
                        DungeonEditorWorkspaceValues.TopologyElementRef.empty()));
    }
}
