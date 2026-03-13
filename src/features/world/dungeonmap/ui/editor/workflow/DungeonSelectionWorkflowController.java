package features.world.dungeonmap.ui.editor.workflow;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;

public final class DungeonSelectionWorkflowController {

    private final DungeonMapPane canvas;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonEditorState state;
    private final DungeonWorkflowMessageController workflowMessageController;
    private DungeonSelectionInspectorPublisher inspectorPublisher;

    public DungeonSelectionWorkflowController(
            DungeonMapPane canvas,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonEditorState state,
            DungeonWorkflowMessageController workflowMessageController
    ) {
        this.canvas = canvas;
        this.toolSettingsPane = toolSettingsPane;
        this.state = state;
        this.workflowMessageController = workflowMessageController;
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
        if (area == null) {
            return;
        }
        showSelection(DungeonSelection.area(area), true);
    }

    public void selectFeature(DungeonFeature feature) {
        if (feature == null) {
            return;
        }
        showSelection(DungeonSelection.feature(feature), true);
    }

    public void selectPassage(DungeonPassage passage) {
        if (passage == null) {
            return;
        }
        showSelection(DungeonSelection.passage(passage), true);
    }

    public void restoreRoomSelection(DungeonRoom room) {
        if (room == null) {
            return;
        }
        restoreSelection(DungeonSelection.room(room));
    }

    public void restoreAreaSelection(DungeonArea area) {
        if (area == null) {
            return;
        }
        restoreSelection(DungeonSelection.area(area));
    }

    public void restoreFeatureSelection(DungeonFeature feature) {
        if (feature == null) {
            return;
        }
        restoreSelection(DungeonSelection.feature(feature));
    }

    public void restorePassageSelection(DungeonPassage passage) {
        if (passage == null) {
            return;
        }
        restoreSelection(DungeonSelection.passage(passage));
    }

    public void refreshInspectorForCurrentSelection() {
        if (state.currentSelection() == null || inspectorPublisher == null) {
            return;
        }
        inspectorPublisher.refreshSelectionIfVisible(state.currentSelection());
    }

    private void selectSquare(DungeonSquare square, int x, int y, Long currentMapId) {
        if (square != null && square.roomId() != null) {
            DungeonRoom room = findRoom(square.roomId());
            if (room != null) {
                showSelection(DungeonSelection.room(room), true);
                return;
            }
        }
        DungeonSquare effectiveSquare = square;
        if (effectiveSquare == null && currentMapId != null) {
            effectiveSquare = new DungeonSquare(null, currentMapId, x, y, null, null, null, null);
        }
        showSelection(DungeonSelection.square(effectiveSquare, featuresAtSquare(effectiveSquare)), false);
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
        workflowMessageController.clearMessage();
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
                toolSettingsPane.selectArea(null);
            }
            case AREA -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setTileContextFeatures(java.util.List.of());
                toolSettingsPane.selectArea(selection.area() == null ? null : selection.area().areaId());
            }
            case FEATURE -> {
                toolSettingsPane.selectArea(null);
                toolSettingsPane.setTileContextFeatures(java.util.List.of());
                if (selection.feature() == null) {
                    toolSettingsPane.clearFeatureSelection();
                } else {
                    toolSettingsPane.selectFeatureCategory(selection.feature().category());
                    toolSettingsPane.selectFeature(selection.feature().featureId());
                }
            }
            case SQUARE -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setTileContextFeatures(selection.tileFeatures());
                if (selection.square() == null) {
                    toolSettingsPane.selectArea(null);
                } else {
                    toolSettingsPane.selectArea(selection.square().areaId());
                }
            }
            case ENDPOINT, LINK, PASSAGE, NONE -> toolSettingsPane.clearEntitySelections();
        }
    }

    private java.util.List<DungeonFeature> featuresAtSquare(DungeonSquare square) {
        if (square == null || square.squareId() == null || state.currentState() == null) {
            return java.util.List.of();
        }
        java.util.List<DungeonFeature> result = new java.util.ArrayList<>();
        for (var tile : state.currentState().featureTiles()) {
            if (tile.squareId() != square.squareId().longValue()) {
                continue;
            }
            for (DungeonFeature feature : state.currentState().features()) {
                if (feature.featureId() != null && feature.featureId() == tile.featureId()) {
                    result.add(feature);
                    break;
                }
            }
        }
        return result;
    }

    private DungeonRoom findRoom(Long roomId) {
        if (roomId == null || state.currentState() == null) {
            return null;
        }
        for (DungeonRoom room : state.currentState().rooms()) {
            if (roomId.equals(room.roomId())) {
                return room;
            }
        }
        return null;
    }
}
