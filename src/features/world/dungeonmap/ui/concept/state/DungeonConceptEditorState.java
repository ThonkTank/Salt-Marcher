package features.world.dungeonmap.ui.concept.state;

import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.projection.DungeonConceptState;

import java.util.List;

public final class DungeonConceptEditorState {

    private Long currentMapId;
    private long loadRequestToken;
    private DungeonConceptState currentState;
    private Long activeLevelId;
    private DungeonConceptSelection selection = DungeonConceptSelection.none();
    private boolean positionSaveInFlight;
    private long queuedPositionSaveToken;
    private List<DungeonConceptNodePosition> queuedPositionSaveNodes = List.of();

    public Long currentMapId() {
        return currentMapId;
    }

    public void setCurrentMapId(Long currentMapId) {
        this.currentMapId = currentMapId;
    }

    public long nextLoadRequestToken() {
        loadRequestToken += 1;
        return loadRequestToken;
    }

    public long loadRequestToken() {
        return loadRequestToken;
    }

    public DungeonConceptState currentState() {
        return currentState;
    }

    public void setCurrentState(DungeonConceptState currentState) {
        this.currentState = currentState;
    }

    public Long activeLevelId() {
        return activeLevelId;
    }

    public void setActiveLevelId(Long activeLevelId) {
        this.activeLevelId = activeLevelId;
    }

    public DungeonConceptSelection selection() {
        return selection;
    }

    public void setSelection(DungeonConceptSelection selection) {
        this.selection = selection == null ? DungeonConceptSelection.none() : selection;
    }

    public boolean positionSaveInFlight() {
        return positionSaveInFlight;
    }

    public void setPositionSaveInFlight(boolean positionSaveInFlight) {
        this.positionSaveInFlight = positionSaveInFlight;
    }

    public long queuedPositionSaveToken() {
        return queuedPositionSaveToken;
    }

    public void setQueuedPositionSave(long queuedPositionSaveToken, List<DungeonConceptNodePosition> queuedPositionSaveNodes) {
        this.queuedPositionSaveToken = queuedPositionSaveToken;
        this.queuedPositionSaveNodes = queuedPositionSaveNodes == null ? List.of() : List.copyOf(queuedPositionSaveNodes);
    }

    public List<DungeonConceptNodePosition> queuedPositionSaveNodes() {
        return queuedPositionSaveNodes;
    }
}
