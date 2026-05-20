package src.domain.dungeon.model.travel.usecase;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSession;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository;

public final class ApplyTravelDungeonSessionUseCase {

    private final TravelDungeonSession session;
    private final TravelDungeonSessionRepository runtimeAccess;
    private final SessionPublication publication;
    private final LoadTravelDungeonSessionSurfaceUseCase loadTravelDungeonSessionSurfaceUseCase;
    private final ApplyTravelDungeonMovementUseCase applyTravelDungeonMovementUseCase;
    private final StabilizeTravelDungeonProjectionUseCase stabilizeTravelDungeonProjectionUseCase;

    public ApplyTravelDungeonSessionUseCase(TravelDungeonSessionRepository runtimeAccess) {
        this(runtimeAccess, snapshot -> { });
    }

    public ApplyTravelDungeonSessionUseCase(
            TravelDungeonSessionRepository runtimeAccess,
            SessionPublication publication
    ) {
        this.session = new TravelDungeonSession();
        this.runtimeAccess = runtimeAccess;
        this.publication = publication == null ? snapshot -> { } : publication;
        loadTravelDungeonSessionSurfaceUseCase = new LoadTravelDungeonSessionSurfaceUseCase();
        applyTravelDungeonMovementUseCase = new ApplyTravelDungeonMovementUseCase();
        stabilizeTravelDungeonProjectionUseCase = new StabilizeTravelDungeonProjectionUseCase();
    }

    public void apply(SessionCommand command) {
        SessionCommand safeCommand = command == null ? SessionCommand.refresh() : command;
        switch (safeCommand.action()) {
            case REFRESH -> refresh();
            case ACTION -> move(safeCommand.actionId());
            case SET_PROJECTION_LEVEL -> setProjectionLevel(safeCommand.projectionLevel());
            case SET_OVERLAY -> setOverlay(
                    safeCommand.overlayModeKey(),
                    safeCommand.overlayLevelRange(),
                    safeCommand.overlayOpacity(),
                    safeCommand.overlaySelectedLevels());
        }
        publication.publishSessionSnapshot(snapshot());
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

    public enum SessionAction {
        REFRESH,
        ACTION,
        SET_PROJECTION_LEVEL,
        SET_OVERLAY
    }

    public record SessionCommand(
            SessionAction action,
            String actionId,
            int projectionLevel,
            String overlayModeKey,
            int overlayLevelRange,
            double overlayOpacity,
            List<Integer> overlaySelectedLevels
    ) {
        public SessionCommand {
            action = action == null ? SessionAction.REFRESH : action;
            actionId = actionId == null ? "" : actionId.trim();
            overlayModeKey = overlayModeKey == null ? "" : overlayModeKey.trim();
            overlayLevelRange = Math.max(0, overlayLevelRange);
            overlayOpacity = Math.max(0.0, Math.min(1.0, overlayOpacity));
            overlaySelectedLevels = overlaySelectedLevels == null ? List.of() : List.copyOf(overlaySelectedLevels);
        }

        private static SessionCommand refresh() {
            return new SessionCommand(SessionAction.REFRESH, "", 0, "", 0, 0.0, List.of());
        }

        @Override
        public List<Integer> overlaySelectedLevels() {
            return List.copyOf(overlaySelectedLevels);
        }
    }

    public interface SessionPublication {
        void publishSessionSnapshot(SnapshotData snapshot);
    }
}
