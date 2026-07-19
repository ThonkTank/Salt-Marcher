package features.sessionplanner.adapter.sqlite.gateway.local;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.sessionplanner.adapter.sqlite.repository.SqliteSessionPlanRepository;
import features.sessionplanner.domain.session.EncounterDays;
import features.sessionplanner.domain.session.SessionEncounter;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionGeneratedRewardReference;
import features.sessionplanner.domain.session.SessionManualLootNote;
import features.sessionplanner.domain.session.SessionPlan;
import features.sessionplanner.domain.session.SessionRestPlacement;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteDatabase;
import platform.persistence.TestFeatureStores;

final class SessionPlannerWorkspaceSqliteReadTest {

    private static final int WORKSPACE_STATEMENT_FAMILIES = 7;

    @TempDir
    Path temporaryDirectory;

    @Test
    void emptyV3WorkspaceUsesTheSameFixedStatementFamilies() throws Exception {
        Path path = temporaryDirectory.resolve("empty-workspace.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = TestFeatureStores.store(
                    database, SqliteSessionPlanRepository.storeDefinition());
            new SqliteSessionPlanRepository(store).readWorkspace();

            CountedRead counted = loadCounted(path);

            assertEquals(WORKSPACE_STATEMENT_FAMILIES, counted.statements());
            assertEquals(0L, counted.workspace().currentSessionId());
            assertTrue(counted.workspace().sessions().isEmpty());
        }
    }

    @Test
    void highCardinalityV3WorkspaceReadsEveryChildFamilyWithCardinalityIndependentStatements() throws Exception {
        Path path = temporaryDirectory.resolve("populated-workspace.db");
        try (SqliteDatabase database = new SqliteDatabase(path, NoopDiagnostics.INSTANCE)) {
            var store = TestFeatureStores.store(
                    database, SqliteSessionPlanRepository.storeDefinition());
            SqliteSessionPlanRepository repository = new SqliteSessionPlanRepository(store);
            for (long sessionId = 1L; sessionId <= 64L; sessionId++) {
                repository.insert(completePlan(
                        sessionId, sessionId * 100L, sessionId * 10L, "run-" + sessionId));
            }
            repository.setCurrentSessionId(64L);

            CountedRead counted = loadCounted(path);

            assertEquals(WORKSPACE_STATEMENT_FAMILIES, counted.statements(),
                    "pointer, roots, participants, scenes, rests, notes, and generated rewards");
            assertEquals(64L, counted.workspace().currentSessionId());
            assertEquals(64, counted.workspace().sessions().size());
            counted.workspace().sessions().forEach(snapshot -> {
                assertEquals(2, snapshot.participants().size());
                assertEquals(2, snapshot.encounters().size());
                assertEquals(1, snapshot.rests().size());
                assertEquals(1, snapshot.manualLootNotes().size());
                assertEquals(1, snapshot.generatedRewards().size());
            });
        }
    }

    private static SessionPlan completePlan(long sessionId, long firstSceneId, long planId, String runId) {
        long secondSceneId = firstSceneId + 1L;
        List<SessionEncounter> scenes = List.of(
                new SessionEncounter(firstSceneId, planId,
                        new SessionEncounterAllocation(new BigDecimal("40")), "First", "Notes A", 31L),
                new SessionEncounter(secondSceneId, planId + 1L,
                        new SessionEncounterAllocation(new BigDecimal("60")), "Second", "Notes B", 32L));
        return new SessionPlan(
                sessionId, null, "Session " + sessionId, List.of(1L, 2L), EncounterDays.one(), scenes,
                List.of(SessionRestPlacement.shortRestBetween(firstSceneId, secondSceneId)),
                List.of(new SessionManualLootNote(1L, firstSceneId, "Manual")),
                List.of(new SessionGeneratedRewardReference(secondSceneId, runId, 1L, "Fallback")),
                firstSceneId, "", secondSceneId + 1L, 2L);
    }

    private static CountedRead loadCounted(Path path) throws Exception {
        int[] statements = {0};
        Connection real = DriverManager.getConnection("jdbc:sqlite:" + path);
        Connection counted = (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(), new Class<?>[] {Connection.class},
                (proxy, method, arguments) -> {
                    if (method.getName().equals("prepareStatement")) {
                        statements[0]++;
                    }
                    try {
                        return method.invoke(real, arguments);
                    } catch (InvocationTargetException failure) {
                        throw failure.getCause();
                    }
                });
        try (counted) {
            return new CountedRead(new SessionPlanSqliteReads().loadWorkspace(counted), statements[0]);
        }
    }

    private record CountedRead(SqliteSessionPlannerLocalGateway.WorkspaceRead workspace, int statements) {
    }
}
