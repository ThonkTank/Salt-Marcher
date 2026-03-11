package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSelection;

final class DungeonEditorState {

    private Long currentMapId;
    private DungeonMapState currentState;
    private DungeonSelection currentSelection = DungeonSelection.none();
    private long loadRequestToken;
    private boolean syncingAreaSelection;
    private Long pendingRoomSelectionId;
    private Long pendingAreaSelectionId;
    private Long pendingPassageSelectionId;
    private Long pendingFeatureSelectionId;

    Long currentMapId() {
        return currentMapId;
    }

    void setCurrentMapId(Long currentMapId) {
        this.currentMapId = currentMapId;
    }

    DungeonMapState currentState() {
        return currentState;
    }

    void setCurrentState(DungeonMapState currentState) {
        this.currentState = currentState;
    }

    DungeonSelection currentSelection() {
        return currentSelection;
    }

    void setCurrentSelection(DungeonSelection currentSelection) {
        this.currentSelection = currentSelection == null ? DungeonSelection.none() : currentSelection;
    }

    long nextLoadRequestToken() {
        loadRequestToken += 1;
        return loadRequestToken;
    }

    long loadRequestToken() {
        return loadRequestToken;
    }

    boolean syncingAreaSelection() {
        return syncingAreaSelection;
    }

    void setSyncingAreaSelection(boolean syncingAreaSelection) {
        this.syncingAreaSelection = syncingAreaSelection;
    }

    Long pendingRoomSelectionId() {
        return pendingRoomSelectionId;
    }

    void setPendingRoomSelectionId(Long pendingRoomSelectionId) {
        this.pendingRoomSelectionId = pendingRoomSelectionId;
    }

    Long pendingAreaSelectionId() {
        return pendingAreaSelectionId;
    }

    void setPendingAreaSelectionId(Long pendingAreaSelectionId) {
        this.pendingAreaSelectionId = pendingAreaSelectionId;
    }

    Long pendingPassageSelectionId() {
        return pendingPassageSelectionId;
    }

    void setPendingPassageSelectionId(Long pendingPassageSelectionId) {
        this.pendingPassageSelectionId = pendingPassageSelectionId;
    }

    Long pendingFeatureSelectionId() {
        return pendingFeatureSelectionId;
    }

    void setPendingFeatureSelectionId(Long pendingFeatureSelectionId) {
        this.pendingFeatureSelectionId = pendingFeatureSelectionId;
    }
}
