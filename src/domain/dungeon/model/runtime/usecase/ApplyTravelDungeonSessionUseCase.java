package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSession;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionCommand;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot.SnapshotData;

public final class ApplyTravelDungeonSessionUseCase {

    private final TravelDungeonSession session;
    private final LoadTravelDungeonSessionSurfaceUseCase loadTravelDungeonSessionSurfaceUseCase;
    private final ApplyTravelDungeonMovementUseCase applyTravelDungeonMovementUseCase;
    private final StabilizeTravelDungeonProjectionUseCase stabilizeTravelDungeonProjectionUseCase;

    public ApplyTravelDungeonSessionUseCase(
            LoadTravelDungeonSessionSurfaceUseCase loadTravelDungeonSessionSurfaceUseCase,
            ApplyTravelDungeonMovementUseCase applyTravelDungeonMovementUseCase,
            StabilizeTravelDungeonProjectionUseCase stabilizeTravelDungeonProjectionUseCase
    ) {
        this.session = new TravelDungeonSession();
        this.loadTravelDungeonSessionSurfaceUseCase =
                Objects.requireNonNull(loadTravelDungeonSessionSurfaceUseCase, "loadTravelDungeonSessionSurfaceUseCase");
        this.applyTravelDungeonMovementUseCase =
                Objects.requireNonNull(applyTravelDungeonMovementUseCase, "applyTravelDungeonMovementUseCase");
        this.stabilizeTravelDungeonProjectionUseCase =
                Objects.requireNonNull(stabilizeTravelDungeonProjectionUseCase, "stabilizeTravelDungeonProjectionUseCase");
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
        session.applySurface(loadTravelDungeonSessionSurfaceUseCase.loadOrInitialize(session.currentPosition()));
        return snapshot();
    }

    private SnapshotData move(String actionId) {
        session.applySurface(applyTravelDungeonMovementUseCase.move(
                session.currentPosition(),
                session.currentSurface(),
                actionId));
        return snapshot();
    }

    private SnapshotData setProjectionLevel(int nextProjectionLevel) {
        session.setProjectionLevel(nextProjectionLevel);
        return snapshot();
    }

    private SnapshotData setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        session.setOverlay(modeKey, levelRange, opacity, selectedLevels);
        return snapshot();
    }

    public SnapshotData snapshot() {
        if (!session.hasCurrentSurface()) {
            session.applySurface(loadTravelDungeonSessionSurfaceUseCase.loadOrInitialize(null));
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
