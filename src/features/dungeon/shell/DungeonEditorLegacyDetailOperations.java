package src.features.dungeon.shell;

import java.util.Objects;
import src.domain.dungeon.DungeonEditorLabelNameApplicationService;
import src.domain.dungeon.DungeonEditorNarrationApplicationService;
import src.domain.dungeon.DungeonEditorStairApplicationService;
import src.domain.dungeon.DungeonEditorTransitionApplicationService;
import src.domain.dungeon.published.SaveDungeonEditorLabelNameCommand;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand;
import src.domain.dungeon.published.SaveDungeonEditorStairGeometryCommand;
import src.domain.dungeon.published.SaveDungeonEditorTransitionDescriptionCommand;
import src.domain.dungeon.published.SaveDungeonEditorTransitionLinkCommand;

record DungeonEditorLegacyDetailOperations(
        DungeonEditorNarrationApplicationService narrationEditor,
        DungeonEditorLabelNameApplicationService labelNameEditor,
        DungeonEditorTransitionApplicationService transitionEditor,
        DungeonEditorStairApplicationService stairEditor
) {
    DungeonEditorLegacyDetailOperations {
        Objects.requireNonNull(narrationEditor, "narrationEditor");
        Objects.requireNonNull(labelNameEditor, "labelNameEditor");
        Objects.requireNonNull(transitionEditor, "transitionEditor");
        Objects.requireNonNull(stairEditor, "stairEditor");
    }

    void saveRoomNarration(SaveDungeonEditorRoomNarrationCommand command) {
        narrationEditor.saveRoomNarration(command);
    }

    void saveLabelName(SaveDungeonEditorLabelNameCommand command) {
        labelNameEditor.saveLabelName(command);
    }

    void saveTransitionLink(SaveDungeonEditorTransitionLinkCommand command) {
        transitionEditor.saveTransitionLink(command);
    }

    void saveTransitionDescription(SaveDungeonEditorTransitionDescriptionCommand command) {
        transitionEditor.saveTransitionDescription(command);
    }

    void saveStairGeometry(SaveDungeonEditorStairGeometryCommand command) {
        stairEditor.saveStairGeometry(command);
    }
}
