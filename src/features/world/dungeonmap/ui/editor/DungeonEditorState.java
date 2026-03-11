package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMapState;

final class DungeonEditorState {

    private Long currentMapId;
    private DungeonMapState currentState;
    private long loadRequestToken;
    private boolean syncingAreaSelection;
    private Long pendingRoomSelectionId;
    private Long pendingAreaSelectionId;

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
}
