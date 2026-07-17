package features.dungeon.application.editor;

import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import platform.execution.ExecutionLane;

/** Execution-lane owner for immutable atomic Dungeon Editor state publications. */
final class DungeonEditorStatePublisher {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final ExecutionLane executionLane;
    private final DungeonEditorStateAssembler assembler = new DungeonEditorStateAssembler();
    private final List<Consumer<DungeonEditorState>> subscribers = new ArrayList<>();
    private volatile DungeonEditorState latestState;
    private DungeonEditorToolSelection toolSelection;
    private boolean publicationPending;
    private long publicationRevision;

    DungeonEditorStatePublisher(
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
        toolSelection = DungeonEditorLegacyToolAdapter.selection(controlsModel.current().selectedTool());
        latestState = assembleCurrentState();
    }

    Runnable subscribe(Consumer<DungeonEditorState> subscriber) {
        Consumer<DungeonEditorState> safeSubscriber = Objects.requireNonNull(subscriber, "subscriber");
        AtomicBoolean active = new AtomicBoolean(true);
        DungeonEditorState stateAtRequest = latestState;
        executeIfOpen(() -> {
            if (active.get()) {
                subscribers.add(safeSubscriber);
                if (latestState != stateAtRequest) {
                    safeSubscriber.accept(latestState);
                }
            }
        });
        return () -> {
            if (active.compareAndSet(true, false)) {
                executeIfOpen(() -> subscribers.remove(safeSubscriber));
            }
        };
    }

    void publishCurrentToSubscribers() {
        publicationRevision++;
        latestState = assembleCurrentState();
        publicationPending = false;
        for (Consumer<DungeonEditorState> subscriber : List.copyOf(subscribers)) {
            subscriber.accept(latestState);
        }
    }

    void publishDraftSessionChanged() {
        publishCurrentToSubscribers();
    }

    void markDraftSessionChanged() {
        // Draft mutation is assembled into the next atomic state publication.
    }

    void selectTool(DungeonEditorToolSelection selection) {
        DungeonEditorToolSelection safeSelection = selection == null
                ? DungeonEditorToolSelection.select()
                : selection;
        if (!safeSelection.equals(toolSelection)) {
            toolSelection = safeSelection;
            publicationPending = true;
        }
    }

    boolean publicationPending() {
        return publicationPending;
    }

    DungeonEditorState currentState() {
        return latestState;
    }

    private DungeonEditorState assembleCurrentState() {
        DungeonEditorRuntimeReadbackFrameInputs readback = DungeonEditorRuntimeReadbackFrameInputs.from(
                controlsModel, mapSurfaceModel, stateModel);
        return assembler.assemble(
                publicationRevision,
                readback.controls(),
                readback.mapSurface(),
                readback.state(),
                draftSession.draftFrame(readback.controls(), readback.state()),
                toolSelection);
    }

    private void executeIfOpen(Runnable work) {
        try {
            executionLane.execute(work);
        } catch (RejectedExecutionException ignored) {
            // A queued callback may arrive after application shutdown closed the lane.
        }
    }
}
