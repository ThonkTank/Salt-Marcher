package features.world.dungeonmap.ui.editor.workflow.selection;

import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;

public final class DungeonLinkWorkflowController {

    @FunctionalInterface
    public interface LinkCreator {
        void create(long mapId, DungeonLinkAnchor fromAnchor, DungeonLinkAnchor toAnchor);
    }

    private final DungeonMapPane canvas;
    private final DungeonToolSettingsPane toolSettingsPane;
    private DungeonLinkAnchor pendingLinkStart;

    public DungeonLinkWorkflowController(
            DungeonMapPane canvas,
            DungeonToolSettingsPane toolSettingsPane
    ) {
        this.canvas = canvas;
        this.toolSettingsPane = toolSettingsPane;
    }

    public void cancelPendingLink() {
        pendingLinkStart = null;
        canvas.setPendingLinkStart(null);
        toolSettingsPane.showLinkPending(false);
    }

    public void beginOrCompleteLink(
            DungeonLinkAnchor clickedAnchor,
            Long currentMapId,
            LinkCreator onCreateLink
    ) {
        if (clickedAnchor == null) {
            return;
        }
        if (pendingLinkStart == null) {
            pendingLinkStart = clickedAnchor;
            canvas.setPendingLinkStart(pendingLinkStart);
            toolSettingsPane.showLinkPending(true);
            return;
        }
        DungeonLinkAnchor fromAnchor = pendingLinkStart;
        cancelPendingLink();
        if (currentMapId != null && onCreateLink != null) {
            onCreateLink.create(currentMapId, fromAnchor, clickedAnchor);
        }
    }
}
