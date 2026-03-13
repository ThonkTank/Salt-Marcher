package features.world.dungeonmap.ui.editor.workflow.selection;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.index.DungeonMapIndex;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.sidebar.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import features.world.dungeonmap.ui.editor.workflow.binding.EditorMessageBus;

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

    public void showLinkSelection(DungeonLink link) {
        showSelection(DungeonSelection.link(link), true);
    }

    public void showEndpointSelection(DungeonEndpoint endpoint) {
        showSelection(DungeonSelection.endpoint(endpoint), true);
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

    public void selectPassage(DungeonPassage passage) {
        if (passage != null) {
            showSelection(DungeonSelection.passage(passage), true);
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

    public void restorePassageSelection(DungeonPassage passage) {
        if (passage != null) {
            restoreSelection(DungeonSelection.passage(passage));
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
                toolSettingsPane.setTileContextFeatures(java.util.List.of());
                toolSettingsPane.setSelectedArea(null);
            }
            case AREA -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setTileContextFeatures(java.util.List.of());
                toolSettingsPane.setSelectedArea(selection.area() == null ? null : selection.area().areaId());
            }
            case FEATURE -> {
                toolSettingsPane.setSelectedArea(null);
                toolSettingsPane.setTileContextFeatures(java.util.List.of());
                if (selection.feature() == null) {
                    toolSettingsPane.clearFeatureSelection();
                } else {
                    toolSettingsPane.setSelectedFeatureCategory(selection.feature().category());
                    toolSettingsPane.setSelectedFeature(selection.feature().featureId());
                }
            }
            case SQUARE -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setTileContextFeatures(selection.tileFeatures());
                toolSettingsPane.setSelectedArea(selection.square() == null ? null : selection.square().areaId());
            }
            case ENDPOINT, LINK, PASSAGE, NONE -> toolSettingsPane.clearEntitySelections();
        }
    }

    private DungeonMapIndex currentIndex() {
        return state.index();
    }
}
