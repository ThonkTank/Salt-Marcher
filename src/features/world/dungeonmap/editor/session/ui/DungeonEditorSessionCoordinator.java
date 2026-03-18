package features.world.dungeonmap.editor.session.ui;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.session.application.DungeonEditorSelectionPolicy;
import features.world.dungeonmap.editor.session.application.DungeonEditorSessionState;
import features.world.dungeonmap.editor.session.application.workflow.DungeonEditorSessionWorkflow;
import features.world.dungeonmap.editor.session.ui.edit.DungeonEditorEditController;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionReadModel;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdate;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdateSink;
import features.world.dungeonmap.editor.session.ui.tool.DungeonCorridorDraftController;
import features.world.dungeonmap.editor.session.ui.tool.DungeonEditorToolSessionController;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorControls;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorInspectorCoordinator;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorInspectorPublisher;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorStatePaneModel;
import features.world.dungeonmap.editor.shell.ui.DungeonToolModeState;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathCommit;
import features.world.dungeonmap.editor.workspace.ui.port.DungeonEditorWorkspaceSink;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.view.model.DungeonSelection;
import ui.shell.DetailsNavigator;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Coordinates mutable editor interaction state. Holds current layout and session workflow
 * access (formerly in DungeonEditorSessionAdapter), and exposes session and workspace
 * interaction methods directly.
 *
 * <p>Use {@link #create} to construct — the factory documents the construction phases
 * and makes the circular dependency between corridorDraftController and selectionPresenter explicit.
 */
public final class DungeonEditorSessionCoordinator implements DungeonEditorSessionReadModel {

    private final DungeonEditorSessionWorkflow sessionWorkflow;
    private final DungeonEditorSessionState sessionState;

    private final DungeonEditorSelectionPresenter selectionPresenter;
    private final DungeonEditorToolSessionController toolSessionController;
    private final DungeonEditorEditController editController;
    private final DungeonEditorWorkspaceSink workspaceSink;

    private final MutableReadModel readModel;

    /**
     * Holds the mutable layout state and provides {@link DungeonEditorSessionReadModel} to
     * subobjects before the coordinator is constructed. The {@code currentLayout} field starts
     * {@code null} and is kept up to date via {@link #updateLayout} and
     * {@link #applyExternalUpdate}. The {@code onExternalUpdate} callback is wired after
     * construction via {@link #setOnExternalUpdate}.
     */
    private static final class MutableReadModel implements DungeonEditorSessionReadModel {
        private final DungeonEditorSessionWorkflow sessionWorkflow;
        private DungeonLayout currentLayout;
        private Consumer<DungeonEditorSessionUpdate> onExternalUpdate;

        MutableReadModel(DungeonEditorSessionWorkflow sessionWorkflow) {
            this.sessionWorkflow = sessionWorkflow;
        }

        void updateLayout(DungeonLayout layout) {
            this.currentLayout = layout;
        }

        void setOnExternalUpdate(Consumer<DungeonEditorSessionUpdate> handler) {
            this.onExternalUpdate = handler;
        }

        void applyExternalUpdate(DungeonEditorSessionUpdate update) {
            if (update == null) return;
            if (update.kind() == DungeonEditorSessionUpdate.Kind.LAYOUT_CHANGED) {
                this.currentLayout = update.layout();
            }
            if (onExternalUpdate != null) {
                onExternalUpdate.accept(update);
            }
        }

        @Override public DungeonLayout currentLayout() { return currentLayout; }
        @Override public Long sessionMapId() { return sessionWorkflow.sessionMapId(); }
        @Override public Long activeEditSessionId() { return sessionWorkflow.activeEditSessionId(); }
        @Override public boolean editingEnabled() { return sessionWorkflow.editingEnabled(); }
    }

    /**
     * Factory method that constructs all sub-coordinators in dependency order via six named phases.
     *
     * <p>A {@link MutableReadModel} is constructed before Phase 1 so that subobjects can
     * reference layout state via {@link DungeonEditorSessionReadModel} before the coordinator
     * instance exists. Its {@code currentLayout} field is {@code null} on construction and
     * updated on each layout load via {@link #updateLayout}.
     *
     * <p>The forward reference from Phase 3 (editController) to Phase 5 (toolSessionController)
     * is resolved via an {@link AtomicReference} supplier: the runnable is bound after
     * toolSessionController is constructed and before the system becomes interactive.
     */
    public static DungeonEditorSessionCoordinator create(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DungeonToolModeState toolModeState,
            DungeonEditorControls controls,
            DungeonEditorSplitWorkspace workspace,
            DetailsNavigator detailsNavigator
    ) {
        Objects.requireNonNull(sessionWorkflow, "sessionWorkflow");
        Objects.requireNonNull(toolModeState, "toolModeState");
        Objects.requireNonNull(controls, "controls");
        Objects.requireNonNull(workspace, "workspace");
        Objects.requireNonNull(detailsNavigator, "detailsNavigator");

        MutableReadModel readModel = new MutableReadModel(sessionWorkflow);

        CoreLayerResult core = buildCoreLayer(sessionWorkflow, detailsNavigator, readModel);
        DungeonEditorSelectionPresenter selectionPresenter = buildSelectionPresenter(
                core.sessionState(), workspace, core.inspectorCoordinator(), toolModeState, readModel);

        // Forward reference: editController (Phase 3) needs toolSessionController.clearTransientState()
        // which is only available after Phase 5. Resolved via a Supplier<Runnable> bound after Phase 5.
        AtomicReference<Runnable> clearTransient = new AtomicReference<>(() -> {});
        DungeonEditorEditController editController = buildEditController(
                sessionWorkflow, workspace, core.sessionState(), selectionPresenter,
                clearTransient::get, readModel, core.innerSink());
        DungeonCorridorDraftController corridorDraftController = buildCorridorDraftController(
                core.sessionState(), editController);
        DungeonEditorToolSessionController toolSessionController = buildToolSession(
                toolModeState, controls, workspace, core.sessionState(), readModel, core.innerSink(),
                corridorDraftController, selectionPresenter);
        clearTransient.set(toolSessionController::clearTransientState);

        DungeonEditorWorkspaceSink workspaceSink = buildWorkspaceSink(
                selectionPresenter, editController, core.sessionState(), core.innerSink());

        return new DungeonEditorSessionCoordinator(
                sessionWorkflow, core.sessionState(),
                selectionPresenter, toolSessionController, editController, workspaceSink,
                readModel);
    }

    // --- Phase 1: core state and update pipeline ---

    private record CoreLayerResult(
            DungeonEditorSessionState sessionState,
            DungeonEditorInspectorCoordinator inspectorCoordinator,
            DungeonEditorSessionUpdateSink innerSink
    ) {}

    private static CoreLayerResult buildCoreLayer(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DetailsNavigator detailsNavigator,
            MutableReadModel readModel) {
        DungeonEditorSessionState sessionState = new DungeonEditorSessionState();
        DungeonEditorInspectorCoordinator inspectorCoordinator = new DungeonEditorInspectorCoordinator(
                new DungeonEditorInspectorPublisher(detailsNavigator),
                sessionState::selectedTarget,
                readModel);
        DungeonEditorSessionUpdateSink innerSink = update -> {
            readModel.applyExternalUpdate(update);
            inspectorCoordinator.onSessionUpdate(update);
        };
        return new CoreLayerResult(sessionState, inspectorCoordinator, innerSink);
    }

    // --- Phase 2: selectionPresenter ---
    // corridorTargetSelector is wired in Phase 5 after toolSessionController is available.
    // toolModeState::activeTool is equivalent to toolSessionController::activeTool and
    // requires no deferred binding.

    private static DungeonEditorSelectionPresenter buildSelectionPresenter(
            DungeonEditorSessionState sessionState,
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorInspectorCoordinator inspectorCoordinator,
            DungeonToolModeState toolModeState,
            MutableReadModel readModel) {
        return new DungeonEditorSelectionPresenter(
                sessionState,
                new DungeonEditorSelectionPolicy(),
                workspace,
                inspectorCoordinator,
                () -> readModel.applyExternalUpdate(DungeonEditorSessionUpdate.selectionChanged()),
                toolModeState::activeTool,
                readModel::currentLayout);
    }

    // --- Phase 3: editController ---
    // clearTransientSupplier defers the reference to toolSessionController.clearTransientState,
    // which is bound in create() after Phase 5 completes.

    private static DungeonEditorEditController buildEditController(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionPresenter selectionPresenter,
            Supplier<Runnable> clearTransientSupplier,
            MutableReadModel readModel,
            DungeonEditorSessionUpdateSink innerSink) {
        return new DungeonEditorEditController(
                sessionWorkflow,
                workspace,
                sessionState,
                selectionPresenter,
                () -> clearTransientSupplier.get().run(),
                readModel,
                innerSink);
    }

    // --- Phase 4: corridorDraftController ---

    private static DungeonCorridorDraftController buildCorridorDraftController(
            DungeonEditorSessionState sessionState,
            DungeonEditorEditController editController) {
        return new DungeonCorridorDraftController(sessionState, editController);
    }

    // --- Phase 5: toolSessionController + late-wiring ---

    private static DungeonEditorToolSessionController buildToolSession(
            DungeonToolModeState toolModeState,
            DungeonEditorControls controls,
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorSessionState sessionState,
            MutableReadModel readModel,
            DungeonEditorSessionUpdateSink innerSink,
            DungeonCorridorDraftController corridorDraftController,
            DungeonEditorSelectionPresenter selectionPresenter) {
        DungeonEditorToolSessionController toolSessionController = new DungeonEditorToolSessionController(
                toolModeState,
                controls,
                workspace,
                sessionState,
                readModel,
                innerSink,
                corridorDraftController);
        selectionPresenter.setCorridorTargetSelector(toolSessionController::selectCorridorTarget);
        corridorDraftController.setSelectionController(selectionPresenter);
        return toolSessionController;
    }

    // --- Phase 6: workspaceSink ---

    private static DungeonEditorWorkspaceSink buildWorkspaceSink(
            DungeonEditorSelectionPresenter selectionPresenter,
            DungeonEditorEditController editController,
            DungeonEditorSessionState sessionState,
            DungeonEditorSessionUpdateSink innerSink) {
        return new DungeonEditorSessionWorkspaceSink(
                selectionPresenter,
                editController,
                handle -> {
                    sessionState.selectCorridorDoorHandle(handle);
                    selectionPresenter.syncCorridorDoorWorkspaceSelection();
                    innerSink.applySessionUpdate(DungeonEditorSessionUpdate.statePaneChanged());
                });
    }

    private DungeonEditorSessionCoordinator(
            DungeonEditorSessionWorkflow sessionWorkflow,
            DungeonEditorSessionState sessionState,
            DungeonEditorSelectionPresenter selectionPresenter,
            DungeonEditorToolSessionController toolSessionController,
            DungeonEditorEditController editController,
            DungeonEditorWorkspaceSink workspaceSink,
            MutableReadModel readModel
    ) {
        this.sessionWorkflow = sessionWorkflow;
        this.sessionState = sessionState;
        this.selectionPresenter = selectionPresenter;
        this.toolSessionController = toolSessionController;
        this.editController = editController;
        this.workspaceSink = workspaceSink;
        this.readModel = readModel;
    }

    // --- Layout state (formerly DungeonEditorSessionAdapter) ---

    /** Updates the current layout; called by DungeonEditorLoadController on load. */
    public void updateLayout(DungeonLayout layout) {
        readModel.updateLayout(layout);
    }

    /**
     * Registers the handler that receives session updates (forwarded from innerSink).
     * Called once from DungeonEditorView after construction.
     */
    public void setOnExternalUpdate(Consumer<DungeonEditorSessionUpdate> onExternalUpdate) {
        readModel.setOnExternalUpdate(Objects.requireNonNull(onExternalUpdate, "onExternalUpdate"));
    }

    // --- DungeonEditorSessionReadModel ---

    @Override
    public DungeonLayout currentLayout() {
        return readModel.currentLayout();
    }

    @Override
    public Long sessionMapId() {
        return sessionWorkflow.sessionMapId();
    }

    @Override
    public Long activeEditSessionId() {
        return sessionWorkflow.activeEditSessionId();
    }

    @Override
    public boolean editingEnabled() {
        return sessionWorkflow.editingEnabled();
    }

    // --- Session actions ---

    public void clearSelectionAndTransientState() {
        selectionPresenter.clearSelection();
        toolSessionController.clearTransientState();
    }

    public DungeonSelection selectedTarget() {
        return sessionState.selectedTarget();
    }

    public DungeonCorridor selectedCorridor() {
        return sessionState.selectedCorridor(readModel.currentLayout());
    }

    /** Returns the tool controller for direct use by shell components. */
    public DungeonEditorToolSessionController toolPort() {
        return toolSessionController;
    }

    public DungeonEditorWorkspaceSink workspaceSink() {
        return workspaceSink;
    }

    public void resetSelectedCorridorDoor() {
        editController.resetSelectedCorridorDoor();
    }

    public void deleteSelectedCorridorWaypoint() {
        editController.deleteSelectedCorridorWaypoint();
    }

    public DungeonEditorStatePaneModel statePaneModel() {
        return buildStatePaneModel();
    }

    // --- Internal ---

    private DungeonEditorStatePaneModel buildStatePaneModel() {
        return new DungeonEditorStatePaneModel(
                toolSessionController.activeTool(),
                selectedCorridor(),
                selectionPresenter.selectedCorridorDoorHandle(),
                selectionPresenter.selectedCorridorWaypointHandle());
    }
}
