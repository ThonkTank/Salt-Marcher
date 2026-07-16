package features.dungeon.application.editor;

import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.application.editor.interaction.DungeonEditorHandleType;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.TravelHeading;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryRoomTouch;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.HitKind;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.HitTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PendingCorridorTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorCorridorTargetHelper {
    private static final String DOOR_LABEL_PREFIX = "Tür ";
    private final CreateTargets createTargets = new CreateTargets();

    @Nullable PendingCorridorTarget resolveCreateTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        return createTargets.resolve(input, snapshot);
    }

    @Nullable PendingCorridorTarget resolveDeleteTarget(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot
    ) {
        HitTarget hit = input == null ? null : input.hitTarget();
        PendingCorridorTarget doorTarget = EndpointTargets.deleteDoorHandle(hit);
        if (doorTarget != null) {
            return doorTarget;
        }
        PendingCorridorTarget doorBoundaryTarget = SnapshotEndpointTargets.deleteDoorBoundary(hit, snapshot);
        if (doorBoundaryTarget != null) {
            return doorBoundaryTarget;
        }
        PendingCorridorTarget explicitAnchorTarget = EndpointTargets.explicitAnchor(hit);
        if (explicitAnchorTarget != null) {
            return explicitAnchorTarget;
        }
        PendingCorridorTarget waypointTarget = EndpointTargets.deleteWaypointHandle(hit);
        if (waypointTarget != null) {
            return waypointTarget;
        }
        PendingCorridorTarget bodyPointTarget = SnapshotEndpointTargets.corridorBodyPoint(input, snapshot);
        return bodyPointTarget != null ? bodyPointTarget : EndpointTargets.corridor(input);
    }

    private static final class CreateTargets {
        private @Nullable PendingCorridorTarget resolve(
                PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot
        ) {
            PendingCorridorTarget fixedDoorHandle =
                    EndpointTargets.fixedDoorHandle(input == null ? null : input.hitTarget());
            if (fixedDoorHandle != null) {
                return fixedDoorHandle;
            }
            PendingCorridorTarget fixedDoorTarget = BoundaryTargets.fixedDoor(input, snapshot);
            if (fixedDoorTarget != null) {
                return fixedDoorTarget;
            }
            PendingCorridorTarget perimeterWallTarget = BoundaryTargets.perimeterWall(input, snapshot);
            if (perimeterWallTarget != null) {
                return perimeterWallTarget;
            }
            PendingCorridorTarget explicitAnchorTarget =
                    EndpointTargets.explicitAnchor(input == null ? null : input.hitTarget());
            if (explicitAnchorTarget != null) {
                return explicitAnchorTarget;
            }
            PendingCorridorTarget roomTarget = RoomTargets.room(input, snapshot, input == null ? null : input.hitTarget());
            return roomTarget != null ? roomTarget : EndpointTargets.corridor(input);
        }
    }

    private static final class EndpointTargets {
        private static @Nullable PendingCorridorTarget fixedDoorHandle(@Nullable HitTarget hit) {
            if (!validDoorHandle(hit)) {
                return null;
            }
            DungeonEditorWorkspaceValues.HandleRef handleRef = hit.handleRef();
            DungeonEditorWorkspaceValues.Cell roomCell = roomCellForDoorHandle(handleRef);
            return new PendingCorridorTarget.EndpointTarget(
                    DungeonEditorMainViewInteractionValues.doorTargetKey(handleRef.roomId(), hit.topologyRefId()),
                    DOOR_LABEL_PREFIX + hit.topologyRefId(),
                    new DungeonEditorSessionValues.Selection(
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.DOOR,
                                    hit.topologyRefId()),
                            handleRef.clusterId(),
                            false,
                            handleRef),
                    0L,
                    new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                            handleRef.roomId(),
                            handleRef.clusterId(),
                            roomCell,
                            handleRef.direction(),
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.DOOR,
                                    hit.topologyRefId())));
        }

        private static @Nullable PendingCorridorTarget deleteDoorHandle(@Nullable HitTarget hit) {
            if (!validDoorHandle(hit) || !DungeonEditorWorkspaceValues.hasId(hit.handleRef().corridorId())) {
                return null;
            }
            DungeonEditorWorkspaceValues.HandleRef handleRef = hit.handleRef();
            return new PendingCorridorTarget.EndpointTarget(
                    "delete-door:" + hit.topologyRefId(),
                    DOOR_LABEL_PREFIX + hit.topologyRefId(),
                    new DungeonEditorSessionValues.Selection(
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.DOOR,
                                    hit.topologyRefId()),
                            handleRef.clusterId(),
                            false,
                            handleRef),
                    handleRef.corridorId(),
                    new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                            handleRef.roomId(),
                            handleRef.clusterId(),
                            handleRef.cell(),
                            handleRef.direction(),
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.DOOR,
                                    hit.topologyRefId())));
        }

        private static @Nullable PendingCorridorTarget explicitAnchor(@Nullable HitTarget hit) {
            if (hit == null
                    || hit.handleRef() == null
                    || !DungeonEditorMainViewInteractionValues.handleKind(
                            hit.handleRef(),
                            DungeonEditorHandleType.CORRIDOR_ANCHOR)) {
                return null;
            }
            long hostCorridorId = hit.handleRef().corridorId();
            if (!DungeonEditorWorkspaceValues.hasId(hostCorridorId)) {
                return null;
            }
            DungeonEditorWorkspaceValues.HandleRef handleRef = hit.handleRef();
            return new PendingCorridorTarget.EndpointTarget(
                    "anchor:" + hit.topologyRefId(),
                    "Anker " + hit.topologyRefId(),
                    new DungeonEditorSessionValues.Selection(
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    hit.topologyRefId()),
                            0L,
                            false,
                            handleRef),
                    hostCorridorId,
                    new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                            hostCorridorId,
                            hit.handleRef().cell(),
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    hit.topologyRefId())));
        }

        private static @Nullable PendingCorridorTarget deleteWaypointHandle(@Nullable HitTarget hit) {
            if (hit == null
                    || hit.handleRef() == null
                    || !DungeonEditorMainViewInteractionValues.handleKind(
                            hit.handleRef(),
                            DungeonEditorHandleType.CORRIDOR_WAYPOINT)
                    || !DungeonEditorWorkspaceValues.hasId(hit.handleRef().corridorId())) {
                return null;
            }
            DungeonEditorWorkspaceValues.HandleRef handleRef = hit.handleRef();
            return new PendingCorridorTarget.EndpointTarget(
                    "delete-waypoint:" + handleRef.corridorId() + ":" + handleRef.index(),
                    "Wegpunkt " + (handleRef.index() + 1),
                    new DungeonEditorSessionValues.Selection(
                            new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, handleRef.corridorId()),
                            handleRef.clusterId(),
                            false,
                            handleRef),
                    handleRef.corridorId(),
                    new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                            handleRef.corridorId(),
                            handleRef.cell(),
                            DungeonTopologyRef.empty()));
        }

        private static @Nullable PendingCorridorTarget corridor(@Nullable PointerState input) {
            if (input == null || input.hitTarget() == null) {
                return null;
            }
            long corridorId = resolveCorridorId(input.hitTarget());
            if (!DungeonEditorWorkspaceValues.hasId(corridorId)) {
                return null;
            }
            return new PendingCorridorTarget.EndpointTarget(
                    "corridor:" + corridorId + ":" + input.q() + ":" + input.r() + ":" + input.level(),
                    "Korridor " + corridorId,
                    corridorSelection(corridorId),
                    corridorId,
                    new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                            corridorId,
                            new DungeonEditorWorkspaceValues.Cell(input.q(), input.r(), input.level()),
                            DungeonTopologyRef.empty()));
        }

        private static boolean validDoorHandle(@Nullable HitTarget hit) {
            return hit != null
                    && hit.handleRef() != null
                    && DungeonEditorMainViewInteractionValues.handleKind(
                            hit.handleRef(),
                            DungeonEditorHandleType.DOOR)
                    && DungeonEditorWorkspaceValues.hasId(hit.handleRef().roomId())
                    && DungeonEditorWorkspaceValues.hasId(hit.handleRef().clusterId())
                    && !hit.handleRef().direction().isBlank()
                    && DungeonEditorWorkspaceValues.hasId(hit.topologyRefId());
        }

        private static DungeonEditorWorkspaceValues.Cell roomCellForDoorHandle(DungeonEditorWorkspaceValues.HandleRef handleRef) {
            DungeonEditorWorkspaceValues.Cell corridorCell = handleRef.cell();
            return switch (handleRef.direction()) {
                case "EAST" -> roomCellNear(corridorCell, -1, 0);
                case "SOUTH" -> roomCellNear(corridorCell, 0, -1);
                case "WEST" -> roomCellNear(corridorCell, 1, 0);
                case "NORTH" -> roomCellNear(corridorCell, 0, 1);
                default -> roomCellNear(corridorCell, 0, 1);
            };
        }

        private static DungeonEditorWorkspaceValues.Cell roomCellNear(
                DungeonEditorWorkspaceValues.Cell corridorCell,
                int deltaQ,
                int deltaR
        ) {
            return new DungeonEditorWorkspaceValues.Cell(
                    corridorCell.q() + deltaQ,
                    corridorCell.r() + deltaR,
                    corridorCell.level());
        }

        private static long resolveCorridorId(HitTarget hit) {
            if (DungeonEditorWorkspaceValues.hasId(hit.topologyRefId())
                    && hit.topologyKind().isCorridor()) {
                return hit.topologyRefId();
            }
            return hit.kind() == HitKind.CORRIDOR ? hit.ownerId() : 0L;
        }

        private static DungeonEditorSessionValues.Selection corridorSelection(long corridorId) {
            return new DungeonEditorSessionValues.Selection(
                    new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, corridorId),
                    0L,
                    false,
                    DungeonEditorSessionValues.emptyHandleRef());
        }
    }

    private static final class SnapshotEndpointTargets {
        private static @Nullable PendingCorridorTarget deleteDoorBoundary(
                @Nullable HitTarget hit,
                DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot
        ) {
            if (hit == null
                    || snapshot == null
                    || !hit.topologyKind().isDoor()
                    || !DungeonEditorWorkspaceValues.hasId(hit.topologyRefId())) {
                return null;
            }
            for (DungeonEditorWorkspaceValues.Handle handle : snapshot.editorHandles()) {
                DungeonEditorWorkspaceValues.HandleRef ref = handle.ref();
                if (ref.kind() == DungeonEditorHandleType.DOOR
                        && ref.topologyRef().id() == hit.topologyRefId()
                        && DungeonEditorWorkspaceValues.hasId(ref.corridorId())) {
                    return new PendingCorridorTarget.EndpointTarget(
                            "delete-door:" + hit.topologyRefId(),
                            DOOR_LABEL_PREFIX + hit.topologyRefId(),
                            new DungeonEditorSessionValues.Selection(
                                    new DungeonTopologyRef(
                                            DungeonTopologyElementKind.DOOR,
                                            hit.topologyRefId()),
                                    ref.clusterId(),
                                    false,
                                    ref),
                            ref.corridorId(),
                            new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                                    ref.roomId(),
                                    ref.clusterId(),
                                    ref.cell(),
                                    ref.direction(),
                                    new DungeonTopologyRef(
                                            DungeonTopologyElementKind.DOOR,
                                            hit.topologyRefId())));
                }
            }
            return null;
        }

        private static @Nullable PendingCorridorTarget corridorBodyPoint(
                @Nullable PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot
        ) {
            if (input == null || input.hitTarget() == null) {
                return null;
            }
            long corridorId = EndpointTargets.resolveCorridorId(input.hitTarget());
            if (!DungeonEditorWorkspaceValues.hasId(corridorId)) {
                return null;
            }
            DungeonEditorWorkspaceValues.HandleRef ref =
                    DungeonEditorCorridorPointLookup.authoredPointAt(input, snapshot, corridorId);
            return DungeonEditorWorkspaceValues.hasId(ref.topologyRef().id()) ? corridorPoint(ref) : null;
        }

        private static @Nullable PendingCorridorTarget corridorPoint(DungeonEditorWorkspaceValues.HandleRef ref) {
            if (ref.kind() == DungeonEditorHandleType.CORRIDOR_ANCHOR) {
                return corridorAnchorPoint(ref);
            }
            if (ref.kind() == DungeonEditorHandleType.CORRIDOR_WAYPOINT) {
                return corridorWaypointPoint(ref);
            }
            return null;
        }

        private static PendingCorridorTarget corridorAnchorPoint(DungeonEditorWorkspaceValues.HandleRef ref) {
            return new PendingCorridorTarget.EndpointTarget(
                    "anchor:" + ref.topologyRef().id(),
                    "Anker " + ref.topologyRef().id(),
                    new DungeonEditorSessionValues.Selection(
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    ref.topologyRef().id()),
                            0L,
                            false,
                            ref),
                    ref.corridorId(),
                    new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                            ref.corridorId(),
                            ref.cell(),
                            new DungeonTopologyRef(
                                    DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                    ref.topologyRef().id())));
        }

        private static PendingCorridorTarget corridorWaypointPoint(DungeonEditorWorkspaceValues.HandleRef ref) {
            return new PendingCorridorTarget.EndpointTarget(
                    "delete-waypoint:" + ref.corridorId() + ":" + ref.index(),
                    "Wegpunkt " + (ref.index() + 1),
                    new DungeonEditorSessionValues.Selection(
                            new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR, ref.corridorId()),
                            ref.clusterId(),
                            false,
                            ref),
                    ref.corridorId(),
                    new DungeonEditorWorkspaceValues.CorridorAnchorEndpoint(
                            ref.corridorId(),
                            ref.cell(),
                            DungeonTopologyRef.empty()));
        }

    }

    private static final class BoundaryTargets {
        private static @Nullable PendingCorridorTarget fixedDoor(
                PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot
        ) {
            return boundaryTarget(input, snapshot, true);
        }

        private static @Nullable PendingCorridorTarget perimeterWall(
                PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot
        ) {
            return boundaryTarget(input, snapshot, false);
        }

        private static @Nullable PendingCorridorTarget boundaryTarget(
                PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                boolean requireDoorBoundary
        ) {
            BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
            BoundaryRoomTouch roomTouch = boundaryRoomTouch(snapshot, boundary, requireDoorBoundary);
            if (roomTouch == null || boundary == null) {
                return null;
            }
            String direction = DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef())
                    .directionForCell(roomTouch.roomCell());
            if (direction.isBlank()) {
                return null;
            }
            return requireDoorBoundary
                    ? fixedDoorEndpoint(boundary, roomTouch, direction)
                    : perimeterWallEndpoint(boundary, roomTouch, direction);
        }

        private static PendingCorridorTarget fixedDoorEndpoint(
                BoundaryTarget boundary,
                BoundaryRoomTouch roomTouch,
                String direction
        ) {
            return new PendingCorridorTarget.EndpointTarget(
                    DungeonEditorMainViewInteractionValues.doorTargetKey(
                            roomTouch.room().id(),
                            boundary.topologyRefId()),
                    DOOR_LABEL_PREFIX + boundary.topologyRefId(),
                    selectionForBoundary(boundary, roomTouch.room().clusterId()),
                    0L,
                    doorEndpoint(boundary, roomTouch, direction, boundaryRef(boundary)));
        }

        private static PendingCorridorTarget perimeterWallEndpoint(
                BoundaryTarget boundary,
                BoundaryRoomTouch roomTouch,
                String direction
        ) {
            return new PendingCorridorTarget.EndpointTarget(
                    wallKey(boundary, roomTouch.room().id()),
                    roomTouch.room().label().isBlank() ? "Raum " + roomTouch.room().id() : roomTouch.room().label(),
                    selectionForBoundary(boundary, roomTouch.room().clusterId()),
                    0L,
                    doorEndpoint(boundary, roomTouch, direction, DungeonTopologyRef.empty()));
        }

        private static @Nullable BoundaryRoomTouch boundaryRoomTouch(
                DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
                @Nullable BoundaryTarget boundary,
                boolean requireDoorBoundary
        ) {
            if (snapshot == null || boundary == null || !boundary.present() || requireDoorBoundary != boundary.doorKind()) {
                return null;
            }
            return DungeonEditorBoundaryTouchGeometry.fromEdge(boundary.edgeRef()).singleRoomTouch(snapshot);
        }

        private static DungeonEditorWorkspaceValues.CorridorDoorEndpoint doorEndpoint(
                BoundaryTarget boundary,
                BoundaryRoomTouch roomTouch,
                String direction,
                DungeonTopologyRef boundaryRef
        ) {
            return new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                    roomTouch.room().id(),
                    roomTouch.room().clusterId(),
                    roomTouch.roomCell(),
                    direction,
                    boundaryRef);
        }
    }

    private static final class RoomTargets {
        private static @Nullable PendingCorridorTarget room(
                PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                HitTarget hit
        ) {
            if (input == null) {
                return null;
            }
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
                    DungeonEditorMainViewInteractionValues.roomTargetKey(room.id()),
                    room.label().isBlank() ? "Raum " + room.id() : room.label(),
                    roomSelection(room),
                    room.clusterId(),
                    new DungeonEditorWorkspaceValues.CorridorDoorEndpoint(
                            room.id(),
                            room.clusterId(),
                            roomCell,
                            direction,
                            DungeonTopologyRef.empty()));
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
                DungeonEditorWorkspaceValues.Area room = roomAreaById(snapshot, hit.topologyRefId());
                return room == null ? firstRoomAreaInCluster(snapshot, hit.clusterId()) : room;
            }
            return clusterLabelHit(hit) ? firstRoomAreaInCluster(snapshot, hit.clusterId()) : null;
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

        private static boolean closerRoomCell(
                DungeonEditorWorkspaceValues.Cell cell,
                int distance,
                DungeonEditorWorkspaceValues.Cell bestCell,
                int bestDistance
        ) {
            if (distance != bestDistance) {
                return distance < bestDistance;
            }
            return cell.r() != bestCell.r() ? cell.r() < bestCell.r() : cell.q() < bestCell.q();
        }
    }

    private static DungeonEditorSessionValues.Selection selectionForBoundary(BoundaryTarget boundary, long clusterId) {
        return new DungeonEditorSessionValues.Selection(
                boundaryRef(boundary),
                clusterId,
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private static DungeonEditorSessionValues.Selection roomSelection(DungeonEditorWorkspaceValues.Area room) {
        return new DungeonEditorSessionValues.Selection(
                room.topologyRef(),
                room.clusterId(),
                false,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private static DungeonTopologyRef boundaryRef(BoundaryTarget boundary) {
        return boundary.topologyRef();
    }

    private static String wallKey(BoundaryTarget boundary, long roomId) {
        return DungeonEditorMainViewInteractionValues.roomTargetKey(roomId)
                + ":wall:"
                + boundary.start().q()
                + ":"
                + boundary.start().r()
                + ":"
                + boundary.end().q()
                + ":"
                + boundary.end().r()
                + ":"
                + boundary.start().level();
    }

    private static boolean roomHit(HitTarget hit) {
        return hit.kind() == HitKind.ROOM && DungeonEditorWorkspaceValues.hasId(hit.ownerId());
    }

    private static boolean roomLabelHit(HitTarget hit) {
        return hit.kind() == HitKind.LABEL
                && hit.topologyKind().isRoom()
                && DungeonEditorWorkspaceValues.hasId(hit.topologyRefId());
    }

    private static boolean clusterLabelHit(HitTarget hit) {
        return hit.kind() == HitKind.LABEL && DungeonEditorWorkspaceValues.hasId(hit.clusterId());
    }
}
