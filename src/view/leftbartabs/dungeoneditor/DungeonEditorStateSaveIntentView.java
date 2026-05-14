package src.view.leftbartabs.dungeoneditor;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

final class StateSaveIntent {

    private StateSaveIntent() {
    }

    static @Nullable DungeonEditorSessionCommand toSaveCommand(
            DungeonEditorContributionModel presentationModel,
            DungeonEditorStateViewInputEvent event
    ) {
        DungeonEditorContributionModel.RoomNarrationCardProjection card =
                currentNarrationCard(presentationModel, event.roomId());
        if (card == null) {
            return null;
        }
        return Commands.roomNarrationCommand(new DungeonEditorSessionCommand.RoomNarrationInput(
                card.roomId(),
                event.visualDescription(),
                mergeExitNarrations(card.exits(), event.exitDescriptions())));
    }

    private static DungeonEditorContributionModel.@Nullable RoomNarrationCardProjection currentNarrationCard(
            DungeonEditorContributionModel presentationModel,
            long roomId
    ) {
        DungeonEditorContributionModel.StateProjection currentProjection = presentationModel.stateProjectionProperty().get();
        DungeonEditorContributionModel.StateProjection safeProjection = currentProjection == null
                ? DungeonEditorContributionModel.StateProjection.initial()
                : currentProjection;
        for (DungeonEditorContributionModel.RoomNarrationCardProjection card : safeProjection.narrationCards()) {
            if (card.roomId() == roomId) {
                return card;
            }
        }
        return null;
    }

    private static List<DungeonEditorWorkspaceValues.RoomExitNarration> mergeExitNarrations(
            List<DungeonEditorContributionModel.RoomExitNarrationProjection> exits,
            List<String> exitDescriptions
    ) {
        List<DungeonEditorWorkspaceValues.RoomExitNarration> merged = new ArrayList<>();
        List<DungeonEditorContributionModel.RoomExitNarrationProjection> safeExits =
                exits == null ? List.of() : exits;
        List<String> safeDescriptions = exitDescriptions == null ? List.of() : exitDescriptions;
        for (int index = 0; index < safeExits.size(); index++) {
            DungeonEditorContributionModel.RoomExitNarrationProjection exit = safeExits.get(index);
            String description = index < safeDescriptions.size() ? safeDescriptions.get(index) : exit.description();
            merged.add(toRoomExit(exit, description));
        }
        return List.copyOf(merged);
    }

    private static DungeonEditorWorkspaceValues.RoomExitNarration toRoomExit(
            DungeonEditorContributionModel.RoomExitNarrationProjection exit,
            @Nullable String description
    ) {
        DungeonEditorContributionModel.RoomExitNarrationProjection safeExit = exit == null
                ? new DungeonEditorContributionModel.RoomExitNarrationProjection("", 0, 0, 0, "", "")
                : exit;
        return new DungeonEditorWorkspaceValues.RoomExitNarration(
                safeExit.label(),
                new DungeonEditorWorkspaceValues.Cell(safeExit.q(), safeExit.r(), safeExit.level()),
                safeExit.direction(),
                description == null ? safeExit.description() : description);
    }
}
