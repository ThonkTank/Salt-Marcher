package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

// Project-health debt PH-20260709-001 satellite: runtime root coordination and frame publication are listed in the register.
public final class DungeonEditorFeatureRuntimeRoot implements DungeonEditorRuntimeOperations {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;
    private final DungeonEditorInteractionService interactionService;
    private final DungeonEditorStore store;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorRuntimeControlController controlsController;
    private final DungeonEditorRuntimeMapCatalogController mapCatalogController;
    private final DungeonEditorRuntimeFramePublisher framePublisher;

    public static DungeonEditorFeatureRuntimeRoot create(DungeonEditorRuntimeDependencies dependencies) {
        DungeonEditorRuntimeDependencies safeDependencies =
                Objects.requireNonNull(dependencies, "dependencies");
        DungeonEditorRuntimeDependencies.CompatibilityReadbackModels readback =
                safeDependencies.compatibilityReadbackModels();
        DungeonEditorMainViewInteractionState interactionState = new DungeonEditorMainViewInteractionState();
        DungeonEditorAuthoredRuntimeAssembly.AssemblyResult runtime =
                DungeonEditorAuthoredRuntimeAssembly.create(safeDependencies, interactionState);
        return new DungeonEditorFeatureRuntimeRoot(
                readback.controlsModel(),
                readback.mapSurfaceModel(),
                readback.stateModel(),
                interactionState,
                runtime.operations(),
                runtime.initialResult());
    }

    private DungeonEditorFeatureRuntimeRoot(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorAuthoredRuntimeOperations operationOwner,
            DungeonEditorRuntimeOperationResult initialResult
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
        store = new DungeonEditorStore();
        applyInitialRuntimeResult(initialResult);
        draftSession = new DungeonEditorRuntimeDraftSession();
        framePublisher = new DungeonEditorRuntimeFramePublisher(
                store,
                mapSurfaceModel,
                this.stateModel,
                draftSession);
        interactionService = new DungeonEditorInteractionService(this.operationOwner, store, framePublisher);
        controlsController = new DungeonEditorRuntimeControlController(
                store,
                this.interactionState,
                pointer(),
                draftSession,
                this.operationOwner,
                framePublisher,
                mapSurfaceModel);
        mapCatalogController = new DungeonEditorRuntimeMapCatalogController(
                store,
                this.interactionState,
                draftSession,
                this.operationOwner,
                framePublisher);
    }

    public DungeonEditorRuntimeOperations operations() {
        return this;
    }

    @Override
    public DungeonEditorMapCatalogOperations catalog() {
        return new DungeonEditorRuntimeMapCatalogPort(mapCatalogController);
    }

    @Override
    public DungeonEditorControlOperations controls() {
        return new DungeonEditorRuntimeControlPort(controlsController);
    }

    @Override
    public DungeonEditorPointerInteractionOperations pointer() {
        return new DungeonEditorRuntimePointerPort(interactionService);
    }

    @Override
    public DungeonEditorStatePanelDraftOperations statePanelDrafts() {
        return new DungeonEditorRuntimeStatePanelDraftPort(
                controlsModel,
                stateModel,
                draftSession,
                framePublisher,
                operationOwner,
                store);
    }

    @Override
    public DungeonEditorInlineLabelOperations inlineLabels() {
        return new DungeonEditorRuntimeInlineLabelPort(draftSession, framePublisher, transitionStairs());
    }

    @Override
    public DungeonEditorTransitionStairOperations transitionStairs() {
        return new DungeonEditorRuntimeTransitionStairPort(
                controlsModel,
                stateModel,
                draftSession,
                framePublisher,
                operationOwner,
                store);
    }

    public DungeonEditorRuntimePublication currentPublication() {
        return framePublisher.currentPublication();
    }

    public Runnable subscribe(Consumer<DungeonEditorRuntimePublication> subscriber) {
        return framePublisher.subscribe(subscriber);
    }

    private void applyInitialRuntimeResult(DungeonEditorRuntimeOperationResult initialResult) {
        DungeonEditorRuntimeOperationResult safeInitialResult = initialResult == null
                ? DungeonEditorRuntimeOperationResult.none()
                : initialResult;
        for (DungeonEditorAction action : safeInitialResult.actions()) {
            store.dispatch(action);
        }
    }
}
