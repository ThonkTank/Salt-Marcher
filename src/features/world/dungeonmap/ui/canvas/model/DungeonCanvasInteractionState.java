package features.world.dungeonmap.ui.canvas.model;

import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.PassageDirection;

public final class DungeonCanvasInteractionState {

    private DungeonSelection selection = DungeonSelection.none();
    private DungeonLinkAnchor pendingLinkStart;
    private Long partyEndpointId;
    private Integer invalidEdgeX;
    private Integer invalidEdgeY;
    private PassageDirection invalidEdgeDirection;

    public DungeonSelection selection() {
        return selection;
    }

    public void resetForLoadedState() {
        selection = DungeonSelection.none();
        partyEndpointId = null;
        pendingLinkStart = null;
        clearInvalidEdge();
    }

    public void setSelection(DungeonSelection selection) {
        this.selection = selection == null ? DungeonSelection.none() : selection;
    }

    public DungeonLinkAnchor pendingLinkStart() {
        return pendingLinkStart;
    }

    public void setPendingLinkStart(DungeonLinkAnchor pendingLinkStart) {
        this.pendingLinkStart = pendingLinkStart;
    }

    public Long partyEndpointId() {
        return partyEndpointId;
    }

    public void setPartyEndpointId(Long partyEndpointId) {
        this.partyEndpointId = partyEndpointId;
    }

    public void setInvalidEdge(int x, int y, PassageDirection direction) {
        if (direction == null) {
            clearInvalidEdge();
            return;
        }
        invalidEdgeX = x;
        invalidEdgeY = y;
        invalidEdgeDirection = direction;
    }

    public void clearInvalidEdge() {
        invalidEdgeX = null;
        invalidEdgeY = null;
        invalidEdgeDirection = null;
    }

    public Integer invalidEdgeX() {
        return invalidEdgeX;
    }

    public Integer invalidEdgeY() {
        return invalidEdgeY;
    }

    public PassageDirection invalidEdgeDirection() {
        return invalidEdgeDirection;
    }
}
