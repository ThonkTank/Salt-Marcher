package src.domain.dungeon.model.map.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorAuthoredOperation;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
public final class ApplyDungeonAuthoredMutationUseCase {

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final @Nullable DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public ApplyDungeonAuthoredMutationUseCase(ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase) {
        this(applyDungeonEditorOperationUseCase, null);
    }

    public ApplyDungeonAuthoredMutationUseCase(
            ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase,
            @Nullable DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.applyDungeonEditorOperationUseCase =
                Objects.requireNonNull(applyDungeonEditorOperationUseCase, "applyDungeonEditorOperationUseCase");
        this.publishedStateRepository = publishedStateRepository;
    }

    public void execute(MutationInput input) {
        MutationInput safeInput = input == null ? MutationInput.applyNoop(1L) : input;
        ApplyDungeonEditorOperationUseCase.OperationResultData result = safeInput.action().previews()
                ? preview(safeInput.mapId(), mutation(safeInput.operation()))
                : apply(safeInput.mapId(), mutation(safeInput.operation()));
        publishMutation(result);
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData apply(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        return applyDungeonEditorOperationUseCase.execute(mapId, mutation(operation));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData apply(
            @Nullable DungeonMapIdentity mapId,
            ApplyDungeonEditorOperationUseCase.@Nullable Mutation operation
    ) {
        return applyDungeonEditorOperationUseCase.execute(mapId, operation);
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        return applyDungeonEditorOperationUseCase.preview(mapId, mutation(operation));
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            ApplyDungeonEditorOperationUseCase.@Nullable Mutation operation
    ) {
        return applyDungeonEditorOperationUseCase.preview(mapId, operation);
    }

    private void publishMutation(ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData result) {
        if (publishedStateRepository != null && result != null) {
            publishedStateRepository.publishMutation(new DungeonAuthoredPublishedStateRepository.MutationPublication(
                    snapshotPublication(result.snapshot()),
                    result.validationMessages(),
                    result.reactionMessages()));
        }
    }

    private static DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshotPublication(
            LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot
    ) {
        if (snapshot == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.SnapshotPublication(
                snapshot.mapName(),
                snapshot.derived(),
                snapshot.editorHandles(),
                snapshot.revision());
    }

    private static ApplyDungeonEditorOperationUseCase.@Nullable Mutation mutation(
            @Nullable DungeonEditorAuthoredOperation operation
    ) {
        if (operation == null) {
            return null;
        }
        return switch (operation.variant()) {
            case DungeonEditorAuthoredOperation.PaintRoomRectangle rectangle ->
                    current -> current.paintRoomRectangle(rectangle.start(), rectangle.end());
            case DungeonEditorAuthoredOperation.DeleteRoomRectangle rectangle ->
                    current -> current.deleteRoomRectangle(rectangle.start(), rectangle.end());
            case DungeonEditorAuthoredOperation.EditClusterBoundaries boundaries ->
                    current -> current.editClusterBoundaries(
                            boundaries.clusterId(),
                            boundaries.edges(),
                            boundaries.boundaryKind(),
                            boundaries.deleteMode());
            case DungeonEditorAuthoredOperation.CreateCorridor corridor ->
                    current -> current.createCorridor(corridor.start(), corridor.end());
            case DungeonEditorAuthoredOperation.DeleteCorridor corridor ->
                    current -> current.deleteCorridor(corridor.corridorId());
            case DungeonEditorAuthoredOperation.MoveEditorHandle move ->
                    current -> current.moveEditorHandle(
                            move.handle(),
                            move.deltaQ(),
                            move.deltaR(),
                            move.deltaLevel());
            case DungeonEditorAuthoredOperation.MoveBoundaryStretch stretch ->
                    current -> current.moveBoundaryStretch(
                            stretch.clusterId(),
                            stretch.sourceEdges(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorAuthoredOperation.SaveRoomNarration narration ->
                    current -> current.saveRoomNarration(narration.roomId(), narration.narration());
        };
    }

    private static ApplyDungeonEditorOperationUseCase.@Nullable Mutation mutation(OperationInput operation) {
        return switch (operation) {
            case null -> null;
            case NoopInput ignored -> null;
            case MoveTopologyElementInput move -> current -> current.moveTopologyElement(
                    move.ref().toModelRef(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case MoveEditorHandleInput move -> current -> current.moveEditorHandle(
                    move.handle().toModelHandle(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case MoveBoundaryStretchInput move -> current -> current.moveBoundaryStretch(
                    move.clusterId(),
                    move.modelSourceEdges(),
                    move.deltaQ(),
                    move.deltaR(),
                    move.deltaLevel());
            case MoveRoomAnchorInput move -> current -> current.moveRoomAnchor(move.deltaQ(), move.deltaR());
            case RoomRectangleInput rectangle -> rectangle.deletesRoomCells()
                    ? current -> current.deleteRoomRectangle(rectangle.start().toModelCell(), rectangle.end().toModelCell())
                    : current -> current.paintRoomRectangle(rectangle.start().toModelCell(), rectangle.end().toModelCell());
            case EditClusterBoundariesInput edit -> current -> current.editClusterBoundaries(
                    edit.clusterId(),
                    edit.modelEdges(),
                    DungeonClusterBoundaryKind.parse(edit.kindName()),
                    edit.deleteBoundary());
            case CreateCorridorInput create -> current -> current.createCorridor(
                    create.start().toCorridorEndpoint(),
                    create.end().toCorridorEndpoint());
            case ExtendCorridorInput extend -> current -> current.extendCorridor(
                    extend.corridorId(),
                    extend.endpoint().toCorridorRoomEndpoint());
            case MergeCorridorsInput merge ->
                    current -> current.mergeCorridors(merge.corridorId(), merge.mergedCorridorId());
            case DeleteCorridorInput delete -> current -> current.deleteCorridor(delete.corridorId());
            case SaveRoomNarrationInput narration -> current -> current.saveRoomNarration(
                    narration.roomId(),
                    narration.toRoomNarration());
        };
    }

    public record MutationInput(
            ActionInput action,
            long mapIdValue,
            OperationInput operation
    ) {
        public MutationInput {
            action = action == null ? ActionInput.APPLY : action;
            mapIdValue = mapIdValue <= 0L ? 1L : mapIdValue;
            operation = operation == null ? NoopInput.INSTANCE : operation;
        }

        public static MutationInput applyNoop(long mapIdValue) {
            return new MutationInput(ActionInput.APPLY, mapIdValue, NoopInput.INSTANCE);
        }

        DungeonMapIdentity mapId() {
            return new DungeonMapIdentity(mapIdValue);
        }
    }

    public static final class ActionInput {
        public static final ActionInput PREVIEW = new ActionInput(true);
        public static final ActionInput APPLY = new ActionInput(false);

        private final boolean previews;

        private ActionInput(boolean previews) {
            this.previews = previews;
        }

        boolean previews() {
            return previews;
        }
    }

    public sealed interface OperationInput permits
            NoopInput,
            MoveTopologyElementInput,
            MoveEditorHandleInput,
            MoveBoundaryStretchInput,
            MoveRoomAnchorInput,
            RoomRectangleInput,
            EditClusterBoundariesInput,
            CreateCorridorInput,
            ExtendCorridorInput,
            MergeCorridorsInput,
            DeleteCorridorInput,
            SaveRoomNarrationInput {
    }

    public static final class NoopInput implements OperationInput {
        public static final NoopInput INSTANCE = new NoopInput();

        private NoopInput() {
        }
    }

    public record MoveTopologyElementInput(
            RefreshDungeonAuthoredUseCase.TopologyRefInput ref,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements OperationInput {
        public MoveTopologyElementInput {
            ref = ref == null ? RefreshDungeonAuthoredUseCase.TopologyRefInput.empty() : ref;
        }
    }

    public record MoveEditorHandleInput(
            HandleInput handle,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements OperationInput {
        public MoveEditorHandleInput {
            handle = handle == null ? HandleInput.empty() : handle;
        }
    }

    public record MoveBoundaryStretchInput(
            long clusterId,
            List<EdgeInput> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) implements OperationInput {
        public MoveBoundaryStretchInput {
            clusterId = Math.max(0L, clusterId);
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
        }

        private List<DungeonEdge> modelSourceEdges() {
            return modelEdges(sourceEdges);
        }
    }

    public static final class MoveRoomAnchorInput implements OperationInput {
        private final int deltaQ;
        private final int deltaR;

        public MoveRoomAnchorInput(int deltaQ, int deltaR) {
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
        }

        int deltaQ() {
            return deltaQ;
        }

        int deltaR() {
            return deltaR;
        }
    }

    public record RoomRectangleInput(
            String actionName,
            CellInput start,
            CellInput end
    ) implements OperationInput {
        public RoomRectangleInput {
            actionName = actionName == null || actionName.isBlank() ? "PAINT" : actionName.trim();
            start = start == null ? CellInput.empty() : start;
            end = end == null ? start : end;
        }

        boolean deletesRoomCells() {
            return "DELETE".equals(actionName);
        }
    }

    public record EditClusterBoundariesInput(
            long clusterId,
            List<EdgeInput> edges,
            String kindName,
            boolean deleteBoundary
    ) implements OperationInput {
        public EditClusterBoundariesInput {
            clusterId = Math.max(0L, clusterId);
            edges = edges == null ? List.of() : List.copyOf(edges);
            kindName = kindName == null || kindName.isBlank() ? "WALL" : kindName.trim();
        }

        private List<DungeonEdge> modelEdges() {
            return ApplyDungeonAuthoredMutationUseCase.modelEdges(edges);
        }
    }

    public record CreateCorridorInput(
            CorridorEndpointInput start,
            CorridorEndpointInput end
    ) implements OperationInput {
        public CreateCorridorInput {
            start = start == null ? CorridorEndpointInput.emptyDoor() : start;
            end = end == null ? CorridorEndpointInput.emptyDoor() : end;
        }
    }

    public record ExtendCorridorInput(
            long corridorId,
            CorridorRoomEndpointInput endpoint
    ) implements OperationInput {
        public ExtendCorridorInput {
            corridorId = Math.max(0L, corridorId);
            endpoint = endpoint == null ? CorridorRoomEndpointInput.empty() : endpoint;
        }
    }

    public static final class MergeCorridorsInput implements OperationInput {
        private final long corridorId;
        private final long mergedCorridorId;

        public MergeCorridorsInput(long corridorId, long mergedCorridorId) {
            this.corridorId = Math.max(0L, corridorId);
            this.mergedCorridorId = Math.max(0L, mergedCorridorId);
        }

        long corridorId() {
            return corridorId;
        }

        long mergedCorridorId() {
            return mergedCorridorId;
        }
    }

    public static final class DeleteCorridorInput implements OperationInput {
        private final long corridorId;

        public DeleteCorridorInput(long corridorId) {
            this.corridorId = Math.max(0L, corridorId);
        }

        long corridorId() {
            return corridorId;
        }
    }

    public record SaveRoomNarrationInput(
            long roomId,
            String visualDescription,
            List<RoomExitNarrationInput> exits
    ) implements OperationInput {
        public SaveRoomNarrationInput {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        private DungeonRoomNarration toRoomNarration() {
            return new DungeonRoomNarration(
                    visualDescription,
                    roomExitDescriptions(exits));
        }
    }

    public record HandleInput(
            String kindName,
            RefreshDungeonAuthoredUseCase.TopologyRefInput topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            CellInput cell,
            String direction
    ) {
        public HandleInput {
            kindName = kindName == null || kindName.isBlank() ? "CLUSTER_LABEL" : kindName.trim();
            topologyRef = topologyRef == null ? RefreshDungeonAuthoredUseCase.TopologyRefInput.empty() : topologyRef;
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
                    RefreshDungeonAuthoredUseCase.TopologyRefInput.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    CellInput.empty(),
                    "");
        }

        private DungeonEditorHandle toModelHandle() {
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.valueOf(kindName),
                    topologyRef.toModelRef(),
                    ownerId,
                    clusterId,
                    corridorId,
                    roomId,
                    index,
                    cell.toModelCell(),
                    ApplyDungeonAuthoredMutationUseCase.direction(direction));
        }
    }

    public static final class CorridorEndpointKindInput {
        public static final CorridorEndpointKindInput DOOR = new CorridorEndpointKindInput("DOOR");
        public static final CorridorEndpointKindInput ANCHOR = new CorridorEndpointKindInput("ANCHOR");

        private final String name;

        private CorridorEndpointKindInput(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }
    }

    public record CorridorEndpointInput(
            CorridorEndpointKindInput kind,
            long hostCorridorId,
            long roomId,
            long clusterId,
            boolean fixedDoor,
            CellInput cell,
            String direction,
            RefreshDungeonAuthoredUseCase.TopologyRefInput topologyRef
    ) {
        public CorridorEndpointInput {
            kind = kind == null ? CorridorEndpointKindInput.DOOR : kind;
            hostCorridorId = Math.max(0L, hostCorridorId);
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            cell = cell == null ? CellInput.empty() : cell;
            direction = direction == null ? "" : direction.trim();
            topologyRef = topologyRef == null ? RefreshDungeonAuthoredUseCase.TopologyRefInput.empty() : topologyRef;
        }

        public static CorridorEndpointInput emptyDoor() {
            return new CorridorEndpointInput(
                    CorridorEndpointKindInput.DOOR,
                    0L,
                    0L,
                    0L,
                    false,
                    CellInput.empty(),
                    "",
                    RefreshDungeonAuthoredUseCase.TopologyRefInput.empty());
        }

        private DungeonCorridorEndpoint toCorridorEndpoint() {
            if (kind == CorridorEndpointKindInput.ANCHOR) {
                return DungeonCorridorEndpoint.anchor(hostCorridorId, cell.toModelCell(), topologyRef.toModelRef());
            }
            return DungeonCorridorEndpoint.door(
                    roomId,
                    clusterId,
                    cell.toModelCell(),
                    ApplyDungeonAuthoredMutationUseCase.direction(direction),
                    topologyRef.toModelRef());
        }
    }

    public record CorridorRoomEndpointInput(
            long roomId,
            long clusterId,
            boolean fixedDoor,
            CellInput cell,
            String direction,
            RefreshDungeonAuthoredUseCase.TopologyRefInput topologyRef
    ) {
        public CorridorRoomEndpointInput {
            roomId = Math.max(0L, roomId);
            clusterId = Math.max(0L, clusterId);
            cell = cell == null ? CellInput.empty() : cell;
            direction = direction == null ? "" : direction.trim();
            topologyRef = topologyRef == null ? RefreshDungeonAuthoredUseCase.TopologyRefInput.empty() : topologyRef;
        }

        public static CorridorRoomEndpointInput empty() {
            return new CorridorRoomEndpointInput(
                    0L,
                    0L,
                    false,
                    CellInput.empty(),
                    "",
                    RefreshDungeonAuthoredUseCase.TopologyRefInput.empty());
        }

        private DungeonCorridorRoomEndpoint toCorridorRoomEndpoint() {
            return new DungeonCorridorRoomEndpoint(
                    roomId,
                    clusterId,
                    fixedDoor,
                    cell.toModelCell(),
                    ApplyDungeonAuthoredMutationUseCase.direction(direction),
                    topologyRef.toModelRef());
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

        private DungeonCell toModelCell() {
            return new DungeonCell(q, r, level);
        }
    }

    public record EdgeInput(CellInput from, CellInput to) {
        public EdgeInput {
            from = from == null ? CellInput.empty() : from;
            to = to == null ? CellInput.empty() : to;
        }

        private DungeonEdge toModelEdge() {
            return new DungeonEdge(from.toModelCell(), to.toModelCell());
        }
    }

    public record RoomExitNarrationInput(
            CellInput cell,
            String directionName,
            String description
    ) {
        public RoomExitNarrationInput {
            cell = cell == null ? CellInput.empty() : cell;
            directionName = directionName == null ? "" : directionName.trim();
            description = description == null ? "" : description;
        }

        private DungeonRoomExitDescription toRoomExitDescription() {
            return new DungeonRoomExitDescription(cell.toModelCell(), direction(directionName), description);
        }
    }

    private static DungeonEdgeDirection direction(String directionName) {
        return directionName == null || directionName.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(directionName);
    }

    private static List<DungeonEdge> modelEdges(List<EdgeInput> edges) {
        List<DungeonEdge> result = new ArrayList<>();
        for (EdgeInput edge : edges == null ? List.<EdgeInput>of() : edges) {
            result.add(edge.toModelEdge());
        }
        return List.copyOf(result);
    }

    private static List<DungeonRoomExitDescription> roomExitDescriptions(List<RoomExitNarrationInput> exits) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (RoomExitNarrationInput exit : exits == null ? List.<RoomExitNarrationInput>of() : exits) {
            result.add(exit.toRoomExitDescription());
        }
        return List.copyOf(result);
    }
}
