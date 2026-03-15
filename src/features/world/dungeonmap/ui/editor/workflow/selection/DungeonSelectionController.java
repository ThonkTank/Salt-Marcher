package features.world.dungeonmap.ui.editor.workflow.selection;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;
import features.world.dungeonmap.ui.shared.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.chrome.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.tools.EditorMessageBus;

public final class DungeonSelectionController {

    private final DungeonMapPane canvas;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonEditorState state;
    private final EditorMessageBus workflowMessages;
    private DungeonSelectionInspectorPublisher inspectorPublisher;

    public DungeonSelectionController(
            DungeonMapPane canvas,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonEditorState state,
            EditorMessageBus workflowMessages
    ) {
        this.canvas = canvas;
        this.toolSettingsPane = toolSettingsPane;
        this.state = state;
        this.workflowMessages = workflowMessages;
    }

    public void setInspectorPublisher(DungeonSelectionInspectorPublisher inspectorPublisher) {
        this.inspectorPublisher = inspectorPublisher;
    }

    public void clearSelection() {
        showSelection(DungeonSelection.none(), false);
    }

    public void handleSquareClick(DungeonMapPane.CellInteraction interaction, Long currentMapId) {
        if (interaction == null) {
            return;
        }
        selectSquare(interaction.square(), interaction.x(), interaction.y(), currentMapId);
    }

    public void selectArea(DungeonArea area) {
        if (area != null) {
            showSelection(DungeonSelection.area(area), true);
        }
    }

    public void selectFeature(DungeonFeature feature) {
        if (feature != null) {
            showSelection(DungeonSelection.feature(feature), true);
        }
    }

    public void selectConnection(DungeonConnection connection) {
        if (connection != null) {
            showSelection(DungeonSelection.connection(connection), true);
        }
    }

    public void restoreRoomSelection(DungeonRoom room) {
        if (room != null) {
            restoreSelection(DungeonSelection.room(room));
        }
    }

    public void restoreAreaSelection(DungeonArea area) {
        if (area != null) {
            restoreSelection(DungeonSelection.area(area));
        }
    }

    public void restoreFeatureSelection(DungeonFeature feature) {
        if (feature != null) {
            restoreSelection(DungeonSelection.feature(feature));
        }
    }

    public void refreshInspectorForCurrentSelection() {
        if (state.currentSelection() != null && inspectorPublisher != null) {
            inspectorPublisher.refreshSelectionIfVisible(state.currentSelection());
        }
    }

    private void selectSquare(DungeonSquare square, int x, int y, Long currentMapId) {
        if (square != null && square.roomId() != null) {
            DungeonRoom room = currentIndex().findRoom(square.roomId());
            if (room != null) {
                showSelection(DungeonSelection.room(room), true);
                return;
            }
        }
        DungeonSquare effectiveSquare = square;
        if (effectiveSquare == null && currentMapId != null) {
            effectiveSquare = new DungeonSquare(null, currentMapId, x, y, null, null, null, null);
        }
        showSelection(
                DungeonSelection.square(
                        effectiveSquare,
                        currentIndex().featuresAtSquare(effectiveSquare == null ? null : effectiveSquare.squareId())),
                false);
    }

    private void restoreSelection(DungeonSelection selection) {
        state.setCurrentSelection(selection);
        canvas.setSelectedSelection(selection);
        syncToolSettingsSelection(selection);
        if (inspectorPublisher != null) {
            inspectorPublisher.refreshSelectionIfVisible(selection);
        }
    }

    private void showSelection(DungeonSelection selection, boolean openInspector) {
        state.setCurrentSelection(selection);
        canvas.setSelectedSelection(selection);
        workflowMessages.clearMessage();
        syncToolSettingsSelection(selection);
        if (openInspector && inspectorPublisher != null) {
            inspectorPublisher.showSelection(selection);
        }
    }

    private void syncToolSettingsSelection(DungeonSelection selection) {
        if (selection == null) {
            toolSettingsPane.clearEntitySelections();
            return;
        }
        switch (selection.type()) {
            case ROOM -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setSelectedArea(null);
            }
            case AREA -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setSelectedArea(selection.area() == null ? null : selection.area().areaId());
            }
            case FEATURE -> {
                toolSettingsPane.setSelectedArea(null);
                if (selection.feature() == null) {
                    toolSettingsPane.clearFeatureSelection();
                } else {
                    toolSettingsPane.setSelectedFeature(selection.feature().featureId());
                }
            }
            case CONNECTION -> toolSettingsPane.clearEntitySelections();
            case SQUARE -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setSelectedArea(selection.square() == null ? null : selection.square().areaId());
            }
            case NONE -> toolSettingsPane.clearEntitySelections();
        }
    }

    private DungeonMapIndex currentIndex() {
        return state.index();
    }
}
