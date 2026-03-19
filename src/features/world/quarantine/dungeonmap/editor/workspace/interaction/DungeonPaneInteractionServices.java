package features.world.quarantine.dungeonmap.editor.workspace.interaction;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorMoveTarget;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorWaypointInsert;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneSelectionAreaProjection;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonPaneWallPathHostAdapter;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonPaneWallPathProjection;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.WallPathInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.Objects;
import java.util.function.Supplier;

public final class DungeonPaneInteractionServices {

    private final DungeonPaneRenderState renderState = new DungeonPaneRenderState();
    private final DungeonPanePointerController pointerController;
    private final WallPathInteractionController wallPathController;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private final CorridorEditInteractionController corridorEditController;
    private final DungeonPaneInteractionSink interactionSink;

    public DungeonPaneInteractionServices(
            AbstractDungeonPane pane,
            DungeonPanePointerProjection projection,
            DungeonPaneSelectionAreaProjection selectionAreaProjection,
            DungeonPaneWallPathProjection wallPathProjection,
            DungeonPaneInteractionSink interactionSink
    ) {
        Objects.requireNonNull(pane, "pane");
        Objects.requireNonNull(projection, "projection");
        this.interactionSink = Objects.requireNonNull(interactionSink, "interactionSink");

        // Phase 1: construct all components with their non-circular dependencies
        this.previewModel = new DungeonPanePreviewModel(
                pane, renderState, selectionAreaProjection, this::interactionSink);
        this.corridorWorkspace = new DungeonPaneCorridorWorkspace(
                pane, pane.sceneState(), renderState, previewModel);
        DungeonPaneWallPathHostAdapter wallPathHost =
                new DungeonPaneWallPathHostAdapter(pane, renderState, previewModel, wallPathProjection);
        this.pointerController = new DungeonPanePointerController(
                projection, pane, renderState, previewModel, corridorWorkspace, this::interactionSink);
        this.corridorEditController = new CorridorEditInteractionController(
                renderState,
                corridorWorkspace,
                new CorridorEditControllerCallbacks(renderState, pointerController, this::interactionSink));
        this.wallPathController = new WallPathInteractionController(wallPathHost);

        // Phase 2: inject circular back-references
        previewModel.initCorridorWorkspace(corridorWorkspace);
        corridorWorkspace.initController(corridorEditController);
        pointerController.initCorridorController(corridorEditController);
        pointerController.initWallPathController(wallPathController);
    }

    public DungeonPaneRenderState renderState() {
        return renderState;
    }

    public DungeonPanePointerController pointerController() {
        return pointerController;
    }

    public WallPathInteractionController wallPathController() {
        return wallPathController;
    }

    public DungeonPanePreviewModel previewModel() {
        return previewModel;
    }

    public DungeonPaneCorridorWorkspace corridorWorkspace() {
        return corridorWorkspace;
    }

    public DungeonPaneInteractionSink interactionSink() {
        return interactionSink;
    }

    private record CorridorEditControllerCallbacks(
            DungeonPaneRenderState renderState,
            DungeonPanePointerController pointerController,
            Supplier<DungeonPaneInteractionSink> interactionSinkSupplier
    ) implements CorridorEditInteractionController.Callbacks {

        @Override
        public void onCorridorDoorSelected(CorridorDoorHandle handle) {
            CorridorDoorHandle prev = renderState.previewState().selectedCorridorDoorHandle();
            pointerController.setSelectedCorridorDoorHandle(handle);
            CorridorDoorHandle normalized = renderState.previewState().selectedCorridorDoorHandle();
            DungeonPaneInteractionSink sink = interactionSinkSupplier.get();
            sink.onCorridorDoorSelected(normalized);
            if (!Objects.equals(prev, normalized)) sink.onCorridorDoorSelectionChanged(normalized);
        }

        @Override
        public void onCorridorDoorMoved(CorridorDoorHandle h, CorridorEditInteractionController.DoorMoveTarget t) {
            interactionSinkSupplier.get().onCorridorDoorMoved(h,
                    new CorridorDoorMoveTarget(h.corridorId(), t.roomId(), t.roomCell(), t.direction().ordinal()));
        }

        @Override
        public void onCorridorWaypointSelected(CorridorWaypointHandle h) {
            interactionSinkSupplier.get().onCorridorWaypointSelected(h);
        }

        @Override
        public void onCorridorWaypointAdded(CorridorEditInteractionController.SegmentInsertHit h) {
            interactionSinkSupplier.get().onCorridorWaypointAdded(new CorridorWaypointInsert(h.corridorId(), h.insertIndex(), h.cell()));
        }

        @Override
        public void onCorridorWaypointRemoved(CorridorWaypointHandle h) {
            interactionSinkSupplier.get().onCorridorWaypointRemoved(h);
        }

        @Override
        public void onCorridorWaypointMoved(CorridorWaypointHandle h, Point2i c) {
            interactionSinkSupplier.get().onCorridorWaypointMoved(h, c);
        }
    }
}
