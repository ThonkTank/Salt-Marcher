package features.sessiongeneration;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import features.sessiongeneration.adapter.sqlite.persistence.SqliteGenerationRunRepository;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessiongeneration.application.SessionGenerationService;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.util.Objects;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;

public final class SessionGenerationServiceAssembly {

    private SessionGenerationServiceAssembly() {
    }

    public static SessionGenerationApi create(SqliteDatabase database, ExecutionLane executionLane) {
        return new SessionGenerationService(
                new TsvGenerationCatalog(),
                new SqliteGenerationRunRepository(Objects.requireNonNull(database, "database")),
                new SessionGenerationEngine(),
                Objects.requireNonNull(executionLane, "executionLane"));
    }
}
