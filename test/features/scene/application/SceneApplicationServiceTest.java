package features.scene.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.encounter.api.EncounterRuntimeContextApi;
import features.encounter.api.EncounterRuntimeContextSyncResult;
import features.encounter.api.SynchronizeEncounterRuntimeContextsCommand;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.PartyMemberSummary;
import features.party.api.ReadStatus;
import features.scene.api.SceneCommand;
import features.scene.api.SceneMutationResult;
import features.scene.api.SceneSnapshot;
import features.scene.domain.SceneWorkspace;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.sessionplanner.api.PreparedSceneSource;
import features.worldplanner.api.WorldDispositionKind;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import platform.diagnostics.NoopDiagnostics;
import platform.execution.DirectExecutionLane;
import platform.ui.DirectUiDispatcher;

class SceneApplicationServiceTest {

    @Test
    void initializationIsExplicitAndCreatesSynchronizedDefaultScene() {
        MemoryRepository repository = new MemoryRepository();
        CapturingEncounters encounters = new CapturingEncounters();
        SceneApplicationService service = service(repository, party(1L, 2L), world(), prepared(), encounters);

        assertEquals(0, repository.loads);
        assertFalse(service.model().current().initialized());

        SceneMutationResult result = await(service.execute(new SceneCommand.Initialize()));

        assertEquals(SceneMutationResult.Status.SUCCESS, result.status());
        SceneSnapshot snapshot = service.model().current();
        assertEquals(1L, snapshot.defaultSceneId());
        assertEquals(1L, snapshot.focusedSceneId());
        assertEquals(List.of(1L, 2L), snapshot.scenes().getFirst().partyMembers().stream()
                .map(SceneSnapshot.PartyChoice::id).toList());
        assertTrue(snapshot.encounterSynchronized());
        assertEquals("scene:1", encounters.last.focusedContextId().value());
    }

    @Test
    void pcAndNpcAssignmentsMoveAtomicallyWhileLocationsMayBeShared() {
        CapturingEncounters encounters = new CapturingEncounters();
        SceneApplicationService service = service(
                new MemoryRepository(), party(1L, 2L), world(), prepared(), encounters);
        await(service.execute(new SceneCommand.Initialize()));
        await(service.execute(new SceneCommand.Create("Spähtrupp")));
        await(service.execute(new SceneCommand.AssignPc(2L, 2L)));
        await(service.execute(new SceneCommand.AssignNpc(1L, 10L)));
        await(service.execute(new SceneCommand.AssignNpc(2L, 10L)));
        await(service.execute(new SceneCommand.SetLocation(1L, 20L)));
        await(service.execute(new SceneCommand.SetLocation(2L, 20L)));

        SceneSnapshot snapshot = service.model().current();
        assertEquals(List.of(1L), snapshot.scenes().getFirst().partyMembers().stream()
                .map(SceneSnapshot.PartyChoice::id).toList());
        assertEquals(List.of(2L), snapshot.scenes().getLast().partyMembers().stream()
                .map(SceneSnapshot.PartyChoice::id).toList());
        assertTrue(snapshot.scenes().getFirst().npcs().isEmpty());
        assertEquals(List.of(10L), snapshot.scenes().getLast().npcs().stream()
                .map(SceneSnapshot.NpcChoice::id).toList());
        assertEquals(List.of(1L, 2L), snapshot.availableLocations().getFirst().sceneIds());
        assertEquals(features.encounter.api.EncounterRuntimeNpcRole.ENEMY,
                encounters.last.contexts().getLast().npcs().getFirst().role());
    }

    @Test
    void preparedImportIsRepeatableAndKeepsIndependentProvenanceCopies() {
        PreparedFacts prepared = prepared(new PreparedSceneSource(
                9L, "Abend", 4L, "Torhaus", "Wachen", 20L, 12L, List.of(2L, 99L)));
        SceneApplicationService service = service(
                new MemoryRepository(), party(1L, 2L), world(), prepared.model(), new CapturingEncounters());
        await(service.execute(new SceneCommand.Initialize()));
        await(service.execute(new SceneCommand.UnassignPc(2L)));

        await(service.execute(new SceneCommand.ImportPrepared(9L, 4L)));
        await(service.execute(new SceneCommand.ImportPrepared(9L, 4L)));
        prepared.publish(new PreparedSceneSource(
                9L, "Geändert", 4L, "Neuer Titel", "Andere Notizen", 0L, 0L, List.of()));

        SceneSnapshot snapshot = service.model().current();
        assertEquals(3, snapshot.scenes().size());
        assertEquals("Torhaus", snapshot.scenes().get(1).title());
        assertEquals("Torhaus", snapshot.scenes().get(2).title());
        assertEquals(List.of(2L), snapshot.scenes().get(1).partyMembers().stream()
                .map(SceneSnapshot.PartyChoice::id).toList());
        assertTrue(snapshot.scenes().get(2).partyMembers().isEmpty());
        assertEquals(9L, snapshot.scenes().get(1).provenance().sourceSessionId());
        assertEquals(12L, snapshot.scenes().get(1).initialEncounterPlanId());
    }

    @Test
    void refreshRemovesInactivePcsAndRetriesFailedEncounterSaga() {
        MemoryRepository repository = new MemoryRepository();
        PartyFacts party = party(1L, 2L);
        CapturingEncounters encounters = new CapturingEncounters();
        SceneApplicationService service = service(repository, party.model(), world(), prepared(), encounters);
        await(service.execute(new SceneCommand.Initialize()));

        encounters.fail = true;
        await(service.execute(new SceneCommand.Create("Nebenraum")));
        assertFalse(repository.state.encounterSynchronized());
        assertFalse(service.model().current().encounterSynchronized());

        party.publish(1L);
        encounters.fail = false;
        await(service.execute(new SceneCommand.Refresh()));

        assertTrue(repository.state.encounterSynchronized());
        assertTrue(service.model().current().encounterSynchronized());
        assertEquals(List.of(1L), service.model().current().scenes().getFirst().partyMembers().stream()
                .map(SceneSnapshot.PartyChoice::id).toList());
    }

    @Test
    void defaultSceneCannotBeDeleted() {
        SceneApplicationService service = service(
                new MemoryRepository(), party(1L), world(), prepared(), new CapturingEncounters());
        await(service.execute(new SceneCommand.Initialize()));

        SceneMutationResult result = await(service.execute(new SceneCommand.Delete(1L)));

        assertEquals(SceneMutationResult.Status.DEFAULT_SCENE_PROTECTED, result.status());
        assertEquals(1, service.model().current().scenes().size());
    }

    private static SceneApplicationService service(
            MemoryRepository repository,
            PartyFacts party,
            WorldPlannerSnapshotModel world,
            PreparedSceneCatalogModel prepared,
            EncounterRuntimeContextApi encounters
    ) {
        return service(repository, party.model(), world, prepared, encounters);
    }

    private static SceneApplicationService service(
            MemoryRepository repository,
            ActivePartyModel party,
            WorldPlannerSnapshotModel world,
            PreparedSceneCatalogModel prepared,
            EncounterRuntimeContextApi encounters
    ) {
        return new SceneApplicationService(
                repository,
                party,
                world,
                prepared,
                encounters,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE,
                NoopDiagnostics.INSTANCE);
    }

    private static PartyFacts party(long... ids) {
        return new PartyFacts(ids);
    }

    private static WorldPlannerSnapshotModel world() {
        WorldPlannerSnapshot snapshot = new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(new WorldNpcSummary(
                        10L, "Rivalin", 101L, "", "", "", "", 1L, 0, -25,
                        WorldDispositionKind.HOSTILE, WorldNpcLifecycleStatus.ACTIVE)),
                List.of(),
                List.of(new WorldLocationSummary(20L, "Torhaus", "", List.of(), List.of())),
                "");
        return new WorldPlannerSnapshotModel(() -> snapshot, ignored -> () -> { });
    }

    private static PreparedSceneCatalogModel prepared() {
        return prepared(new PreparedSceneSource[0]).model();
    }

    private static PreparedFacts prepared(PreparedSceneSource... sources) {
        return new PreparedFacts(List.of(sources));
    }

    private static SceneMutationResult await(CompletionStage<SceneMutationResult> stage) {
        return stage.toCompletableFuture().join();
    }

    private static final class MemoryRepository implements SceneWorkspaceRepository {
        private SceneWorkspace state;
        private int loads;

        @Override
        public Optional<SceneWorkspace> load() {
            loads++;
            return Optional.ofNullable(state);
        }

        @Override
        public void save(SceneWorkspace workspace) {
            state = workspace;
        }
    }

    private static final class CapturingEncounters implements EncounterRuntimeContextApi {
        private SynchronizeEncounterRuntimeContextsCommand last;
        private boolean fail;

        @Override
        public CompletionStage<EncounterRuntimeContextSyncResult> synchronize(
                SynchronizeEncounterRuntimeContextsCommand command
        ) {
            last = command;
            EncounterRuntimeContextSyncResult result = fail
                    ? new EncounterRuntimeContextSyncResult(
                            EncounterRuntimeContextSyncResult.Status.STORAGE_ERROR, 0L, "failed")
                    : new EncounterRuntimeContextSyncResult(
                            EncounterRuntimeContextSyncResult.Status.APPLIED, command.sourceRevision(), "applied");
            return CompletableFuture.completedFuture(result);
        }
    }

    private static final class PartyFacts {
        private final AtomicReference<ActivePartyResult> current = new AtomicReference<>();
        private final List<Consumer<ActivePartyResult>> listeners = new ArrayList<>();
        private final ActivePartyModel model = new ActivePartyModel(current::get, this::subscribe);

        private PartyFacts(long... ids) {
            publish(ids);
        }

        private ActivePartyModel model() {
            return model;
        }

        private void publish(long... ids) {
            ActivePartyResult result = new ActivePartyResult(
                    ReadStatus.SUCCESS,
                    java.util.Arrays.stream(ids)
                            .mapToObj(id -> new PartyMemberSummary(id, "PC " + id, (int) id + 1))
                            .toList());
            current.set(result);
            List.copyOf(listeners).forEach(listener -> listener.accept(result));
        }

        private Runnable subscribe(Consumer<ActivePartyResult> listener) {
            listeners.add(listener);
            return () -> listeners.remove(listener);
        }
    }

    private static final class PreparedFacts {
        private final AtomicReference<PreparedSceneCatalogSnapshot> current = new AtomicReference<>();
        private final List<Consumer<PreparedSceneCatalogSnapshot>> listeners = new ArrayList<>();
        private final PreparedSceneCatalogModel model = new PreparedSceneCatalogModel(current::get, listeners::add);
        private long revision;

        private PreparedFacts(List<PreparedSceneSource> sources) {
            current.set(new PreparedSceneCatalogSnapshot(++revision, sources, ""));
        }

        private PreparedSceneCatalogModel model() {
            return model;
        }

        private void publish(PreparedSceneSource source) {
            PreparedSceneCatalogSnapshot snapshot = new PreparedSceneCatalogSnapshot(
                    ++revision, List.of(source), "");
            current.set(snapshot);
            List.copyOf(listeners).forEach(listener -> listener.accept(snapshot));
        }
    }
}
