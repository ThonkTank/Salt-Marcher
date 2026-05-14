package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.model.travel.application.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.model.travel.model.session.helper.TravelDungeonSnapshotHelper;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.LoadTravelDungeonQuery;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.dungeon.published.TravelOverlaySettings;

/**
 * Public backend facade for runtime travel composition.
 */
public final class DungeonTravelRuntimeApplicationService {

    private final ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase;
    private final List<Consumer<TravelDungeonSnapshot>> dungeonTravelListeners = new ArrayList<>();
    private final TravelDungeonModel dungeonTravelModel = new TravelDungeonModel(
            this::currentDungeonTravelSnapshot,
            this::subscribeDungeonTravelListener);

    public DungeonTravelRuntimeApplicationService(ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase) {
        this.applyTravelDungeonSessionUseCase =
                Objects.requireNonNull(applyTravelDungeonSessionUseCase, "applyTravelDungeonSessionUseCase");
    }

    public TravelDungeonModel loadDungeonTravel(LoadTravelDungeonQuery query) {
        Objects.requireNonNullElse(query, new LoadTravelDungeonQuery());
        return dungeonTravelModel;
    }

    public void applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
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
    }

    private TravelDungeonSnapshot currentDungeonTravelSnapshot() {
        return TravelDungeonSnapshotHelper.toPublishedSnapshot(applyTravelDungeonSessionUseCase.snapshot());
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
