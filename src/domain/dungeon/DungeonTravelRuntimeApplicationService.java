package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.model.travel.helper.TravelDungeonSnapshotHelper;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;

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

    TravelDungeonModel travelModel() {
        return dungeonTravelModel;
    }

    public void applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        Objects.requireNonNull(command, "command");
        switch (command.action()) {
            case REFRESH -> applyTravelDungeonSessionUseCase.refresh();
            case ACTION -> applyTravelDungeonSessionUseCase.move(command.actionId());
            case SET_PROJECTION_LEVEL ->
                    applyTravelDungeonSessionUseCase.setProjectionLevel(command.projectionLevel());
            case SET_OVERLAY -> {
                DungeonOverlaySettings overlaySettings = command.overlaySettings();
                applyTravelDungeonSessionUseCase.setOverlay(
                        overlaySettings.modeKey(),
                        overlaySettings.levelRange(),
                        overlaySettings.opacity(),
                        overlaySettings.selectedLevels());
            }
            default -> throw new IllegalStateException("Unsupported travel action: " + command.action());
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
