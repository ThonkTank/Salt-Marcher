package src.domain.dungeoneditor.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeoneditor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSession;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.port.DungeonEditorDungeonPort;
import src.domain.dungeoneditor.model.session.repository.DungeonEditorDungeonRepository;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorSessionInteractionUseCase {
    private final DungeonEditorDungeonRepository dungeonRepository;
    private final DungeonEditorDungeonPort dungeonPort;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter = new InterpretDungeonEditorMainViewInputUseCase();

    DungeonEditorSessionInteractionUseCase(
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.dungeonRepository = dungeonRepository;
        this.dungeonPort = dungeonPort;
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
        dungeonRepository.saveRoomNarration(session.selectedMapId(), roomNarration);
        return session.clearPreview().withStatusText(dungeonPort.currentFacts(
                session.selectedMapId(),
                session.selection(),
                session.preview()).mutationStatusText());
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
        dungeonRepository.applyOperation(nextSession.selectedMapId(), effect.applyPreview());
        DungeonEditorDungeonFacts facts = dungeonPort.currentFacts(
                nextSession.selectedMapId(),
                nextSession.selection(),
                nextSession.preview());
        return nextSession.clearPreview().withStatusText(facts.mutationStatusText());
    }
}
