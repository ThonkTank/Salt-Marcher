package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

final class DungeonEditorRuntimeFramePublisher {
    private static final DungeonEditorSelector<Long> DRAFT_SESSION_REVISION =
            DungeonEditorSelector.of(DungeonEditorStoreState::draftSessionRevision);

    private final DungeonEditorStore store;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorRuntimeFrameFactsAssembler frameFactsAssembler;
    private final List<Consumer<DungeonEditorRuntimePublication>> subscribers = new ArrayList<>();
    private long runtimeFramePublicationCount;
    private int stateModelFrameDeferralDepth;
    private boolean stateModelFrameSuppressedDuringDeferral;

    DungeonEditorRuntimeFramePublisher(
            DungeonEditorStore store,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorRuntimeDraftSession draftSession
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        frameFactsAssembler = new DungeonEditorRuntimeFrameFactsAssembler(store);
        this.stateModel.subscribe(ignored -> publishStateModelFrame());
    }

    DungeonEditorRuntimePublication currentPublication() {
        return DungeonEditorRuntimePublication.published(currentFrame());
    }

    Runnable subscribe(Consumer<DungeonEditorRuntimePublication> subscriber) {
        Consumer<DungeonEditorRuntimePublication> safeSubscriber =
                Objects.requireNonNull(subscriber, "subscriber");
        subscribers.add(safeSubscriber);
        return () -> subscribers.remove(safeSubscriber);
    }

    /*
     * This runtime channel is caller-affine: subscriber callbacks run
     * synchronously on the caller of publishCurrentToSubscribers().
     * Thread-bound consumers must route delivery at their own seam.
     */
    void publishCurrentToSubscribers() {
        runtimeFramePublicationCount++;
        DungeonEditorRuntimePublication publication = currentPublication();
        for (Consumer<DungeonEditorRuntimePublication> subscriber : List.copyOf(subscribers)) {
            subscriber.accept(publication);
        }
    }

    <T> StateModelFrameDeferral<T> deferStateModelFramePublication(Supplier<T> action) {
        Supplier<T> safeAction = Objects.requireNonNull(action, "action");
        boolean outermostDeferral = stateModelFrameDeferralDepth == 0;
        if (outermostDeferral) {
            stateModelFrameSuppressedDuringDeferral = false;
        }
        stateModelFrameDeferralDepth++;
        try {
            T result = safeAction.get();
            return new StateModelFrameDeferral<>(result, stateModelFrameSuppressedDuringDeferral);
        } finally {
            stateModelFrameDeferralDepth--;
            if (outermostDeferral) {
                stateModelFrameSuppressedDuringDeferral = false;
            }
        }
    }

    void markDraftSessionChanged() {
        store.dispatch(new DungeonEditorAction.MarkDraftSessionChanged());
    }

    void publishDraftSessionChanged() {
        markDraftSessionChanged();
        publishCurrentToSubscribers();
    }

    private void publishStateModelFrame() {
        if (stateModelFrameDeferralDepth > 0) {
            stateModelFrameSuppressedDuringDeferral = true;
            return;
        }
        publishCurrentToSubscribers();
    }

    private DungeonEditorRenderFrame currentFrame() {
        DungeonEditorRuntimeReadbackFrameInputs readbackInputs =
                DungeonEditorRuntimeReadbackFrameInputs.from(store, mapSurfaceModel, stateModel);
        verifyCurrentDraftSessionRevision();
        DungeonEditorRuntimeDraftFrame drafts = draftSession.draftFrame(
                readbackInputs.controls(),
                readbackInputs.state());
        return new DungeonEditorRenderFrame(
                frameFactsAssembler.preparedFacts(readbackInputs.mapSurface(), readbackInputs.state(), drafts),
                drafts.inlineLabelEditSession(),
                frameFactsAssembler.measurementSnapshot(runtimeFramePublicationCount));
    }

    private void verifyCurrentDraftSessionRevision() {
        DungeonEditorSelectorResult<Long> revision = store.select(DRAFT_SESSION_REVISION);
        revision.requireFreshAgainst(
                store.state(),
                "Dungeon editor draft-session selector result is stale");
    }

    record StateModelFrameDeferral<T>(T result, boolean stateModelFrameSuppressed) {
    }
}
