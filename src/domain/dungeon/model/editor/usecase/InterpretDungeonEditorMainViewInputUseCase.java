package src.domain.dungeon.model.editor.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorMainViewInputBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class InterpretDungeonEditorMainViewInputUseCase {
    private final DungeonEditorMainViewInputBoundaryTranslationHelper inputTranslator =
            new DungeonEditorMainViewInputBoundaryTranslationHelper();
    private final InterpretDungeonEditorMainViewPressUseCase pressUseCase =
            new InterpretDungeonEditorMainViewPressUseCase();
    private final InterpretDungeonEditorMainViewDragUseCase dragUseCase =
            new InterpretDungeonEditorMainViewDragUseCase();
    private final InterpretDungeonEditorMainViewReleaseUseCase releaseUseCase =
            new InterpretDungeonEditorMainViewReleaseUseCase();
    private final InterpretDungeonEditorMainViewHoverUseCase hoverUseCase =
            new InterpretDungeonEditorMainViewHoverUseCase();
    private final InterpretDungeonEditorMainViewScrollUseCase scrollUseCase =
            new InterpretDungeonEditorMainViewScrollUseCase();

    private final InteractionStateHolder state = new InteractionStateHolder();

    public DungeonEditorMainViewEffect pressSelection(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretSelection(pointer(input, projectionLevel), snapshot, selection, state.current()));
    }

    public DungeonEditorMainViewEffect dragSelection(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(dragUseCase.interpretSelection(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect releaseSelection(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(releaseUseCase.interpretSelection(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect hoverSelection() {
        return hoverUseCase.interpretSelection(state.current());
    }

    public DungeonEditorMainViewEffect scrollSelection(
            int levelDelta,
            int projectionLevel,
            @Nullable MapSnapshot snapshot
    ) {
        return apply(scrollUseCase.interpretSelection(levelDelta, projectionLevel, snapshot, state.current()));
    }

    public DungeonEditorMainViewEffect pressRoom(
            MainViewInput input,
            DungeonEditorSessionValues.Tool roomTool,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretRoom(pointer(input, projectionLevel), roomTool, state.current()));
    }

    public DungeonEditorMainViewEffect dragRoom(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(dragUseCase.interpretRoom(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect releaseRoom(
            MainViewInput input,
            int projectionLevel
    ) {
        return apply(releaseUseCase.interpretRoom(pointer(input, projectionLevel), state.current()));
    }

    public DungeonEditorMainViewEffect pressBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretBoundary(
                pointer(input, projectionLevel),
                snapshot,
                selection,
                boundaryTool,
                state.current()));
    }

    public DungeonEditorMainViewEffect dragBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return apply(dragUseCase.interpretBoundary(pointer(input, projectionLevel), snapshot, boundaryTool, state.current()));
    }

    public DungeonEditorMainViewEffect releaseBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return apply(releaseUseCase.interpretBoundary(pointer(input, projectionLevel), snapshot, boundaryTool, state.current()));
    }

    public DungeonEditorMainViewEffect hoverBoundary(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool,
            int projectionLevel
    ) {
        return hoverUseCase.interpretBoundary(pointer(input, projectionLevel), snapshot, boundaryTool, state.current());
    }

    public DungeonEditorMainViewEffect pressCorridor(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool,
            int projectionLevel
    ) {
        return apply(pressUseCase.interpretCorridor(pointer(input, projectionLevel), snapshot, corridorTool, state.current()));
    }

    public DungeonEditorMainViewEffect hoverCorridor(
            MainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool,
            int projectionLevel
    ) {
        return hoverUseCase.interpretCorridor(pointer(input, projectionLevel), snapshot, corridorTool, state.current());
    }

    public void clear() {
        state.replace(state.current().clear());
    }

    private DungeonEditorMainViewEffect apply(DungeonEditorMainViewInterpretation interpretation) {
        state.replace(interpretation.nextState());
        return interpretation.effect();
    }

    private PointerState pointer(MainViewInput input, int projectionLevel) {
        DungeonEditorMainViewInput safeInput = input == null
                ? DungeonEditorMainViewInput.empty()
                : input.mainViewInput();
        return inputTranslator.resolvePointerState(
                safeInput.canvasX(),
                safeInput.canvasY(),
                projectionLevel,
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.target());
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
            String targetKind,
            String elementKind,
            long ownerId,
            long clusterId,
            TopologyRefInput topologyRef,
            HandleInput handleRef,
            BoundaryInput boundaryRef
    ) {
        public PointerTargetInput {
            targetKind = defaultName(targetKind, "EMPTY");
            elementKind = defaultName(elementKind, "EMPTY");
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRef = topologyRef == null ? TopologyRefInput.empty() : topologyRef;
            handleRef = handleRef == null ? HandleInput.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryInput.empty() : boundaryRef;
        }

        public static PointerTargetInput empty() {
            return new PointerTargetInput(
                    "EMPTY",
                    "EMPTY",
                    0L,
                    0L,
                    TopologyRefInput.empty(),
                    HandleInput.empty(),
                    BoundaryInput.empty());
        }

        private DungeonEditorMainViewPointerTarget pointerTarget() {
            return switch (targetKind) {
                case "EMPTY" -> DungeonEditorMainViewPointerTarget.empty();
                case "CELL" -> DungeonEditorMainViewPointerTarget.cell(
                        topologyKind(elementKind),
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
                case "LABEL" -> DungeonEditorMainViewPointerTarget.label(
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
                case "GRAPH_NODE" -> DungeonEditorMainViewPointerTarget.graphNode(
                        ownerId,
                        clusterId,
                        topologyRef.topologyRef());
                case "HANDLE" -> DungeonEditorMainViewPointerTarget.handle(handleRef.handleRef());
                case "BOUNDARY" -> DungeonEditorMainViewPointerTarget.boundary(
                        boundaryKind(boundaryRef.kind()),
                        boundaryRef.key(),
                        boundaryRef.ownerId(),
                        boundaryRef.topologyRef().topologyRef(),
                        boundaryRef.start().cell(),
                        boundaryRef.end().cell());
                default -> throw new IllegalArgumentException("Unsupported dungeon editor pointer target: " + targetKind);
            };
        }
    }

    public record TopologyRefInput(String kind, long id) {
        public TopologyRefInput {
            kind = defaultName(kind, "EMPTY");
            id = Math.max(0L, id);
        }

        public static TopologyRefInput empty() {
            return new TopologyRefInput("EMPTY", 0L);
        }

        private DungeonTopologyRef topologyRef() {
            return new DungeonTopologyRef(topologyKind(kind), id);
        }
    }

    public record HandleInput(
            String kind,
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
            kind = defaultName(kind, "CLUSTER_LABEL");
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
                    "CLUSTER_LABEL",
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
                    DungeonEditorHandleType.valueOf(kind),
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
            String kind,
            String key,
            long ownerId,
            TopologyRefInput topologyRef,
            CellInput start,
            CellInput end
    ) {
        public BoundaryInput {
            kind = defaultName(kind, "WALL");
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            topologyRef = topologyRef == null ? TopologyRefInput.empty() : topologyRef;
            start = start == null ? CellInput.empty() : start;
            end = end == null ? CellInput.empty() : end;
        }

        public static BoundaryInput empty() {
            return new BoundaryInput(
                    "WALL",
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

    private static DungeonTopologyElementKind topologyKind(String name) {
        return DungeonTopologyElementKind.valueOf(defaultName(name, "EMPTY"));
    }

    private static DungeonEditorWorkspaceValues.BoundaryKind boundaryKind(String name) {
        return DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(defaultName(name, "WALL"));
    }

    private static String defaultName(String name, String defaultName) {
        return name == null || name.isBlank() ? defaultName : name.trim();
    }

    private static final class InteractionStateHolder {
        private InteractionState current = InteractionState.empty();

        private InteractionState current() {
            return current;
        }

        private void replace(InteractionState next) {
            current = next;
        }
    }
}
