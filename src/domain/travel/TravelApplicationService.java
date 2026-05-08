package src.domain.travel;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;
import src.domain.travel.application.TravelDungeonRuntimeAccess;
import src.domain.travel.application.TravelDungeonSnapshotProjector;
import src.domain.travel.published.ApplyTravelDungeonSessionCommand;
import src.domain.travel.published.LoadTravelDungeonQuery;
import src.domain.travel.published.TravelDungeonModel;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelOverlaySettings;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.travel.session.port.TravelPartyStateRepository;

/**
 * Public backend facade for runtime travel composition.
 */
public final class TravelApplicationService {

    private final ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase;
    private final List<Consumer<TravelDungeonSnapshot>> dungeonTravelListeners = new ArrayList<>();
    private final TravelDungeonModel dungeonTravelModel = new TravelDungeonModel(
            this::currentDungeonTravelSnapshot,
            this::subscribeDungeonTravelListener);

    public TravelApplicationService(
            TravelPartyStateRepository partyStateRepository,
            DungeonApplicationService dungeonApplicationService
    ) {
        this.applyTravelDungeonSessionUseCase = new ApplyTravelDungeonSessionUseCase(
                new TravelDungeonRuntimeAccess(partyStateRepository, dungeonApplicationService));
    }

    public TravelDungeonModel loadDungeonTravel(LoadTravelDungeonQuery query) {
        Objects.requireNonNullElse(query, new LoadTravelDungeonQuery());
        return dungeonTravelModel;
    }

    public TravelDungeonSnapshot applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        ApplyTravelDungeonSessionCommand effectiveCommand = command == null
                ? new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.REFRESH,
                "",
                0,
                TravelOverlaySettings.defaults())
                : command;
        switch (effectiveCommand.action()) {
            case REFRESH -> applyTravelDungeonSessionUseCase.refresh();
            case ACTION -> applyTravelDungeonSessionUseCase.move(effectiveCommand.actionId());
            case SET_PROJECTION_LEVEL ->
                    applyTravelDungeonSessionUseCase.setProjectionLevel(effectiveCommand.projectionLevel());
            case SET_OVERLAY -> {
                TravelOverlaySettings overlaySettings = effectiveCommand.overlaySettings();
                applyTravelDungeonSessionUseCase.setOverlay(
                        overlaySettings.modeKey(),
                        overlaySettings.levelRange(),
                        overlaySettings.opacity(),
                        overlaySettings.selectedLevels());
            }
            default -> throw new IllegalStateException("Unsupported travel action: " + effectiveCommand.action());
        }
        TravelDungeonSnapshot snapshot = currentDungeonTravelSnapshot();
        notifyDungeonTravelListeners(snapshot);
        return snapshot;
    }

    private TravelDungeonSnapshot currentDungeonTravelSnapshot() {
        return TravelDungeonSnapshotProjector.toPublishedSnapshot(applyTravelDungeonSessionUseCase.snapshot());
    }

    private Runnable subscribeDungeonTravelListener(Consumer<TravelDungeonSnapshot> listener) {
        Consumer<TravelDungeonSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        dungeonTravelListeners.add(safeListener);
        return () -> dungeonTravelListeners.remove(safeListener);
    }

    private void notifyDungeonTravelListeners(TravelDungeonSnapshot snapshot) {
        List<Consumer<TravelDungeonSnapshot>> listeners = List.copyOf(dungeonTravelListeners);
        for (Consumer<TravelDungeonSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }
}
