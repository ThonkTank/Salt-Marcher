package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

public final class DungeonEditorFeatureRuntimeRoot implements DungeonEditorRuntimeOperations {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;
    private final DungeonEditorInteractionService interactionService;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorRuntimeFramePublisher framePublisher;

    public static DungeonEditorFeatureRuntimeRoot create(ServiceRegistry registry) {
        ServiceRegistry safeRegistry = Objects.requireNonNull(registry, "registry");
        DungeonEditorMainViewInteractionState interactionState = new DungeonEditorMainViewInteractionState();
        return new DungeonEditorFeatureRuntimeRoot(
                safeRegistry.require(DungeonEditorControlsModel.class),
                safeRegistry.require(DungeonEditorMapSurfaceModel.class),
                safeRegistry.require(DungeonEditorStateModel.class),
                interactionState,
                DungeonEditorAuthoredRuntimeAssembly.create(safeRegistry, interactionState));
    }

    private DungeonEditorFeatureRuntimeRoot(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorAuthoredRuntimeOperations operationOwner
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
        interactionService = new DungeonEditorInteractionService(this.operationOwner);
        draftSession = new DungeonEditorRuntimeDraftSession();
        framePublisher = new DungeonEditorRuntimeFramePublisher(
                this.controlsModel,
                mapSurfaceModel,
                this.stateModel,
                draftSession);
    }

    public DungeonEditorRuntimeOperations operations() {
        return this;
    }

    @Override
    public DungeonEditorMapCatalogOperations catalog() {
        return new DungeonEditorRuntimeMapCatalogPort(interactionState, draftSession, operationOwner);
    }

    @Override
    public DungeonEditorControlOperations controls() {
        return new DungeonEditorRuntimeControlPort(
                interactionState,
                pointer(),
                draftSession,
                operationOwner);
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
                operationOwner);
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
                operationOwner);
    }

    public DungeonEditorRuntimePublication currentPublication() {
        return framePublisher.currentPublication();
    }

    public Runnable subscribe(Consumer<DungeonEditorRuntimePublication> subscriber) {
        return framePublisher.subscribe(subscriber);
    }
}
