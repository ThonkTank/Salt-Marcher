package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Supplier;
import platform.execution.ExecutionLane;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.DungeonEditorStateSnapshot;

final class DungeonEditorRuntimeFramePublisher {
    private static final long MIN_DRAFT_SESSION_REVISION = 0L;

    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final ExecutionLane executionLane;
    private final DungeonEditorRuntimeFrameFactsAssembler frameFactsAssembler =
            new DungeonEditorRuntimeFrameFactsAssembler();
    private final List<Consumer<DungeonEditorRenderFrame>> subscribers = new ArrayList<>();
    private volatile DungeonEditorRenderFrame latestFrame;
    private DungeonEditorStateSnapshot lastPublishedState;
    private long runtimeFramePublicationCount;
    private long draftSessionRevision;
    private int stateModelFrameDeferralDepth;
    private boolean stateModelFrameSuppressedDuringDeferral;

    DungeonEditorRuntimeFramePublisher(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorRuntimeDraftSession draftSession,
            ExecutionLane executionLane
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        latestFrame = assembleCurrentFrame();
        lastPublishedState = this.stateModel.current();
        this.stateModel.subscribe(ignored -> executeIfOpen(this::publishStateModelFrame));
    }

    Runnable subscribe(Consumer<DungeonEditorRenderFrame> subscriber) {
        Consumer<DungeonEditorRenderFrame> safeSubscriber =
                Objects.requireNonNull(subscriber, "subscriber");
        AtomicBoolean active = new AtomicBoolean(true);
        DungeonEditorRenderFrame frameAtRequest = latestFrame;
        executeIfOpen(() -> {
            if (active.get()) {
                subscribers.add(safeSubscriber);
                if (latestFrame != frameAtRequest) {
                    safeSubscriber.accept(latestFrame);
                }
            }
        });
        return () -> {
            if (active.compareAndSet(true, false)) {
                executeIfOpen(() -> subscribers.remove(safeSubscriber));
            }
        };
    }

    /*
     * This runtime channel is execution-lane-affine. Thread-bound consumers
     * receive only the completed immutable frame and route it at their seam.
     */
    void publishCurrentToSubscribers() {
        runtimeFramePublicationCount++;
        DungeonEditorRenderFrame frame = assembleCurrentFrame();
        latestFrame = frame;
        lastPublishedState = stateModel.current();
        for (Consumer<DungeonEditorRenderFrame> subscriber : List.copyOf(subscribers)) {
            subscriber.accept(frame);
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
        draftSessionRevision++;
    }

    void publishDraftSessionChanged() {
        markDraftSessionChanged();
        publishCurrentToSubscribers();
    }

    private void publishStateModelFrame() {
        if (Objects.equals(lastPublishedState, stateModel.current())) {
            return;
        }
        if (stateModelFrameDeferralDepth > 0) {
            stateModelFrameSuppressedDuringDeferral = true;
            return;
        }
        publishCurrentToSubscribers();
    }

    DungeonEditorRenderFrame currentFrame() {
        return latestFrame;
    }

    private DungeonEditorRenderFrame assembleCurrentFrame() {
        DungeonEditorRuntimeReadbackFrameInputs readbackInputs =
                DungeonEditorRuntimeReadbackFrameInputs.from(controlsModel, mapSurfaceModel, stateModel);
        verifyCurrentDraftSessionRevision();
        DungeonEditorRuntimeDraftFrame drafts = draftSession.draftFrame(
                readbackInputs.controls(),
                readbackInputs.state());
        return new DungeonEditorRenderFrame(
                frameFactsAssembler.preparedFacts(
                        readbackInputs.controls(),
                        readbackInputs.mapSurface(),
                        readbackInputs.state(),
                        drafts),
                drafts.inlineLabelEditSession(),
                frameFactsAssembler.measurementSnapshot(runtimeFramePublicationCount));
    }

    private void executeIfOpen(Runnable work) {
        try {
            executionLane.execute(work);
        } catch (RejectedExecutionException ignored) {
            // A queued JavaFX model callback may arrive after application shutdown closed the lane.
        }
    }

    private void verifyCurrentDraftSessionRevision() {
        if (draftSessionRevision < MIN_DRAFT_SESSION_REVISION) {
            throw new IllegalStateException("Dungeon editor draft-session revision overflow");
        }
    }

    record StateModelFrameDeferral<T>(T result, boolean stateModelFrameSuppressed) {
    }
}
