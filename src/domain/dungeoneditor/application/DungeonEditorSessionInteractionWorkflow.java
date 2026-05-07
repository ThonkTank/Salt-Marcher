package src.domain.dungeoneditor.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.session.entity.DungeonEditorSession;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

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
        if (command.action().isMainViewInputAction()) {
            return applyMainViewInput(session, command.mainViewInput());
        }
        if (command.action().isRoomNarrationAction()) {
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
