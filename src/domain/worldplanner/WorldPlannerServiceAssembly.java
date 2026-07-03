package src.domain.worldplanner;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import src.domain.worldplanner.model.world.WorldPlannerState;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;
import src.domain.worldplanner.model.world.usecase.LoadWorldPlannerUseCase;
import src.domain.worldplanner.published.WorldFactionInventoryLimitSummary;
import src.domain.worldplanner.published.WorldFactionSummary;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class WorldPlannerServiceAssembly {

    private final WorldPlannerRepository repository;
    private final WorldPlannerReferencePort referenceValidator;
    private final WorldPlannerPublisher publisher = new WorldPlannerPublisher();
    private boolean initialSnapshotPublished;

    WorldPlannerServiceAssembly(
            WorldPlannerRepository repository,
            WorldPlannerReferencePort referenceValidator
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
    }

    WorldPlannerApplicationService createApplicationService() {
        WorldPlannerApplicationService service =
                new WorldPlannerUseCaseServiceAssembly(
                        new PublishingWorldPlannerRepository(repository, publisher),
                        referenceValidator)
                        .createApplicationService();
        publishInitialSnapshot();
        return service;
    }

    WorldPlannerSnapshotModel snapshotModel() {
        publishInitialSnapshot();
        return publisher.model;
    }

    private void publishInitialSnapshot() {
        if (!initialSnapshotPublished) {
            publishCurrent();
            initialSnapshotPublished = true;
        }
    }

    private void publishCurrent() {
        try {
            publisher.publish(new LoadWorldPlannerUseCase(repository).execute());
        } catch (IllegalStateException exception) {
            publisher.publishStorageError("World Planner konnte nicht geladen werden.");
        }
    }

    static final class WorldPlannerPublisher {

        private static final String LISTENER_PARAMETER = "listener";

        private final List<Consumer<WorldPlannerSnapshot>> listeners = new ArrayList<>();
        private WorldPlannerSnapshot current =
                new WorldPlannerSnapshot(WorldPlannerReadStatus.SUCCESS, List.of(), List.of(), List.of(), "");

        final WorldPlannerSnapshotModel model = new WorldPlannerSnapshotModel(this::current, this::subscribe);

        void publish(WorldPlannerState state) {
            WorldPlannerState safeState = state == null ? WorldPlannerState.empty() : state;
            current = new WorldPlannerSnapshot(
                    WorldPlannerReadStatus.SUCCESS,
                    safeState.npcs().stream()
                            .map(npc -> new WorldNpcSummary(
                                    npc.npcId(),
                                    npc.displayName(),
                                    npc.creatureStatblockId(),
                                    npc.appearanceNotes(),
                                    npc.behaviorNotes(),
                                    npc.historyNotes(),
                                    npc.generalNotes(),
                                    WorldNpcLifecycleStatus.fromName(npc.status().name())))
                            .toList(),
                    safeState.factions().stream()
                            .map(faction -> new WorldFactionSummary(
                                    faction.factionId(),
                                    faction.displayName(),
                                    faction.notes(),
                                    faction.primaryEncounterTableId(),
                                    faction.npcIds(),
                                    faction.inventoryLimits().stream()
                                            .map(limit -> new WorldFactionInventoryLimitSummary(
                                                    limit.creatureStatblockId(),
                                                    limit.finite(),
                                                    limit.quantity()))
                                            .toList()))
                            .toList(),
                    safeState.locations().stream()
                            .map(location -> new WorldLocationSummary(
                                    location.locationId(),
                                    location.displayName(),
                                    location.notes(),
                                    location.factionIds(),
                                    location.encounterTableIds()))
                            .toList(),
                    safeState.statusText());
            notifyListeners();
        }

        void publishStorageError(String message) {
            current = new WorldPlannerSnapshot(
                    WorldPlannerReadStatus.STORAGE_ERROR,
                    current.npcs(),
                    current.factions(),
                    current.locations(),
                    message == null || message.isBlank()
                            ? "World Planner konnte nicht geladen werden."
                            : message);
            notifyListeners();
        }

        private void notifyListeners() {
            for (Consumer<WorldPlannerSnapshot> listener : List.copyOf(listeners)) {
                listener.accept(current);
            }
        }

        private WorldPlannerSnapshot current() {
            return current;
        }

        private Runnable subscribe(Consumer<WorldPlannerSnapshot> listener) {
            Consumer<WorldPlannerSnapshot> safeListener = Objects.requireNonNull(listener, LISTENER_PARAMETER);
            listeners.add(safeListener);
            return () -> listeners.remove(safeListener);
        }
    }

    private static final class PublishingWorldPlannerRepository implements WorldPlannerRepository {

        private final WorldPlannerRepository delegate;
        private final WorldPlannerPublisher publisher;

        private PublishingWorldPlannerRepository(
                WorldPlannerRepository delegate,
                WorldPlannerPublisher publisher
        ) {
            this.delegate = Objects.requireNonNull(delegate, "delegate");
            this.publisher = Objects.requireNonNull(publisher, "publisher");
        }

        @Override
        public WorldPlannerState load() {
            try {
                WorldPlannerState state = delegate.load();
                publisher.publish(state);
                return state;
            } catch (IllegalStateException exception) {
                publisher.publishStorageError("World Planner konnte nicht geladen werden.");
                throw exception;
            }
        }

        @Override
        public WorldPlannerState save(WorldPlannerState state) {
            try {
                WorldPlannerState savedState = delegate.save(state);
                publisher.publish(savedState);
                return savedState;
            } catch (IllegalStateException exception) {
                publisher.publishStorageError("World Planner konnte nicht gespeichert werden.");
                throw exception;
            }
        }
    }

}
