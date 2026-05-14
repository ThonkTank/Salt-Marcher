package src.domain.dungeon.model.travel.application;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSession;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.repository.TravelDungeonSessionRepository;
import src.domain.dungeon.model.travel.model.session.usecase.ApplyTravelDungeonMovementUseCase;
import src.domain.dungeon.model.travel.model.session.usecase.LoadTravelDungeonSessionSurfaceUseCase;
import src.domain.dungeon.model.travel.model.session.usecase.StabilizeTravelDungeonProjectionUseCase;

public final class ApplyTravelDungeonSessionUseCase {

    private final TravelDungeonSession session;
    private final TravelDungeonSessionRepository runtimeAccess;
    private final LoadTravelDungeonSessionSurfaceUseCase loadTravelDungeonSessionSurfaceUseCase;
    private final ApplyTravelDungeonMovementUseCase applyTravelDungeonMovementUseCase;
    private final StabilizeTravelDungeonProjectionUseCase stabilizeTravelDungeonProjectionUseCase;

    public ApplyTravelDungeonSessionUseCase(TravelDungeonSessionRepository runtimeAccess) {
        this.session = new TravelDungeonSession();
        this.runtimeAccess = runtimeAccess;
        loadTravelDungeonSessionSurfaceUseCase = new LoadTravelDungeonSessionSurfaceUseCase();
        applyTravelDungeonMovementUseCase = new ApplyTravelDungeonMovementUseCase();
        stabilizeTravelDungeonProjectionUseCase = new StabilizeTravelDungeonProjectionUseCase();
    }

    public void primeRequestedPosition(@Nullable PositionData position) {
        session.primeRequestedPosition(position);
    }

    public void refresh() {
        session.applySurface(loadTravelDungeonSessionSurfaceUseCase.load(runtimeAccess, session.currentPosition()));
        stabilizeProjectionLevel();
    }

    public void move(String actionId) {
        session.applySurface(applyTravelDungeonMovementUseCase.move(runtimeAccess, session.currentPosition(), actionId));
        stabilizeProjectionLevel();
    }

    public void setProjectionLevel(int nextProjectionLevel) {
        session.setProjectionLevel(nextProjectionLevel);
        stabilizeProjectionLevel();
    }

    public void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        session.setOverlay(modeKey, levelRange, opacity, selectedLevels);
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
