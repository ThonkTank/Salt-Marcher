package features.world.quarantine.dungeonmap.editor.workspace.wallpath;

import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterEdgeRef;
import features.world.quarantine.dungeonmap.rooms.model.DungeonClusterVertexRef;

import java.util.Set;
import java.util.function.BiConsumer;

public final class DungeonWallPathSessionState {

    private final WallPathInteractionController controller;

    public DungeonWallPathSessionState(WallPathInteractionController controller) {
        this.controller = controller;
    }

    public void cancelWallPath() {
        controller.cancel();
    }

    public void applyWallPathCommitResult(DungeonClusterVertexRef nextAnchor) {
        controller.applyCommitResult(nextAnchor);
    }

    public void revertPendingWallPathCommit() {
        controller.revertPendingCommit();
    }

    public DungeonWallPathState snapshotWallPathState() {
        return controller.snapshotState();
    }

    public void restoreWallPathState(DungeonWallPathState state) {
        controller.restoreState(state);
    }

    public DungeonClusterVertexRef displayedWallAnchor() {
        return controller.displayedAnchor();
    }

    public void setOnWallPathStateChanged(Runnable onStateChanged) {
        controller.setOnStateChanged(onStateChanged);
    }

    public void setOnWallPathCommitRequested(BiConsumer<Set<DungeonClusterEdgeRef>, DungeonClusterVertexRef> onCommitRequested) {
        controller.setOnCommitRequested(request -> onCommitRequested.accept(request.edgeRefs(), request.nextAnchor()));
    }
}
