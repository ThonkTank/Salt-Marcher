package features.sessiongeneration;

import features.sessiongeneration.adapter.resource.TsvGenerationCatalog;
import features.sessiongeneration.adapter.sqlite.persistence.SqliteGenerationRunRepository;
import features.sessiongeneration.api.SessionGenerationApi;
import features.sessiongeneration.application.SessionGenerationService;
import features.sessiongeneration.domain.generation.SessionGenerationEngine;
import java.util.Objects;
import platform.execution.ExecutionLane;
import platform.persistence.SqliteDatabase;
import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;

public final class SessionGenerationServiceAssembly {

    private SessionGenerationServiceAssembly() {
    }

    public static SessionGenerationApi create(
            SqliteDatabase database,
            ExecutionLane cpuLane,
            ExecutionLane ioLane
    ) {
        return create(database, cpuLane, ioLane, NoopDiagnostics.INSTANCE);
    }

    public static SessionGenerationApi create(
            SqliteDatabase database,
            ExecutionLane cpuLane,
            ExecutionLane ioLane,
            Diagnostics diagnostics
    ) {
        return new SessionGenerationService(
                new TsvGenerationCatalog(),
                new SqliteGenerationRunRepository(
                        Objects.requireNonNull(database, "database"),
                        Objects.requireNonNull(diagnostics, "diagnostics")),
                new SessionGenerationEngine(),
                Objects.requireNonNull(cpuLane, "cpuLane"),
                Objects.requireNonNull(ioLane, "ioLane"));
    }
}
