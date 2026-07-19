package features.sessiongeneration;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import features.sessiongeneration.adapter.sqlite.persistence.SqliteGenerationRunRepository;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessiongeneration.application.SessionGenerationService;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import platform.execution.ExecutionLane;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;

import java.util.Objects;

public final class SessionGenerationServiceAssembly {

    private SessionGenerationServiceAssembly() {
    }

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteGenerationRunRepository.storeDefinition();
    }

    public static SessionGenerationApi create(
            FeatureStoreHandle store,
            ExecutionLane cpuLane,
            ExecutionLane ioLane
    ) {
        return new SessionGenerationService(
                new TsvGenerationCatalog(),
                new SqliteGenerationRunRepository(store),
                new SessionGenerationEngine(),
                Objects.requireNonNull(cpuLane, "cpuLane"),
                Objects.requireNonNull(ioLane, "ioLane"));
    }
}
