package src.domain.dungeon.model.runtime.usecase;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorMainViewInput;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;

public final class BuildDungeonEditorMainViewInputUseCase {

    public DungeonEditorMainViewInput execute(MainViewInput input) {
        return input == null ? DungeonEditorMainViewInput.empty() : input.mainViewInput();
    }

    public record MainViewInput(
            double canvasX,
            double canvasY,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            PointerTargetInput target,
            String transitionDestinationTypeName,
            long transitionDestinationMapId,
            long transitionDestinationTileId,
            long transitionDestinationTransitionId
    ) {
        public MainViewInput {
            target = target == null ? PointerTargetInput.empty() : target;
            transitionDestinationTypeName = transitionDestinationTypeName == null
                    ? ""
                    : transitionDestinationTypeName.trim();
            transitionDestinationMapId = Math.max(0L, transitionDestinationMapId);
            transitionDestinationTileId = Math.max(0L, transitionDestinationTileId);
            transitionDestinationTransitionId = Math.max(0L, transitionDestinationTransitionId);
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
            if (targetKind == TargetKindInput.CELL) {
                return DungeonEditorMainViewPointerTarget.cell(
                        elementKind.topologyKind(),
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
            }
            if (targetKind == TargetKindInput.LABEL) {
                return DungeonEditorMainViewPointerTarget.label(
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
            }
            if (targetKind == TargetKindInput.GRAPH_NODE) {
                return DungeonEditorMainViewPointerTarget.graphNode(
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
            }
            if (targetKind == TargetKindInput.HANDLE) {
                return DungeonEditorMainViewPointerTarget.handle(handleRef.handleRef());
            }
            if (targetKind == TargetKindInput.BOUNDARY) {
                return DungeonEditorMainViewPointerTarget.boundary(
                        boundaryRef.kind().boundaryKind(),
                        boundaryRef.key(),
                        boundaryRef.ownerId(),
                        boundaryRef.topologyRef().topologyRef(),
                        boundaryRef.start().cell(),
                        boundaryRef.end().cell());
            }
            return DungeonEditorMainViewPointerTarget.empty();
        }
    }

    public static final class TopologyRefInput {
        private final TopologyKindInput kind;
        private final long id;

        public TopologyRefInput(TopologyKindInput kind, long id) {
            this.kind = kind == null ? TopologyKindInput.EMPTY : kind;
            this.id = Math.max(0L, id);
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

    public static final class CellInput {
        private final int q;
        private final int r;
        private final int level;

        public CellInput(int q, int r, int level) {
            this.q = q;
            this.r = r;
            this.level = level;
        }

        public static CellInput empty() {
            return new CellInput(0, 0, 0);
        }

        private DungeonEditorWorkspaceValues.Cell cell() {
            return new DungeonEditorWorkspaceValues.Cell(q, r, level);
        }
    }

    public static final class TargetKindInput implements NamedInput {
        public static final TargetKindInput EMPTY = new TargetKindInput("EMPTY");
        public static final TargetKindInput CELL = new TargetKindInput("CELL");
        public static final TargetKindInput LABEL = new TargetKindInput("LABEL");
        public static final TargetKindInput GRAPH_NODE = new TargetKindInput("GRAPH_NODE");
        public static final TargetKindInput HANDLE = new TargetKindInput("HANDLE");
        public static final TargetKindInput BOUNDARY = new TargetKindInput("BOUNDARY");
        private static final TargetKindInput[] VALUES = {EMPTY, CELL, LABEL, GRAPH_NODE, HANDLE, BOUNDARY};

        private final String name;

        private TargetKindInput(String name) {
            this.name = name;
        }

        public static TargetKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return EMPTY;
            }
            return findByName(VALUES, name.trim(), "target kind");
        }

        @Override
        public String name() {
            return name;
        }
    }

    public static final class TopologyKindInput implements NamedInput {
        public static final TopologyKindInput EMPTY = new TopologyKindInput("EMPTY");
        public static final TopologyKindInput ROOM = new TopologyKindInput("ROOM");
        public static final TopologyKindInput CORRIDOR = new TopologyKindInput("CORRIDOR");
        public static final TopologyKindInput CORRIDOR_ANCHOR = new TopologyKindInput("CORRIDOR_ANCHOR");
        public static final TopologyKindInput DOOR = new TopologyKindInput("DOOR");
        public static final TopologyKindInput WALL = new TopologyKindInput("WALL");
        public static final TopologyKindInput STAIR = new TopologyKindInput("STAIR");
        public static final TopologyKindInput TRANSITION = new TopologyKindInput("TRANSITION");
        private static final TopologyKindInput[] VALUES = {
                EMPTY,
                ROOM,
                CORRIDOR,
                CORRIDOR_ANCHOR,
                DOOR,
                WALL,
                STAIR,
                TRANSITION
        };

        private final String name;

        private TopologyKindInput(String name) {
            this.name = name;
        }

        public static TopologyKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return EMPTY;
            }
            return findByName(VALUES, name.trim(), "topology kind");
        }

        private DungeonTopologyElementKind topologyKind() {
            return DungeonTopologyElementKind.valueOf(name());
        }

        @Override
        public String name() {
            return name;
        }
    }

    public static final class HandleKindInput implements NamedInput {
        public static final HandleKindInput CLUSTER_LABEL = new HandleKindInput("CLUSTER_LABEL");
        public static final HandleKindInput CLUSTER_CORNER = new HandleKindInput("CLUSTER_CORNER");
        public static final HandleKindInput DOOR = new HandleKindInput("DOOR");
        public static final HandleKindInput CORRIDOR_ANCHOR = new HandleKindInput("CORRIDOR_ANCHOR");
        public static final HandleKindInput CORRIDOR_WAYPOINT = new HandleKindInput("CORRIDOR_WAYPOINT");
        public static final HandleKindInput STAIR_ANCHOR = new HandleKindInput("STAIR_ANCHOR");
        private static final HandleKindInput[] VALUES = {
                CLUSTER_LABEL,
                CLUSTER_CORNER,
                DOOR,
                CORRIDOR_ANCHOR,
                CORRIDOR_WAYPOINT,
                STAIR_ANCHOR
        };

        private final String name;

        private HandleKindInput(String name) {
            this.name = name;
        }

        public static HandleKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return CLUSTER_LABEL;
            }
            return findByName(VALUES, name.trim(), "handle kind");
        }

        private DungeonEditorHandleType handleType() {
            return DungeonEditorHandleType.valueOf(name());
        }

        @Override
        public String name() {
            return name;
        }
    }

    public static final class BoundaryKindInput implements NamedInput {
        public static final BoundaryKindInput WALL = new BoundaryKindInput("WALL");
        public static final BoundaryKindInput DOOR = new BoundaryKindInput("DOOR");
        private static final BoundaryKindInput[] VALUES = {WALL, DOOR};

        private final String name;

        private BoundaryKindInput(String name) {
            this.name = name;
        }

        public static BoundaryKindInput fromName(String name) {
            if (name == null || name.isBlank()) {
                return WALL;
            }
            return findByName(VALUES, name.trim(), "boundary kind");
        }

        private DungeonEditorWorkspaceValues.BoundaryKind boundaryKind() {
            return DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(name());
        }

        @Override
        public String name() {
            return name;
        }
    }

    private interface NamedInput {
        String name();
    }

    private static <T extends NamedInput> T findByName(T[] values, String name, String label) {
        for (T value : values) {
            if (value.name().equals(name)) {
                return value;
            }
        }
        throw new IllegalArgumentException("No " + label + " input constant " + name);
    }
}
