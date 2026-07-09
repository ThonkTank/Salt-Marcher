package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts.SelectedAction;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSession;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionCommand;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;

public final class ApplyTravelDungeonSessionUseCase {

    private static final long NO_MAP_ID = 0L;

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

    public SnapshotData applyCommand(TravelDungeonSessionCommand command) {
        return apply(command);
    }

    private SnapshotData apply(TravelDungeonSessionCommand command) {
        TravelDungeonSessionCommand safeCommand = Objects.requireNonNull(command, "command");
        TravelDungeonSessionCommand.Variant variant = safeCommand.variant();
        if (variant instanceof TravelDungeonSessionCommand.Refresh) {
            return refresh();
        }
        if (variant instanceof TravelDungeonSessionCommand.TravelAction travelAction) {
            return move(travelAction.selectedAction());
        }
        if (variant instanceof TravelDungeonSessionCommand.SelectMap selectMap) {
            return selectMap(selectMap.mapIdValue());
        }
        if (variant instanceof TravelDungeonSessionCommand.SetProjectionLevel setProjectionLevel) {
            return setProjectionLevel(setProjectionLevel.projectionLevel());
        }
        if (variant instanceof TravelDungeonSessionCommand.ShiftProjectionLevel shiftProjectionLevel) {
            return setProjectionLevel(session.projectionLevel() + shiftProjectionLevel.projectionLevelShift());
        }
        if (variant instanceof TravelDungeonSessionCommand.SetOverlay setOverlay) {
            return setOverlay(
                    setOverlay.overlayModeKey(),
                    setOverlay.overlayLevelRange(),
                    setOverlay.overlayOpacity(),
                    setOverlay.overlaySelectedLevels());
        }
        throw new IllegalStateException("Unhandled travel dungeon session command: " + variant);
    }

    private SnapshotData refresh() {
        session.applySurface(loadTravelDungeonSessionSurfaceUseCase.loadOrInitialize(session.currentPosition()));
        return snapshot();
    }

    private SnapshotData move(SelectedAction selectedAction) {
        session.applySurface(applyTravelDungeonMovementUseCase.move(
                session.currentPosition(),
                session.currentSurface(),
                selectedAction));
        return snapshot();
    }

    private SnapshotData selectMap(String mapIdValue) {
        long mapId = parseMapId(mapIdValue);
        if (mapId <= NO_MAP_ID) {
            return snapshot();
        }
        session.applySurface(loadTravelDungeonSessionSurfaceUseCase.loadOrInitialize(
                LoadTravelDungeonSessionSurfaceUseCase.Input.selectedMap(mapId)));
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
            session.applySurface(loadTravelDungeonSessionSurfaceUseCase.loadOrInitialize((PositionData) null));
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

    private static long parseMapId(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            return 0L;
        }
    }
}
