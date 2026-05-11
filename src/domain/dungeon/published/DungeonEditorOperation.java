package src.domain.dungeon.published;

/**
 * Semantic operations accepted by the dungeon mutation pipeline.
 */
public sealed interface DungeonEditorOperation permits
        DungeonEditorOperation.MoveTopologyElement,
        DungeonEditorOperation.MoveEditorHandle,
        DungeonEditorOperation.MoveBoundaryStretch,
        DungeonEditorOperation.MoveRoomAnchor,
        DungeonEditorOperation.RoomRectangle,
        DungeonEditorOperation.EditClusterBoundaries,
        DungeonEditorOperation.CreateCorridor,
        DungeonEditorOperation.ExtendCorridor,
        DungeonEditorOperation.MergeCorridors,
        DungeonEditorOperation.DeleteCorridor,
        DungeonEditorOperation.SaveRoomNarration {

    record MoveTopologyElement(
            DungeonTopologyElementRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
        public MoveTopologyElement(DungeonTopologyElementRef ref, int deltaQ, int deltaR) {
            this(ref, deltaQ, deltaR, 0);
        }
    }

    record MoveEditorHandle(
            DungeonEditorHandleRef ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
    }

    record MoveBoundaryStretch(
            long clusterId,
            java.util.List<DungeonEdgeRef> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements DungeonEditorOperation {
        public MoveBoundaryStretch {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? java.util.List.of() : java.util.List.copyOf(sourceEdges);
        }
    }

    record MoveRoomAnchor(int deltaQ, int deltaR) implements DungeonEditorOperation {
    }

    record RoomRectangle(
            RectangleAction action,
            DungeonCellRef start,
            DungeonCellRef end
    ) implements DungeonEditorOperation {
        public RoomRectangle {
            action = action == null ? RectangleAction.PAINT : action;
            start = start == null ? new DungeonCellRef(0, 0, 0) : start;
            end = end == null ? start : end;
        }
    }

    enum RectangleAction {
        PAINT,
        DELETE
    }

    record EditClusterBoundaries(
            long clusterId,
            java.util.List<DungeonEdgeRef> edges,
            DungeonBoundaryKind kind,
            boolean deleteBoundary
    ) implements DungeonEditorOperation {
        public EditClusterBoundaries {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? java.util.List.of() : java.util.List.copyOf(edges);
            kind = kind == null ? DungeonBoundaryKind.WALL : kind;
            }
    }

    sealed interface CorridorEndpoint permits CorridorDoorEndpoint, CorridorAnchorEndpoint {
    }

    record CorridorDoorEndpoint(
            long roomId,
            long clusterId,
            DungeonCellRef roomCell,
            String direction,
            DungeonTopologyElementRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorDoorEndpoint {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            roomCell = roomCell == null ? new DungeonCellRef(0, 0, 0) : roomCell;
            direction = direction == null ? "" : direction.trim();
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    record CorridorAnchorEndpoint(
            long hostCorridorId,
            DungeonCellRef anchorCell,
            DungeonTopologyElementRef topologyRef
    ) implements CorridorEndpoint {
        public CorridorAnchorEndpoint {
            hostCorridorId = Math.max(0L, hostCorridorId);
            anchorCell = anchorCell == null ? new DungeonCellRef(0, 0, 0) : anchorCell;
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    record CorridorRoomEndpoint(
            long roomId,
            long clusterId,
            boolean fixedDoor,
            DungeonCellRef roomCell,
            String direction,
            DungeonTopologyElementRef topologyRef
    ) {
        public CorridorRoomEndpoint {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            roomCell = roomCell == null ? new DungeonCellRef(0, 0, 0) : roomCell;
            direction = direction == null ? "" : direction.trim();
            topologyRef = topologyRef == null ? DungeonTopologyElementRef.empty() : topologyRef;
        }
    }

    record CreateCorridor(
            CorridorEndpoint start,
            CorridorEndpoint end
    ) implements DungeonEditorOperation {
        public CreateCorridor {
            start = start == null
                    ? new CorridorDoorEndpoint(
                    0L,
                    0L,
                    new DungeonCellRef(0, 0, 0),
                    "",
                    DungeonTopologyElementRef.empty())
                    : start;
            end = end == null
                    ? new CorridorDoorEndpoint(
                    0L,
                    0L,
                    new DungeonCellRef(0, 0, 0),
                    "",
                    DungeonTopologyElementRef.empty())
                    : end;
        }
    }

    record ExtendCorridor(
            long corridorId,
            CorridorRoomEndpoint endpoint
    ) implements DungeonEditorOperation {
        public ExtendCorridor {
            corridorId = Math.max(0L, corridorId);
            endpoint = endpoint == null
                    ? new CorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    new DungeonCellRef(0, 0, 0),
                    "",
                    DungeonTopologyElementRef.empty())
                    : endpoint;
        }
    }

    record MergeCorridors(
            long corridorId,
            long mergedCorridorId
    ) implements DungeonEditorOperation {
        public MergeCorridors {
            corridorId = Math.max(0L, corridorId);
            mergedCorridorId = Math.max(0L, mergedCorridorId);
        }
    }

    record DeleteCorridor(long corridorId) implements DungeonEditorOperation {
        public DeleteCorridor {
            corridorId = Math.max(0L, corridorId);
        }
    }

    record SaveRoomNarration(
            long roomId,
            String visualDescription,
            java.util.List<DungeonInspectorSnapshot.RoomExitNarration> exits
    ) implements DungeonEditorOperation {
        public SaveRoomNarration {
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? java.util.List.of() : java.util.List.copyOf(exits);
        }
    }
}
