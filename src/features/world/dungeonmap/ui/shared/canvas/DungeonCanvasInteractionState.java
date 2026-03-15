package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.ui.shared.selection.DungeonSelection;
import features.world.dungeonmap.model.domain.PassageDirection;

final class DungeonCanvasInteractionState {

    private DungeonSelection selection = DungeonSelection.none();
    private Long partySquareId;
    private Integer invalidEdgeX;
    private Integer invalidEdgeY;
    private PassageDirection invalidEdgeDirection;

    DungeonSelection selection() {
        return selection;
    }

    void resetForLoadedState() {
        selection = DungeonSelection.none();
        partySquareId = null;
        clearInvalidEdge();
    }

    void setSelection(DungeonSelection selection) {
        this.selection = selection == null ? DungeonSelection.none() : selection;
    }

    Long partySquareId() {
        return partySquareId;
    }

    void setPartySquareId(Long partySquareId) {
        this.partySquareId = partySquareId;
    }

    void setInvalidEdge(int x, int y, PassageDirection direction) {
        if (direction == null) {
            clearInvalidEdge();
            return;
        }
        invalidEdgeX = x;
        invalidEdgeY = y;
        invalidEdgeDirection = direction;
    }

    void clearInvalidEdge() {
        invalidEdgeX = null;
        invalidEdgeY = null;
        invalidEdgeDirection = null;
    }

    Integer invalidEdgeX() {
        return invalidEdgeX;
    }

    Integer invalidEdgeY() {
        return invalidEdgeY;
    }

    PassageDirection invalidEdgeDirection() {
        return invalidEdgeDirection;
    }
}
