package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.PassageDirection;

final class DungeonCanvasInteractionState {

    private DungeonSelection selection = DungeonSelection.none();
    private DungeonLinkAnchor pendingLinkStart;
    private Long partyEndpointId;
    private Long partySquareId;
    private Integer invalidEdgeX;
    private Integer invalidEdgeY;
    private PassageDirection invalidEdgeDirection;

    DungeonSelection selection() {
        return selection;
    }

    void resetForLoadedState() {
        selection = DungeonSelection.none();
        partyEndpointId = null;
        partySquareId = null;
        pendingLinkStart = null;
        clearInvalidEdge();
    }

    void setSelection(DungeonSelection selection) {
        this.selection = selection == null ? DungeonSelection.none() : selection;
    }

    DungeonLinkAnchor pendingLinkStart() {
        return pendingLinkStart;
    }

    void setPendingLinkStart(DungeonLinkAnchor pendingLinkStart) {
        this.pendingLinkStart = pendingLinkStart;
    }

    Long partyEndpointId() {
        return partyEndpointId;
    }

    void setPartyEndpointId(Long partyEndpointId) {
        this.partyEndpointId = partyEndpointId;
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
