package src.domain.dungeoneditor.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;

public final class ApplyDungeonEditorSessionUseCase {

    private final Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog;
    private final Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
            new InterpretDungeonEditorMainViewInputUseCase();
    private DungeonEditorSession session = DungeonEditorSession.empty();

    public ApplyDungeonEditorSessionUseCase(
            Function<DungeonMapCatalogCommand, DungeonMapCatalogResponse> catalog,
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadQuery, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.catalog = catalog;
        this.mutateAuthored = mutateAuthored;
        this.snapshotBuilder = new BuildDungeonEditorSnapshotUseCase(catalog, mutateAuthored, loadAuthored);
    }

    public void primeSelectedMap(@Nullable DungeonMapId mapId) {
        if (mapId != null) {
            session = session.primeSelectedMap(mapId.value());
        }
    }

    public void apply(@Nullable DungeonEditorSessionCommand command) {
        if (command == null) {
            return;
        }
        DungeonEditorSessionCommand.Action action = command.action();
        if (action == DungeonEditorSessionCommand.Action.SELECT_MAP) {
            selectMap(command);
        } else if (action == DungeonEditorSessionCommand.Action.CREATE_MAP) {
            createSelectedMap(command);
        } else if (action == DungeonEditorSessionCommand.Action.RENAME_MAP) {
            renameSelectedMap(command);
        } else if (action == DungeonEditorSessionCommand.Action.DELETE_MAP) {
            deleteSelectedMap(command);
        } else if (action == DungeonEditorSessionCommand.Action.SET_VIEW_MODE) {
            setViewMode(command);
        } else if (action == DungeonEditorSessionCommand.Action.SET_TOOL) {
            setTool(command);
        } else if (action == DungeonEditorSessionCommand.Action.SHIFT_PROJECTION_LEVEL) {
            shiftProjectionLevel(command);
        } else if (action == DungeonEditorSessionCommand.Action.SET_OVERLAY) {
            setOverlay(command);
        } else if (action == DungeonEditorSessionCommand.Action.INTERPRET_MAIN_VIEW) {
            applyMainViewInput(command.mainViewInput());
        } else if (action == DungeonEditorSessionCommand.Action.SAVE_ROOM_NARRATION) {
            applyRoomNarration(command.roomNarration());
        }
    }

    public DungeonEditorSessionSnapshot.SnapshotData snapshot() {
        DungeonEditorSessionSnapshot.SnapshotData snapshot = snapshotBuilder.execute(new BuildDungeonEditorSnapshotUseCase.State(
                session.selectedMapId(),
                session.viewMode(),
                session.selectedTool(),
                session.projectionLevel(),
                session.overlaySettings(),
                session.selection(),
                session.preview(),
                session.statusText()));
        session = session.withSelectedMap(snapshot.selectedMapId())
                .withProjectionLevel(snapshot.projectionLevel());
        return snapshot;
    }

    private void clearTransientState(String nextStatusText) {
        session = session.clearTransientState(nextStatusText);
        mainViewInterpreter.clear();
    }

    private void selectMap(DungeonEditorSessionCommand command) {
        session = session.withSelectedMap(command.mapId()).clearSelection();
        clearTransientState("");
    }

    private void createSelectedMap(DungeonEditorSessionCommand command) {
        session = session.withSelectedMap(requireMutationMapId(
                catalog.apply(new DungeonMapCatalogCommand.CreateMap(command.mapName()))))
                .clearSelection();
        clearTransientState("Dungeon-Map erstellt.");
    }

    private void renameSelectedMap(DungeonEditorSessionCommand command) {
        session = session.withSelectedMap(requireMutationMapId(catalog.apply(
                new DungeonMapCatalogCommand.RenameMap(
                        requireMapId(command.mapId()),
                        command.mapName()))))
                .withStatusText("Dungeon-Map umbenannt.");
    }

    private void deleteSelectedMap(DungeonEditorSessionCommand command) {
        DungeonMapId deletedMapId = requireMutationMapId(catalog.apply(
                new DungeonMapCatalogCommand.DeleteMap(requireMapId(command.mapId()))));
        if (deletedMapId != null && deletedMapId.equals(session.selectedMapId())) {
            session = session.withSelectedMap(null);
        }
        session = session.clearSelection();
        clearTransientState("Dungeon-Map gelöscht.");
    }

    private void setViewMode(DungeonEditorSessionCommand command) {
        session = session.withViewMode(command.viewMode());
        clearTransientState("");
    }

    private void setTool(DungeonEditorSessionCommand command) {
        session = session.withSelectedTool(command.selectedTool());
        clearTransientState("");
    }

    private void shiftProjectionLevel(DungeonEditorSessionCommand command) {
        session = session.shiftProjectionLevel(command.projectionLevelDelta()).withStatusText("");
    }

    private void setOverlay(DungeonEditorSessionCommand command) {
        session = session.withOverlaySettings(command.overlaySettings()).withStatusText("");
    }

    private void applyRoomNarration(DungeonEditorSessionCommand.RoomNarrationInput roomNarration) {
        if (roomNarration == null || roomNarration.roomId() <= 0L) {
            return;
        }
        DungeonOperationResult result = requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.ApplyOperation(
                        requireMapId(session.selectedMapId()),
                        new DungeonEditorOperation.SaveRoomNarration(
                                roomNarration.roomId(),
                                roomNarration.visualDescription(),
                                roomNarration.exits()))));
        session = session.clearPreview().withStatusText(statusFromMessages(result));
    }

    private void applyMainViewInput(DungeonEditorSessionCommand.MainViewInput mainViewInput) {
        DungeonEditorSessionCommand.MainViewInput input = mainViewInput == null
                ? DungeonEditorSessionCommand.MainViewInput.empty()
                : mainViewInput;
        DungeonSnapshot committedSnapshot = snapshotBuilder.loadCommittedSnapshot(session.selectedMapId());
        if (input.source() == DungeonEditorSessionCommand.MainViewInputSource.LEVEL_SCROLLED) {
            applyInteractionEffect(mainViewInterpreter.consume(
                    input,
                    committedSnapshot,
                    session.selection(),
                    session.selectedTool(),
                    session.viewMode(),
                    session.projectionLevel()));
            return;
        }
        if (!session.hasSelectedMap()
                || committedSnapshot == null
                || session.viewMode() != DungeonEditorSessionValues.ViewMode.GRID) {
            return;
        }
        applyInteractionEffect(mainViewInterpreter.consume(
                input,
                committedSnapshot,
                session.selection(),
                session.selectedTool(),
                session.viewMode(),
                session.projectionLevel()));
    }

    private void applyInteractionEffect(InterpretDungeonEditorMainViewInputUseCase.Effect effect) {
        if (effect == null) {
            return;
        }
        if (effect.projectionLevelDelta() != 0) {
            session = session.shiftProjectionLevel(effect.projectionLevelDelta());
        }
        if (effect.statusText() != null) {
            session = session.withStatusText(effect.statusText());
        }
        if (effect.clearSelection()) {
            session = session.clearSelection().clearPreview();
        } else if (effect.selection() != null) {
            session = session.withSelection(effect.selection()).clearPreview();
        }
        if (effect.clearPreview()) {
            session = session.clearPreview();
        } else if (effect.preview() != null) {
            session = session.withPreview(effect.preview()).withStatusText("");
        }
        if (effect.applyOperation() != null) {
            DungeonOperationResult result = requireOperationResult(mutateAuthored.apply(
                    new DungeonAuthoredMutationCommand.ApplyOperation(
                            requireMapId(session.selectedMapId()),
                            effect.applyOperation())));
            session = session.clearPreview().withStatusText(statusFromMessages(result));
        }
    }

    private static DungeonMapId requireMutationMapId(@Nullable DungeonMapCatalogResponse response) {
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

    private static DungeonMapId requireMapId(@Nullable DungeonMapId mapId) {
        if (mapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return mapId;
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

final class DungeonEditorSessionBridge {

    private DungeonEditorSessionBridge() {
    }

    static @Nullable DungeonEditorOperation toDungeonOperation(DungeonEditorSessionValues.Preview preview) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return null;
        }
        if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
            return room.deleteMode()
                    ? new DungeonEditorOperation.DeleteRoomRectangle(room.start(), room.end())
                    : new DungeonEditorOperation.PaintRoomRectangle(room.start(), room.end());
        }
        if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries) {
            return new DungeonEditorOperation.EditClusterBoundaries(
                    boundaries.clusterId(),
                    boundaries.edges(),
                    boundaries.boundaryKind(),
                    boundaries.deleteMode());
        }
        if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
            return new DungeonEditorOperation.CreateCorridor(corridor.start(), corridor.end());
        }
        if (preview instanceof DungeonEditorSessionValues.CorridorDeletePreview corridor) {
            return new DungeonEditorOperation.DeleteCorridor(corridor.corridorId());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle) {
            return new DungeonEditorOperation.MoveEditorHandle(
                    moveHandle.handleRef(),
                    moveHandle.deltaQ(),
                    moveHandle.deltaR(),
                    moveHandle.deltaLevel());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
            return new DungeonEditorOperation.MoveBoundaryStretch(
                    stretch.clusterId(),
                    stretch.sourceEdges(),
                    stretch.deltaQ(),
                    stretch.deltaR(),
                    stretch.deltaLevel());
        }
        return null;
    }
}
