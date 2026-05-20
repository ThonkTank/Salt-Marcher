package src.domain.dungeon.model.travel.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSession;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionCommand;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository;

public final class ApplyTravelDungeonSessionUseCase {

    private final TravelDungeonSession session;
    private final TravelDungeonSessionRepository runtimeAccess;
    private final LoadTravelDungeonSessionSurfaceUseCase loadTravelDungeonSessionSurfaceUseCase;
    private final ApplyTravelDungeonMovementUseCase applyTravelDungeonMovementUseCase;
    private final StabilizeTravelDungeonProjectionUseCase stabilizeTravelDungeonProjectionUseCase;

    public ApplyTravelDungeonSessionUseCase(TravelDungeonSessionRepository runtimeAccess) {
        this.session = new TravelDungeonSession();
        this.runtimeAccess = Objects.requireNonNull(runtimeAccess, "runtimeAccess");
        loadTravelDungeonSessionSurfaceUseCase = new LoadTravelDungeonSessionSurfaceUseCase();
        applyTravelDungeonMovementUseCase = new ApplyTravelDungeonMovementUseCase();
        stabilizeTravelDungeonProjectionUseCase = new StabilizeTravelDungeonProjectionUseCase();
    }

    public void primeRequestedPosition(@Nullable PositionData position) {
        session.primeRequestedPosition(position);
    }

    public SnapshotData applyCommand(
            String actionToken,
            String actionId,
            int projectionLevel,
            String overlayModeKey,
            int overlayLevelRange,
            double overlayOpacity,
            List<Integer> overlaySelectedLevels
    ) {
        return apply(new TravelDungeonSessionCommand(
                action(actionToken),
                actionId,
                projectionLevel,
                overlayModeKey,
                overlayLevelRange,
                overlayOpacity,
                overlaySelectedLevels));
    }

    private SnapshotData apply(TravelDungeonSessionCommand command) {
        TravelDungeonSessionCommand safeCommand = Objects.requireNonNull(command, "command");
        return switch (safeCommand.action()) {
            case REFRESH -> refresh();
            case ACTION -> move(safeCommand.actionId());
            case SET_PROJECTION_LEVEL -> setProjectionLevel(safeCommand.projectionLevel());
            case SET_OVERLAY -> setOverlay(
                    safeCommand.overlayModeKey(),
                    safeCommand.overlayLevelRange(),
                    safeCommand.overlayOpacity(),
                    safeCommand.overlaySelectedLevels());
        };
    }

    private SnapshotData refresh() {
        session.applySurface(loadTravelDungeonSessionSurfaceUseCase.load(runtimeAccess, session.currentPosition()));
        stabilizeProjectionLevel();
        return snapshot();
    }

    private SnapshotData move(String actionId) {
        session.applySurface(applyTravelDungeonMovementUseCase.move(runtimeAccess, session.currentPosition(), actionId));
        stabilizeProjectionLevel();
        return snapshot();
    }

    private SnapshotData setProjectionLevel(int nextProjectionLevel) {
        session.setProjectionLevel(nextProjectionLevel);
        stabilizeProjectionLevel();
        return snapshot();
    }

    private SnapshotData setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        session.setOverlay(modeKey, levelRange, opacity, selectedLevels);
        return snapshot();
    }

    public SnapshotData snapshot() {
        if (!session.hasCurrentSurface()) {
            session.applySurface(loadTravelDungeonSessionSurfaceUseCase.load(runtimeAccess, session.requestedPosition()));
        }
        stabilizeProjectionLevel();
        return session.snapshot();
    }

    private void stabilizeProjectionLevel() {
        StabilizeTravelDungeonProjectionUseCase.ProjectionLevelState projectionLevelState =
                stabilizeTravelDungeonProjectionUseCase.stabilize(
                        session.currentSurface(),
                        session.projectionLevel(),
                        session.projectionLevelInitialized());
        session.stabilizeProjectionLevel(projectionLevelState.level(), projectionLevelState.initialized());
    }

    private static TravelDungeonSessionCommand.Action action(String actionToken) {
        String token = Objects.requireNonNull(actionToken, "actionToken").trim();
        return switch (token) {
            case "REFRESH" -> TravelDungeonSessionCommand.Action.REFRESH;
            case "ACTION" -> TravelDungeonSessionCommand.Action.ACTION;
            case "SET_PROJECTION_LEVEL" -> TravelDungeonSessionCommand.Action.SET_PROJECTION_LEVEL;
            case "SET_OVERLAY" -> TravelDungeonSessionCommand.Action.SET_OVERLAY;
            default -> throw new IllegalArgumentException("Unknown travel dungeon session action: " + token);
        };
    }
}
