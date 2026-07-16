package src.domain.scene;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import src.domain.encounter.published.EncounterRuntimeContextApi;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.scene.model.SceneWorkspace;
import src.domain.scene.model.repository.SceneWorkspaceRepository;
import src.domain.scene.published.SceneCommand;
import src.domain.scene.published.SceneMutationResult;
import src.domain.sessionplanner.published.PreparedSceneCatalog;
import src.domain.worldplanner.published.WorldDispositionKind;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerReadStatus;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

class SceneRuntimeTest {

    @Test
    void defaultScenePartitionsPcsAndSynchronizesWorldContext() {
        ActivePartyModel party = party(1L, 2L);
        WorldPlannerSnapshotModel world = world();
        CapturingEncounterContexts encounters = new CapturingEncounterContexts();
        SceneApplicationService service = new SceneApplicationService(
                new MemoryRepository(), party, world, () -> new PreparedSceneCatalog(List.of(), ""), encounters);

        assertEquals(List.of(1L, 2L), service.current().scenes().getFirst().partyMembers().stream()
                .map(choice -> choice.id()).toList());
        assertEquals("scene:1", encounters.last.focusedContextKey());

        service.apply(new SceneCommand.Create("Getrennte Gruppe"));
        service.apply(new SceneCommand.AssignPc(2L, 2L));
        assertEquals(List.of(1L), service.current().scenes().getFirst().partyMembers().stream()
                .map(choice -> choice.id()).toList());
        assertEquals(List.of(2L), service.current().scenes().get(1).partyMembers().stream()
                .map(choice -> choice.id()).toList());
        assertTrue(service.current().encounterSynchronized());
    }

    @Test
    void preparedImportCopiesOnlyUnassignedActiveParticipants() {
        ActivePartyModel party = party(1L, 2L, 3L);
        CapturingEncounterContexts encounters = new CapturingEncounterContexts();
        PreparedSceneCatalog.PreparedScene prepared = new PreparedSceneCatalog.PreparedScene(
                9L, "Abend", 4L, "Torhaus", "Wachen", 7L, 12L, List.of(1L, 2L, 99L));
        SceneApplicationService service = new SceneApplicationService(
                new MemoryRepository(), party, world(), () -> new PreparedSceneCatalog(List.of(prepared), ""),
                encounters);
        service.apply(new SceneCommand.UnassignPc(2L));

        SceneMutationResult result = service.apply(new SceneCommand.ImportPrepared(9L, 4L));

        assertEquals(SceneMutationResult.Status.SUCCESS, result.status());
        var imported = service.current().scenes().getLast();
        assertEquals("Torhaus", imported.title());
        assertEquals(7L, imported.locationId());
        assertEquals(List.of(2L), imported.partyMembers().stream().map(choice -> choice.id()).toList());
        assertEquals(12L, encounters.last.contexts().getLast().initialEncounterPlanId());
        assertTrue(service.current().statusText().contains("übersprungen"));
    }

    @Test
    void npcDispositionAndSingleLocationReachEncounterContext() {
        CapturingEncounterContexts encounters = new CapturingEncounterContexts();
        SceneApplicationService service = new SceneApplicationService(
                new MemoryRepository(), party(1L), world(), () -> new PreparedSceneCatalog(List.of(), ""), encounters);

        service.apply(new SceneCommand.AddNpc(1L, 10L));
        service.apply(new SceneCommand.SetLocation(1L, 20L));

        var context = encounters.last.contexts().getFirst();
        assertEquals(20L, context.worldLocationId());
        assertEquals(EncounterRuntimeContextApi.Role.HOSTILE, context.npcs().getFirst().role());
        assertTrue(context.npcs().getFirst().active());
        assertEquals(SceneMutationResult.Status.DEFAULT_SCENE, service.apply(new SceneCommand.Delete(1L)).status());
    }

    private static ActivePartyModel party(long... ids) {
        ActivePartyModel model = new ActivePartyModel();
        List<PartyMemberSummary> members = java.util.Arrays.stream(ids)
                .mapToObj(id -> new PartyMemberSummary(id, "PC " + id, (int) id + 1)).toList();
        model.publish(new ActivePartyResult(ReadStatus.SUCCESS, members));
        return model;
    }

    private static WorldPlannerSnapshotModel world() {
        WorldPlannerSnapshotModel model = new WorldPlannerSnapshotModel();
        model.publish(new WorldPlannerSnapshot(
                WorldPlannerReadStatus.SUCCESS,
                List.of(new WorldNpcSummary(10L, "Rivalin", 101L, "", "", "", "", 1L, 5, -25,
                        WorldDispositionKind.HOSTILE, WorldNpcLifecycleStatus.ACTIVE)),
                List.of(),
                List.of(new WorldLocationSummary(20L, "Torhaus", "", List.of(), List.of())),
                ""));
        return model;
    }

    private static final class MemoryRepository implements SceneWorkspaceRepository {
        private SceneWorkspace state;
        @Override public Optional<SceneWorkspace> load() { return Optional.ofNullable(state); }
        @Override public SceneWorkspace save(SceneWorkspace workspace) { state = workspace; return workspace; }
    }

    private static final class CapturingEncounterContexts implements EncounterRuntimeContextApi {
        private SynchronizeEncounterContextsCommand last;
        @Override public SyncResult synchronize(SynchronizeEncounterContextsCommand command) {
            last = command;
            return new SyncResult(true, "");
        }
    }
}
