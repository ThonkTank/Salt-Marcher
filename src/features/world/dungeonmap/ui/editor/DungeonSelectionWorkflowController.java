package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.panes.DungeonSelectionEditorPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import ui.shell.DetailsNavigator;

final class DungeonSelectionWorkflowController {

    @FunctionalInterface
    interface LinkCreator {
        void create(long mapId, long fromEndpointId, long toEndpointId);
    }

    private final DungeonMapPane canvas;
    private final DungeonSelectionEditorPane selectionEditorPane;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonEditorState state;
    private DetailsNavigator detailsNavigator;
    private DungeonEditorInspectorContentFactory inspectorContentFactory;

    private Long pendingLinkStartId;

    DungeonSelectionWorkflowController(
            DungeonMapPane canvas,
            DungeonSelectionEditorPane selectionEditorPane,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonEditorState state
    ) {
        this.canvas = canvas;
        this.selectionEditorPane = selectionEditorPane;
        this.toolSettingsPane = toolSettingsPane;
        this.state = state;
    }

    void updateToolMode(DungeonEditorTool tool) {
        canvas.setActiveTool(tool);
        clearPendingLink();
        toolSettingsPane.setActiveTool(tool);
    }

    void cancelPendingLink() {
        clearPendingLink();
    }

    void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
    }

    void setInspectorContentFactory(DungeonEditorInspectorContentFactory inspectorContentFactory) {
        this.inspectorContentFactory = inspectorContentFactory;
    }

    void clearSelection() {
        showSelection(DungeonSelection.none(), false);
    }

    void showLinkSelection(DungeonLink link) {
        showSelection(DungeonSelection.link(link), false);
    }

    void showEndpointSelection(DungeonEndpoint endpoint) {
        showSelection(DungeonSelection.endpoint(endpoint), false);
    }

    void handleCellClick(
            DungeonEditorTool tool,
            DungeonMapPane.CellInteraction interaction,
            Long currentMapId,
            java.util.function.Consumer<DungeonSquare> onAssignRoomArea,
            java.util.function.Consumer<DungeonSquare> onCreateOrSelectEndpoint
    ) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        switch (effectiveTool.cellClickAction()) {
            case SELECT_SQUARE -> selectSquare(interaction.square(), interaction.x(), interaction.y(), currentMapId);
            case ASSIGN_ROOM_AREA -> {
                if (interaction.square() == null || interaction.square().roomId() == null) {
                    showWorkflowMessage("Bereich zuweisen", "Dieses Feld hat keinen Raum — erst Raum zuweisen.");
                } else {
                    onAssignRoomArea.accept(interaction.square());
                }
            }
            case CREATE_OR_SELECT_ENDPOINT -> onCreateOrSelectEndpoint.accept(interaction.square());
        }
    }

    void handleEndpointClick(
            DungeonEditorTool tool,
            DungeonEndpoint endpoint,
            Long currentMapId,
            LinkCreator onCreateLink
    ) {
        if (tool == DungeonEditorTool.LINK) {
            if (pendingLinkStartId == null) {
                pendingLinkStartId = endpoint.endpointId();
                canvas.setPendingLinkStart(pendingLinkStartId);
                toolSettingsPane.showLinkPending(true);
                return;
            }
            Long fromId = pendingLinkStartId;
            clearPendingLink();
            if (currentMapId != null) {
                onCreateLink.create(currentMapId, fromId, endpoint.endpointId());
            }
            return;
        }
        showEndpointSelection(endpoint);
    }

    void selectRoom(DungeonRoom room) {
        if (room == null) {
            return;
        }
        showSelection(DungeonSelection.room(room), true);
    }

    void selectArea(DungeonArea area) {
        if (area == null) {
            return;
        }
        showSelection(DungeonSelection.area(area), true);
    }

    void selectFeature(DungeonFeature feature) {
        if (feature == null) {
            return;
        }
        showSelection(DungeonSelection.feature(feature), true);
    }

    void selectPassage(DungeonPassage passage) {
        if (passage == null) {
            return;
        }
        showSelection(DungeonSelection.passage(passage), false);
    }

    void restoreRoomSelection(DungeonRoom room) {
        if (room == null) {
            return;
        }
        restoreSelection(DungeonSelection.room(room));
    }

    void restoreAreaSelection(DungeonArea area) {
        if (area == null) {
            return;
        }
        restoreSelection(DungeonSelection.area(area));
    }

    void restoreFeatureSelection(DungeonFeature feature) {
        if (feature == null) {
            return;
        }
        restoreSelection(DungeonSelection.feature(feature));
    }

    void restorePassageSelection(DungeonPassage passage) {
        if (passage == null) {
            return;
        }
        restoreSelection(DungeonSelection.passage(passage));
    }

    void refreshInspectorForCurrentSelection() {
        if (state.currentSelection() == null) {
            return;
        }
        openSelectionInInspector(state.currentSelection(), true);
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
        selectionEditorPane.showSelection(selection);
        syncToolSettingsSelection(selection);
        openSelectionInInspector(selection, true);
    }

    private void showSelection(DungeonSelection selection, boolean openInspector) {
        state.setCurrentSelection(selection);
        canvas.setSelectedSelection(selection);
        selectionEditorPane.showSelection(selection);
        syncToolSettingsSelection(selection);
        if (openInspector) {
            openSelectionInInspector(selection, false);
        }
    }

    private void clearPendingLink() {
        pendingLinkStartId = null;
        canvas.setPendingLinkStart(null);
        toolSettingsPane.showLinkPending(false);
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
                toolSettingsPane.selectRoom(selection.room() == null ? null : selection.room().roomId());
            }
            case AREA -> {
                toolSettingsPane.clearFeatureSelection();
                toolSettingsPane.setTileContextFeatures(java.util.List.of());
                toolSettingsPane.selectRoom(null);
                toolSettingsPane.selectArea(selection.area() == null ? null : selection.area().areaId());
            }
            case FEATURE -> {
                toolSettingsPane.selectRoom(null);
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
                    toolSettingsPane.selectRoom(null);
                    toolSettingsPane.selectArea(null);
                } else {
                    toolSettingsPane.selectRoom(selection.square().roomId());
                    toolSettingsPane.selectArea(selection.square().areaId());
                }
            }
            case ENDPOINT, LINK, PASSAGE, NONE -> toolSettingsPane.clearEntitySelections();
        }
    }

    void openSelectionInInspector(DungeonSelection selection, boolean refreshOnlyIfVisible) {
        if (detailsNavigator == null || inspectorContentFactory == null || selection == null) {
            return;
        }
        switch (selection.type()) {
            case ROOM -> showRoomInspector(selection.room(), refreshOnlyIfVisible);
            case AREA -> showAreaInspector(selection.area(), refreshOnlyIfVisible);
            case FEATURE -> showFeatureInspector(selection.feature(), refreshOnlyIfVisible);
            case NONE -> {
                // Keep the last global inspector entry visible until the GM opens or closes it explicitly.
            }
            case SQUARE, ENDPOINT, LINK, PASSAGE -> {
                // These remain local workflow selections in the editor, not inspector cards.
            }
        }
    }

    void showWorkflowMessage(String title, String message) {
        selectionEditorPane.showEditorMessage(message);
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

    private void showRoomInspector(DungeonRoom room, boolean refreshOnlyIfVisible) {
        if (room == null || room.roomId() == null) {
            return;
        }
        Object entryKey = roomEntryKey(room.roomId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(
                titleOrFallback(room.name(), "Raum"),
                entryKey,
                () -> inspectorContentFactory.buildRoomCard(room));
    }

    private void showAreaInspector(DungeonArea area, boolean refreshOnlyIfVisible) {
        if (area == null || area.areaId() == null) {
            return;
        }
        Object entryKey = areaEntryKey(area.areaId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(
                titleOrFallback(area.name(), "Bereich"),
                entryKey,
                () -> inspectorContentFactory.buildAreaCard(area));
    }

    private void showFeatureInspector(DungeonFeature feature, boolean refreshOnlyIfVisible) {
        if (feature == null || feature.featureId() == null) {
            return;
        }
        Object entryKey = featureEntryKey(feature.featureId());
        if (refreshOnlyIfVisible && !isShowingContent(entryKey)) {
            return;
        }
        detailsNavigator.showContent(
                titleOrFallback(feature.name(), feature.category() == null ? "Feature" : feature.category().label()),
                entryKey,
                () -> inspectorContentFactory.buildFeatureCard(feature));
    }

    private boolean isShowingContent(Object key) {
        return detailsNavigator.isShowing(new DetailsNavigator.EntryKey("content", key));
    }

    private static String roomEntryKey(Long roomId) {
        return "dungeon-editor-room:" + roomId;
    }

    private static String areaEntryKey(Long areaId) {
        return "dungeon-editor-area:" + areaId;
    }

    private static String featureEntryKey(Long featureId) {
        return "dungeon-editor-feature:" + featureId;
    }

    private static String titleOrFallback(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }
}
