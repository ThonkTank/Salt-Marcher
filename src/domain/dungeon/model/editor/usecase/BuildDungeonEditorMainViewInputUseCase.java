package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class BuildDungeonEditorMainViewInputUseCase {

    public DungeonEditorMainViewInput execute(MainViewInput input) {
        return input == null ? DungeonEditorMainViewInput.empty() : input.mainViewInput();
    }

    public record MainViewInput(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            PointerTargetInput target
    ) {
        public MainViewInput {
            target = target == null ? PointerTargetInput.empty() : target;
        }

        public static MainViewInput empty() {
            return new MainViewInput(0.0, 0.0, false, false, PointerTargetInput.empty());
        }

        private DungeonEditorMainViewInput mainViewInput() {
            return new DungeonEditorMainViewInput(
                    canvasX,
                    canvasY,
                    primaryButtonDown,
                    secondaryButtonDown,
                    target.pointerTarget());
        }
    }

    public record PointerTargetInput(
            TargetKindInput targetKind,
            TopologyKindInput elementKind,
            long ownerId,
            long clusterId,
            TopologyRefInput topologyRef,
            HandleInput handleRef,
            BoundaryInput boundaryRef
    ) {
        public PointerTargetInput {
            targetKind = targetKind == null ? TargetKindInput.EMPTY : targetKind;
            elementKind = elementKind == null ? TopologyKindInput.EMPTY : elementKind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRef = topologyRef == null ? TopologyRefInput.empty() : topologyRef;
            handleRef = handleRef == null ? HandleInput.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryInput.empty() : boundaryRef;
        }

        public static PointerTargetInput empty() {
            return new PointerTargetInput(
                    TargetKindInput.EMPTY,
                    TopologyKindInput.EMPTY,
                    0L,
                    0L,
                    TopologyRefInput.empty(),
                    HandleInput.empty(),
                    BoundaryInput.empty());
        }

        private DungeonEditorMainViewPointerTarget pointerTarget() {
            return switch (targetKind) {
                case EMPTY -> DungeonEditorMainViewPointerTarget.empty();
                case CELL -> DungeonEditorMainViewPointerTarget.cell(
                        elementKind.topologyKind(),
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
                case LABEL -> DungeonEditorMainViewPointerTarget.label(
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
                case GRAPH_NODE -> DungeonEditorMainViewPointerTarget.graphNode(
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
                case HANDLE -> DungeonEditorMainViewPointerTarget.handle(handleRef.handleRef());
                case BOUNDARY -> DungeonEditorMainViewPointerTarget.boundary(
                        boundaryRef.kind().boundaryKind(),
                        boundaryRef.key(),
                        boundaryRef.ownerId(),
                        boundaryRef.topologyRef().topologyRef(),
                        boundaryRef.start().cell(),
                        boundaryRef.end().cell());
            };
        }
    }

    public record TopologyRefInput(TopologyKindInput kind, long id) {
        public TopologyRefInput {
            kind = kind == null ? TopologyKindInput.EMPTY : kind;
            id = Math.max(0L, id);
        }

        public static TopologyRefInput empty() {
            return new TopologyRefInput(TopologyKindInput.EMPTY, 0L);
        }

        private DungeonTopologyRef topologyRef() {
            return new DungeonTopologyRef(kind.topologyKind(), id);
        }
    }

    public record HandleInput(
            HandleKindInput kind,
            TopologyRefInput topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            CellInput cell,
            String direction
    ) {
        public HandleInput {
            kind = kind == null ? HandleKindInput.CLUSTER_LABEL : kind;
            topologyRef = topologyRef == null ? TopologyRefInput.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            cell = cell == null ? CellInput.empty() : cell;
            direction = direction == null ? "" : direction.trim();
        }

        public static HandleInput empty() {
            return new HandleInput(
                    HandleKindInput.CLUSTER_LABEL,
                    TopologyRefInput.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    CellInput.empty(),
                    "");
        }

        private DungeonEditorWorkspaceValues.HandleRef handleRef() {
            return new DungeonEditorWorkspaceValues.HandleRef(
                    kind.handleType(),
                    topologyRef.topologyRef(),
                    ownerId,
                    clusterId,
                    corridorId,
                    roomId,
                    index,
                    cell.cell(),
                    direction);
        }
    }

    public record BoundaryInput(
            BoundaryKindInput kind,
            String key,
            long ownerId,
            TopologyRefInput topologyRef,
            CellInput start,
            CellInput end
    ) {
        public BoundaryInput {
            kind = kind == null ? BoundaryKindInput.WALL : kind;
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            topologyRef = topologyRef == null ? TopologyRefInput.empty() : topologyRef;
            start = start == null ? CellInput.empty() : start;
            end = end == null ? CellInput.empty() : end;
        }

        public static BoundaryInput empty() {
            return new BoundaryInput(
                    BoundaryKindInput.WALL,
                    "",
                    0L,
                    TopologyRefInput.empty(),
                    CellInput.empty(),
                    CellInput.empty());
        }
    }

    public record CellInput(int q, int r, int level) {
        public static CellInput empty() {
            return new CellInput(0, 0, 0);
        }

        private DungeonEditorWorkspaceValues.Cell cell() {
            return new DungeonEditorWorkspaceValues.Cell(q, r, level);
        }
    }

    public enum TargetKindInput {
        EMPTY,
        CELL,
        LABEL,
        GRAPH_NODE,
        HANDLE,
        BOUNDARY;

        public static TargetKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return EMPTY;
            }
            return valueOf(name.trim());
        }
    }

    public enum TopologyKindInput {
        EMPTY,
        ROOM,
        CORRIDOR,
        CORRIDOR_ANCHOR,
        DOOR,
        WALL,
        STAIR,
        TRANSITION;

        public static TopologyKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return EMPTY;
            }
            return valueOf(name.trim());
        }

        private DungeonTopologyElementKind topologyKind() {
            return DungeonTopologyElementKind.valueOf(name());
        }
    }

    public enum HandleKindInput {
        CLUSTER_LABEL,
        DOOR,
        CORRIDOR_ANCHOR,
        CORRIDOR_WAYPOINT,
        STAIR_ANCHOR;

        public static HandleKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return CLUSTER_LABEL;
            }
            return valueOf(name.trim());
        }

        private DungeonEditorHandleType handleType() {
            return DungeonEditorHandleType.valueOf(name());
        }
    }

    public enum BoundaryKindInput {
        WALL,
        DOOR;

        public static BoundaryKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return WALL;
            }
            return valueOf(name.trim());
        }

        private DungeonEditorWorkspaceValues.BoundaryKind boundaryKind() {
            return DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(name());
        }
    }
}
