package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSession;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionCommand;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.worldspace.repository.TravelDungeonSessionRepository;

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
                actionToken,
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
            case "REFRESH" -> refresh();
            case "ACTION" -> move(safeCommand.actionId());
            case "SET_PROJECTION_LEVEL" -> setProjectionLevel(safeCommand.projectionLevel());
            case "SET_OVERLAY" -> setOverlay(
                    safeCommand.overlayModeKey(),
                    safeCommand.overlayLevelRange(),
                    safeCommand.overlayOpacity(),
                    safeCommand.overlaySelectedLevels());
            default -> throw new IllegalArgumentException(
                    "Unknown travel dungeon session action: " + safeCommand.action());
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
}
