package features.dungeon.application.travel;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonTravelActionId;
import features.dungeon.api.DungeonTravelMoveOutcome;
import features.dungeon.api.DungeonTravelRejectionReason;
import features.dungeon.api.travel.DungeonTravelApi;
import features.dungeon.application.travel.DungeonTravelNavigator.MovePlan;
import features.dungeon.application.travel.DungeonTravelNavigator.Resolution;
import features.dungeon.application.travel.session.TravelDungeonSession;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.OverlayMode;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.SurfaceData;
import features.party.api.MutationResult;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletionStage;
import org.jspecify.annotations.Nullable;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;

/** Public backend facade for runtime travel composition. */
public final class DungeonTravelRuntimeApplicationService implements DungeonTravelApi {
    private static final long NO_MAP_ID = 0L;

    private final TravelDungeonSession session = new TravelDungeonSession();
    private final DungeonTravelSurfaceLoader surfaceLoader;
    private final DungeonTravelNavigator navigator;
    private final DungeonTravelPublishedState publishedState;
    private final ExecutionLane executionLane;
    private long issuedMoveGeneration;
    private long partyPositionRevision;
    private DungeonTravelMoveOutcome moveOutcome = DungeonTravelMoveOutcome.idle();

    public DungeonTravelRuntimeApplicationService(
            DungeonTravelSurfaceLoader surfaceLoader,
            DungeonTravelNavigator navigator,
            DungeonTravelPublishedState publishedState
    ) {
        this(surfaceLoader, navigator, publishedState, DirectExecutionLane.INSTANCE);
    }

    public DungeonTravelRuntimeApplicationService(
            DungeonTravelSurfaceLoader surfaceLoader,
            DungeonTravelNavigator navigator,
            DungeonTravelPublishedState publishedState,
            ExecutionLane executionLane
    ) {
        this.surfaceLoader = Objects.requireNonNull(surfaceLoader, "surfaceLoader");
        this.navigator = Objects.requireNonNull(navigator, "navigator");
        this.publishedState = Objects.requireNonNull(publishedState, "publishedState");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
    }

    public void refresh() {
        executionLane.execute(this::refreshOnLane);
    }

    private void refreshOnLane() {
        long generation = nextMoveGeneration();
        SurfaceData loaded = surfaceLoader.loadCurrentPosition(session.currentPosition());
        MovePlan initialization = navigator.initialize(loaded, false);
        if (initialization != null) {
            startValidatedMove(generation, initialization);
            return;
        }
        session.applySurface(loaded);
        partyPositionRevision = navigator.currentPartyRevision();
        moveOutcome = DungeonTravelMoveOutcome.idle();
        publishSnapshot();
    }

    public void performAction(DungeonTravelActionId actionId) {
        executionLane.execute(() -> moveOnLane(new DungeonTravelMoveCommand.Action(actionId)));
    }

    public void moveTo(DungeonCellRef target) {
        executionLane.execute(() -> moveOnLane(new DungeonTravelMoveCommand.Direct(target)));
    }

    private void moveOnLane(DungeonTravelMoveCommand command) {
        long generation = nextMoveGeneration();
        MovePlan plan = navigator.validate(
                session.currentPosition(),
                session.currentSurface(),
                command);
        if (!plan.accepted()) {
            session.applySurface(navigator.rejectedSurface(plan));
            partyPositionRevision = plan.activeTravel().positionRevision();
            moveOutcome = DungeonTravelMoveOutcome.rejected(plan.rejectionReason(), generation);
            publishSnapshot();
            return;
        }
        startValidatedMove(generation, plan);
    }

    private void startValidatedMove(long generation, MovePlan plan) {
        session.applySurface(navigator.movingSurface(plan));
        partyPositionRevision = plan.activeTravel().positionRevision();
        moveOutcome = DungeonTravelMoveOutcome.moving(generation);
        publishSnapshot();
        CompletionStage<MutationResult> completion;
        try {
            completion = navigator.execute(plan);
        } catch (RuntimeException exception) {
            resolveMoveOnLane(generation, plan, null, exception);
            return;
        }
        completion.whenComplete((result, failure) -> scheduleResolution(generation, plan, result, failure));
    }

    private void scheduleResolution(
            long generation,
            MovePlan plan,
            @Nullable MutationResult result,
            @Nullable Throwable failure
    ) {
        executionLane.execute(() -> resolveMoveOnLane(generation, plan, result, failure));
    }

    private void resolveMoveOnLane(
            long generation,
            MovePlan plan,
            @Nullable MutationResult result,
            @Nullable Throwable failure
    ) {
        if (generation != issuedMoveGeneration) {
            return;
        }
        Resolution resolution = navigator.resolve(plan, result, failure);
        session.applySurface(resolution.surface());
        partyPositionRevision = resolution.partyPositionRevision();
        moveOutcome = resolution.accepted()
                ? DungeonTravelMoveOutcome.accepted(generation)
                : DungeonTravelMoveOutcome.rejected(resolution.rejectionReason(), generation);
        publishSnapshot();
    }

    public void selectMap(long mapId) {
        executionLane.execute(() -> selectMapOnLane(mapId));
    }

    private void selectMapOnLane(long mapId) {
        long generation = nextMoveGeneration();
        if (mapId <= NO_MAP_ID) {
            moveOutcome = DungeonTravelMoveOutcome.rejected(
                    DungeonTravelRejectionReason.INVALID_INPUT, generation);
            publishSnapshot();
            return;
        }
        SurfaceData loaded = surfaceLoader.loadSelectedMap(mapId);
        MovePlan initialization = navigator.initialize(loaded, true);
        if (initialization != null) {
            startValidatedMove(generation, initialization);
            return;
        }
        session.applySurface(loaded);
        partyPositionRevision = navigator.currentPartyRevision();
        moveOutcome = DungeonTravelMoveOutcome.idle();
        publishSnapshot();
    }

    public void shiftProjectionLevel(int projectionLevelShift) {
        executionLane.execute(() -> shiftProjectionLevelOnLane(projectionLevelShift));
    }

    private void shiftProjectionLevelOnLane(int projectionLevelShift) {
        session.setProjectionLevel(session.projectionLevel() + projectionLevelShift);
        publishSnapshot();
    }

    public void setOverlay(DungeonOverlaySettings overlaySettings) {
        executionLane.execute(() -> setOverlayOnLane(overlaySettings));
    }

    private void setOverlayOnLane(DungeonOverlaySettings overlaySettings) {
        DungeonOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        session.setOverlay(
                OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                selectedLevels(safeOverlay));
        publishSnapshot();
    }

    private void publishSnapshot() {
        if (!session.hasCurrentSurface()) {
            session.applySurface(surfaceLoader.loadCurrentPosition(null));
            partyPositionRevision = navigator.currentPartyRevision();
        }
        session.stabilizeProjectionLevel();
        publishedState.publish(session.snapshot(), moveOutcome, partyPositionRevision);
    }

    private long nextMoveGeneration() {
        issuedMoveGeneration = Math.incrementExact(issuedMoveGeneration);
        return issuedMoveGeneration;
    }

    private static List<Integer> selectedLevels(DungeonOverlaySettings overlaySettings) {
        return overlaySettings == null ? List.of() : overlaySettings.selectedLevels();
    }
}
