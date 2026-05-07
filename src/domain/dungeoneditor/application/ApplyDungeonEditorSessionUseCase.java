package src.domain.dungeoneditor.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class ApplyDungeonEditorSessionUseCase {
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final DungeonEditorSessionCommandWorkflow commandWorkflow;
    private DungeonEditorSession session = DungeonEditorSession.empty();

    public ApplyDungeonEditorSessionUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(catalog, mutateAuthored, loadAuthored);
        this.commandWorkflow = new DungeonEditorSessionCommandWorkflow(catalog, mutateAuthored, snapshotBuilder);
    }

    public void primeSelectedMap(@Nullable DungeonMapId mapId) {
        if (mapId != null) {
            session = session.primeSelectedMap(mapId.value());
        }
    }

    public void apply(@Nullable DungeonEditorSessionCommand command) {
        session = commandWorkflow.apply(session, command);
    }

    public DungeonEditorSessionSnapshot.SnapshotData snapshot() {
        DungeonEditorSessionSnapshot.SnapshotData snapshot = snapshotBuilder.execute(session);
        session = session.withSelectedMap(snapshot.selectedMapId())
                .withProjectionLevel(snapshot.projectionLevel());
        return snapshot;
    }

    static DungeonMapId requireMutationMapId(@Nullable DungeonMapCatalogResponse response) {
        if (response instanceof DungeonMapCatalogResponse.MapMutation mutation) {
            return mutation.mapId();
        }
        throw new IllegalStateException("Dungeon-Katalog-Antwort enthielt keine Mutation.");
    }

    static @Nullable DungeonOperationResult requireOperationResult(@Nullable DungeonAuthoredMutationResult result) {
        if (result instanceof DungeonAuthoredMutationResult.Operation operation) {
            return operation.result();
        }
        return null;
    }

    static DungeonMapId requireMapId(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        DungeonMapId domainMapId = DungeonEditorWorkspaceMapBoundaryTranslator.toDomainMapId(mapId);
        if (domainMapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return domainMapId;
    }

    static String statusFromMessages(@Nullable DungeonOperationResult result) {
        if (result == null) {
            return "";
        }
        if (!result.reactionMessages().isEmpty()) {
            return result.reactionMessages().getFirst();
        }
        if (!result.validationMessages().isEmpty()) {
            return result.validationMessages().getFirst();
        }
        return "";
    }
}

final class DungeonEditorSessionCommandWorkflow {
    private final DungeonEditorSessionCatalogWorkflow catalogWorkflow;
    private final DungeonEditorSessionInteractionWorkflow interactionWorkflow;

    DungeonEditorSessionCommandWorkflow(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.interactionWorkflow = new DungeonEditorSessionInteractionWorkflow(mutateAuthored, snapshotBuilder);
        this.catalogWorkflow = new DungeonEditorSessionCatalogWorkflow(catalog, interactionWorkflow);
    }

    DungeonEditorSession apply(DungeonEditorSession session, @Nullable DungeonEditorSessionCommand command) {
        if (command == null) {
            return session;
        }
        return command.action().isCatalogAction()
                ? catalogWorkflow.apply(session, command)
                : interactionWorkflow.apply(session, command);
    }
}

final class DungeonEditorSessionCatalogWorkflow {
    private final Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog;
    private final DungeonEditorSessionInteractionWorkflow interactionWorkflow;

    DungeonEditorSessionCatalogWorkflow(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            DungeonEditorSessionInteractionWorkflow interactionWorkflow
    ) {
        this.catalog = catalog;
        this.interactionWorkflow = interactionWorkflow;
    }

    DungeonEditorSession apply(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        return switch (command.action()) {
            case SELECT_MAP -> selectMap(session, command);
            case CREATE_MAP, RENAME_MAP, DELETE_MAP -> applyCatalogMutation(session, command);
            case SET_VIEW_MODE, SET_TOOL, SHIFT_PROJECTION_LEVEL, SET_OVERLAY -> applySessionSetting(session, command);
            case INTERPRET_MAIN_VIEW, SAVE_ROOM_NARRATION -> session;
        };
    }

    private DungeonEditorSession selectMap(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        return clearTransientState(session.withSelectedMap(command.mapId()).clearSelection(), "");
    }

    private DungeonEditorSession applyCatalogMutation(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        return switch (command.action()) {
            case CREATE_MAP -> createSelectedMap(session, command);
            case RENAME_MAP -> renameSelectedMap(session, command);
            case DELETE_MAP -> deleteSelectedMap(session, command);
            case SELECT_MAP,
                    SET_VIEW_MODE,
                    SET_TOOL,
                    SHIFT_PROJECTION_LEVEL,
                    SET_OVERLAY,
                    INTERPRET_MAIN_VIEW,
                    SAVE_ROOM_NARRATION -> session;
        };
    }

    private DungeonEditorSession applySessionSetting(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        return switch (command.action()) {
            case SET_VIEW_MODE -> clearTransientState(session.withViewMode(command.viewMode()), "");
            case SET_TOOL -> clearTransientState(session.withSelectedTool(command.selectedTool()), "");
            case SHIFT_PROJECTION_LEVEL -> session.shiftProjectionLevel(command.projectionLevelDelta()).withStatusText("");
            case SET_OVERLAY -> session.withOverlaySettings(command.overlaySettings()).withStatusText("");
            case SELECT_MAP,
                    CREATE_MAP,
                    RENAME_MAP,
                    DELETE_MAP,
                    INTERPRET_MAIN_VIEW,
                    SAVE_ROOM_NARRATION -> session;
        };
    }

    private DungeonEditorSession createSelectedMap(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        DungeonEditorWorkspaceValues.MapId createdMapId = DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapId(
                ApplyDungeonEditorSessionUseCase.requireMutationMapId(
                        catalog.apply(new DungeonMapCatalogCommand.CreateMap(command.mapName()))));
        return clearTransientState(session.withSelectedMap(createdMapId).clearSelection(), "Dungeon-Map erstellt.");
    }

    private DungeonEditorSession renameSelectedMap(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        DungeonEditorWorkspaceValues.MapId renamedMapId = DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapId(
                ApplyDungeonEditorSessionUseCase.requireMutationMapId(
                        catalog.apply(new DungeonMapCatalogCommand.RenameMap(
                        ApplyDungeonEditorSessionUseCase.requireMapId(command.mapId()),
                        command.mapName()))));
        return session.withSelectedMap(renamedMapId).withStatusText("Dungeon-Map umbenannt.");
    }

    private DungeonEditorSession deleteSelectedMap(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        DungeonEditorWorkspaceValues.MapId deletedMapId = DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapId(
                ApplyDungeonEditorSessionUseCase.requireMutationMapId(
                        catalog.apply(new DungeonMapCatalogCommand.DeleteMap(
                                ApplyDungeonEditorSessionUseCase.requireMapId(command.mapId())))));
        DungeonEditorSession nextSession = deletedMapId != null && deletedMapId.equals(session.selectedMapId())
                ? session.withSelectedMap(null)
                : session;
        return clearTransientState(nextSession.clearSelection(), "Dungeon-Map gelöscht.");
    }

    private DungeonEditorSession clearTransientState(DungeonEditorSession session, String nextStatusText) {
        interactionWorkflow.clear();
        return session.clearTransientState(nextStatusText);
    }
}

final class DungeonEditorSessionInteractionWorkflow {
    private final Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter = new InterpretDungeonEditorMainViewInputUseCase();

    DungeonEditorSessionInteractionWorkflow(
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.mutateAuthored = mutateAuthored;
        this.snapshotBuilder = snapshotBuilder;
    }

    DungeonEditorSession apply(DungeonEditorSession session, DungeonEditorSessionCommand command) {
        if (command.action() == DungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW) {
            return applyMainViewInput(session, command.mainViewInput());
        }
        if (command.action() == DungeonEditorSessionCommand.Action.SAVE_ROOM_NARRATION) {
            return applyRoomNarration(session, command.roomNarration());
        }
        return session;
    }

    void clear() {
        mainViewInterpreter.clear();
    }

    private DungeonEditorSession applyRoomNarration(
            DungeonEditorSession session,
            DungeonEditorSessionCommand.RoomNarrationInput roomNarration
    ) {
        if (roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            return session;
        }
        DungeonOperationResult result = ApplyDungeonEditorSessionUseCase.requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.ApplyOperation(
                        ApplyDungeonEditorSessionUseCase.requireMapId(session.selectedMapId()),
                        new DungeonEditorOperation.SaveRoomNarration(
                                roomNarration.roomId(),
                                roomNarration.visualDescription(),
                                roomNarration.exits().stream()
                                        .map(DungeonEditorWorkspaceInspectorBoundaryTranslator::toDomainRoomExit)
                                        .toList()))));
        return session.clearPreview().withStatusText(ApplyDungeonEditorSessionUseCase.statusFromMessages(result));
    }

    private DungeonEditorSession applyMainViewInput(
            DungeonEditorSession session,
            DungeonEditorSessionCommand.MainViewInput mainViewInput
    ) {
        DungeonEditorSessionCommand.MainViewInput input = mainViewInput == null
                ? DungeonEditorSessionCommand.MainViewInput.empty()
                : mainViewInput;
        DungeonEditorWorkspaceValues.MapSnapshot committedSnapshot =
                snapshotBuilder.loadCommittedSnapshot(session.selectedMapId());
        if (input.isLevelScrolled()) {
            return consumeEffect(session, mainViewInterpreter.consume(
                    input,
                    committedSnapshot,
                    session.selection(),
                    session.selectedTool(),
                    session.viewMode(),
                    session.projectionLevel()));
        }
        if (!session.hasSelectedMap() || committedSnapshot == null || !session.viewMode().isGrid()) {
            return session;
        }
        return consumeEffect(session, mainViewInterpreter.consume(
                input,
                committedSnapshot,
                session.selection(),
                session.selectedTool(),
                session.viewMode(),
                session.projectionLevel()));
    }

    private DungeonEditorSession consumeEffect(DungeonEditorSession session, @Nullable DungeonEditorMainViewEffect effect) {
        if (effect == null) {
            return session;
        }
        DungeonEditorSession nextSession = session;
        if (effect.projectionLevelDelta() != 0) {
            nextSession = nextSession.shiftProjectionLevel(effect.projectionLevelDelta());
        }
        if (effect.statusText() != null) {
            nextSession = nextSession.withStatusText(effect.statusText());
        }
        if (effect.clearSelection()) {
            nextSession = nextSession.clearSelection().clearPreview();
        } else if (effect.selection() != null) {
            nextSession = nextSession.withSelection(effect.selection()).clearPreview();
        }
        if (effect.clearPreview()) {
            nextSession = nextSession.clearPreview();
        } else if (effect.preview() != null) {
            nextSession = nextSession.withPreview(effect.preview()).withStatusText("");
        }
        if (effect.applyPreview() == null) {
            return nextSession;
        }
        DungeonOperationResult result = ApplyDungeonEditorSessionUseCase.requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.ApplyOperation(
                        ApplyDungeonEditorSessionUseCase.requireMapId(nextSession.selectedMapId()),
                        DungeonEditorSessionBridge.toDungeonOperation(effect.applyPreview()))));
        return nextSession.clearPreview().withStatusText(ApplyDungeonEditorSessionUseCase.statusFromMessages(result));
    }
}

final class DungeonEditorSessionBridge {

    private DungeonEditorSessionBridge() {
    }

    static @Nullable DungeonEditorOperation toDungeonOperation(DungeonEditorSessionValues.Preview preview) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return null;
        }
        DungeonEditorOperation operation = roomRectangleOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = boundaryOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = corridorCreateOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = corridorDeleteOperation(preview);
        if (operation != null) {
            return operation;
        }
        operation = moveHandleOperation(preview);
        if (operation != null) {
            return operation;
        }
        return moveBoundaryStretchOperation(preview);
    }

    private static @Nullable DungeonEditorOperation roomRectangleOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room)) {
            return null;
        }
        return room.deleteMode()
                ? new DungeonEditorOperation.DeleteRoomRectangle(
                        DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(room.start()),
                        DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(room.end()))
                : new DungeonEditorOperation.PaintRoomRectangle(
                        DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(room.start()),
                        DungeonEditorWorkspaceCellBoundaryTranslator.toDomainCell(room.end()));
    }

    private static @Nullable DungeonEditorOperation boundaryOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries)) {
            return null;
        }
        return new DungeonEditorOperation.EditClusterBoundaries(
                boundaries.clusterId(),
                boundaries.edges().stream()
                        .map(DungeonEditorWorkspaceCellBoundaryTranslator::toDomainEdge)
                        .toList(),
                DungeonEditorWorkspaceTopologyBoundaryTranslator.toDomainBoundaryKind(boundaries.boundaryKind()),
                boundaries.deleteMode());
    }

    private static @Nullable DungeonEditorOperation corridorCreateOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor)) {
            return null;
        }
        return new DungeonEditorOperation.CreateCorridor(
                DungeonEditorWorkspaceOperationBoundaryTranslator.toDomainCorridorEndpoint(corridor.start()),
                DungeonEditorWorkspaceOperationBoundaryTranslator.toDomainCorridorEndpoint(corridor.end()));
    }

    private static @Nullable DungeonEditorOperation corridorDeleteOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.CorridorDeletePreview corridor)) {
            return null;
        }
        return new DungeonEditorOperation.DeleteCorridor(corridor.corridorId());
    }

    private static @Nullable DungeonEditorOperation moveHandleOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle)) {
            return null;
        }
        return new DungeonEditorOperation.MoveEditorHandle(
                DungeonEditorWorkspaceHandleBoundaryTranslator.toDomainHandleRef(moveHandle.handleRef()),
                moveHandle.deltaQ(),
                moveHandle.deltaR(),
                moveHandle.deltaLevel());
    }

    private static @Nullable DungeonEditorOperation moveBoundaryStretchOperation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (!(preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch)) {
            return null;
        }
        return new DungeonEditorOperation.MoveBoundaryStretch(
                stretch.clusterId(),
                stretch.sourceEdges().stream()
                        .map(DungeonEditorWorkspaceCellBoundaryTranslator::toDomainEdge)
                        .toList(),
                stretch.deltaQ(),
                stretch.deltaR(),
                stretch.deltaLevel());
    }
}
