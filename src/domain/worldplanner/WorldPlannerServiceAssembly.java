package src.domain.worldplanner;

import java.util.Objects;
import src.domain.worldplanner.model.world.port.WorldPlannerReferencePort;
import src.domain.worldplanner.model.world.repository.WorldPlannerRepository;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class WorldPlannerServiceAssembly {

    private static final String LOAD_FAILURE = "World Planner konnte nicht geladen werden.";

    private final WorldPlannerRepository repository;
    private final WorldPlannerReferencePort referenceValidator;
    private final WorldPlannerSnapshotModel snapshotModel = new WorldPlannerSnapshotModel();
    private boolean initialSnapshotPublished;

    WorldPlannerServiceAssembly(
            WorldPlannerRepository repository,
            WorldPlannerReferencePort referenceValidator
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.referenceValidator = Objects.requireNonNull(referenceValidator, "referenceValidator");
    }

    WorldPlannerApplicationService createApplicationService() {
        publishInitialSnapshot();
        return new WorldPlannerApplicationService(repository, referenceValidator, snapshotModel);
    }

    WorldPlannerSnapshotModel snapshotModel() {
        publishInitialSnapshot();
        return snapshotModel;
    }

    private void publishInitialSnapshot() {
        if (initialSnapshotPublished) {
            return;
        }
        try {
            snapshotModel.publish(WorldPlannerSnapshotProjection.from(repository.load()));
        } catch (IllegalStateException exception) {
            snapshotModel.publishStorageError(LOAD_FAILURE);
        }
        initialSnapshotPublished = true;
    }
}
