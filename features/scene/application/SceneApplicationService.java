package features.scene.application;

import features.creatures.api.CreatureCatalogModel;
import features.creatures.api.CreatureQueryStatus;
import features.creatures.api.CreaturesApi;
import features.creatures.api.RefreshCreatureCatalogCommand;
import features.encounter.api.EncounterRuntimeContextApi;
import features.encounter.api.EncounterRuntimeContextId;
import features.encounter.api.EncounterRuntimeContextSpec;
import features.encounter.api.EncounterRuntimeContextSyncResult;
import features.encounter.api.EncounterRuntimeNpcRole;
import features.encounter.api.EncounterRuntimeNpcSpec;
import features.encounter.api.SynchronizeEncounterRuntimeContextsCommand;
import features.party.api.ActivePartyModel;
import features.party.api.ActivePartyResult;
import features.party.api.PartyMemberSummary;
import features.party.api.ReadStatus;
import features.scene.api.SceneApi;
import features.scene.api.SceneCommand;
import features.scene.api.SceneModel;
import features.scene.api.SceneMutationResult;
import features.scene.api.SceneParticipantKind;
import features.scene.api.SceneSnapshot;
import features.scene.domain.RunningScene;
import features.scene.domain.SceneWorkspace;
import features.sessionplanner.api.PreparedSceneCatalogModel;
import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.sessionplanner.api.PreparedSceneSource;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerReadStatus;
import features.worldplanner.api.WorldPlannerSnapshot;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.ui.UiDispatcher;

public final class SceneApplicationService implements SceneApi {

    private static final DiagnosticId STORAGE_FAILURE = new DiagnosticId("scene.storage-failure");
    private static final DiagnosticId SYNC_FAILURE = new DiagnosticId("scene.encounter-sync-failure");

    private final SceneWorkspaceRepository repository;
    private final ActivePartyModel party;
    private final WorldPlannerSnapshotModel world;
    private final PreparedSceneCatalogModel preparedScenes;
    private final EncounterRuntimeContextApi encounters;
    private final CreatureCatalogModel creatureCatalog;
    private final CreaturesApi creatures;
    private final ExecutionLane executionLane;
    private final Diagnostics diagnostics;
    private final SceneProjection projection = new SceneProjection();
    private final ScenePublishedState publishedState;
    private SceneWorkspace workspace;
    private boolean foreignSubscriptionsRegistered;

    public SceneApplicationService(
            SceneWorkspaceRepository repository,
            ActivePartyModel party,
            WorldPlannerSnapshotModel world,
            PreparedSceneCatalogModel preparedScenes,
            EncounterRuntimeContextApi encounters,
            CreatureCatalogModel creatureCatalog,
            CreaturesApi creatures,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher,
            Diagnostics diagnostics
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.party = Objects.requireNonNull(party, "party");
        this.world = Objects.requireNonNull(world, "world");
        this.preparedScenes = Objects.requireNonNull(preparedScenes, "preparedScenes");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.creatureCatalog = Objects.requireNonNull(creatureCatalog, "creatureCatalog");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.executionLane = Objects.requireNonNull(executionLane, "executionLane");
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        publishedState = new ScenePublishedState(Objects.requireNonNull(uiDispatcher, "uiDispatcher"));
    }

    public SceneModel model() {
        return publishedState.model();
    }

    @Override
    public CompletionStage<SceneMutationResult> execute(SceneCommand command) {
        CompletableFuture<SceneMutationResult> completion = new CompletableFuture<>();
        try {
            executionLane.execute(() -> handle(command, completion));
        } catch (RuntimeException exception) {
            completion.complete(storageError(exception));
        }
        return completion;
    }

    private void handle(SceneCommand command, CompletableFuture<SceneMutationResult> completion) {
        if (command == null) {
            completion.complete(result(SceneMutationResult.Status.INVALID, "Szenenaktion fehlt."));
            return;
        }
        try {
            registerForeignSubscriptions();
            if (command instanceof SceneCommand.Initialize || command instanceof SceneCommand.Refresh) {
                refresh(completion);
            } else {
                SceneWorkspace current = requireWorkspace();
                saveAndSynchronize(mutate(current, command), completion);
            }
        } catch (SceneWorkspace.DefaultSceneProtectedException exception) {
            completion.complete(result(
                    SceneMutationResult.Status.DEFAULT_SCENE_PROTECTED,
                    "Die Standardszene kann nicht gelöscht werden."));
        } catch (SceneWorkspace.SceneNotFoundException exception) {
            completion.complete(result(SceneMutationResult.Status.NOT_FOUND, "Szene nicht gefunden."));
        } catch (MissingForeignReferenceException exception) {
            completion.complete(result(SceneMutationResult.Status.NOT_FOUND, exception.getMessage()));
        } catch (IllegalArgumentException exception) {
            completion.complete(result(SceneMutationResult.Status.INVALID, exception.getMessage()));
        } catch (IllegalStateException exception) {
            completion.complete(storageError(exception));
        }
    }

    private void refresh(CompletableFuture<SceneMutationResult> completion) {
        SceneWorkspace loaded = workspace == null
                ? repository.load().orElseGet(() -> SceneWorkspace.initial(List.copyOf(activePartyIds())))
                : workspace;
        SceneWorkspace refreshed = party.current().status() == ReadStatus.SUCCESS
                ? loaded.retainActivePartyMembers(activePartyIds())
                : loaded;
        if (refreshed == loaded) {
            refreshed = loaded.refresh("Szenen aktualisiert.");
        }
        String status = refreshed.statusText();
        saveAndSynchronize(refreshed.withEncounterSynchronized(false, status), completion);
    }

    private SceneWorkspace mutate(SceneWorkspace current, SceneCommand command) {
        if (command instanceof SceneCommand.Create create) {
            return current.create(create.title());
        }
        if (command instanceof SceneCommand.ImportPrepared imported) {
            return importPrepared(current, imported);
        }
        if (command instanceof SceneCommand.Focus focus) {
            return current.focus(focus.sceneId());
        }
        if (command instanceof SceneCommand.UpdateDetails details) {
            return current.updateDetails(details.sceneId(), details.title(), details.notes());
        }
        if (command instanceof SceneCommand.Delete delete) {
            return current.delete(delete.sceneId());
        }
        if (command instanceof SceneCommand.AssignPc assign) {
            requireActivePc(assign.partyMemberId());
            return current.assignPc(assign.sceneId(), assign.partyMemberId());
        }
        if (command instanceof SceneCommand.UnassignPc unassign) {
            return current.unassignPc(unassign.partyMemberId());
        }
        if (command instanceof SceneCommand.AssignNpc assign) {
            requireNpc(assign.npcId());
            return current.assignNpc(assign.sceneId(), assign.npcId());
        }
        if (command instanceof SceneCommand.UnassignNpc unassign) {
            return current.unassignNpc(unassign.npcId());
        }
        if (command instanceof SceneCommand.AssignMob assign) {
            requireCreature(assign.creatureId());
            return current.assignMob(assign.sceneId(), assign.creatureId(), assign.count());
        }
        if (command instanceof SceneCommand.UnassignMob unassign) {
            return current.unassignMob(unassign.sceneId(), unassign.creatureId());
        }
        if (command instanceof SceneCommand.SetMobCount setCount) {
            if (setCount.count() > 0) {
                requireCreature(setCount.creatureId());
            }
            return current.setMobCount(setCount.sceneId(), setCount.creatureId(), setCount.count());
        }
        if (command instanceof SceneCommand.SetParticipantDefeated defeated) {
            return current.setParticipantDefeated(
                    defeated.sceneId(), domainKind(defeated.kind()), defeated.refId(), defeated.defeated());
        }
        if (command instanceof SceneCommand.SetParticipantNotes notes) {
            return current.setParticipantNotes(
                    notes.sceneId(), domainKind(notes.kind()), notes.refId(), notes.notes());
        }
        SceneCommand.SetLocation location = (SceneCommand.SetLocation) command;
        if (location.locationId() > 0L) {
            requireLocation(location.locationId());
        }
        return current.setLocation(location.sceneId(), location.locationId());
    }

    private SceneWorkspace importPrepared(SceneWorkspace current, SceneCommand.ImportPrepared command) {
        PreparedSceneSource source = preparedScenes.current().scenes().stream()
                .filter(candidate -> candidate.sessionId() == command.sessionId()
                        && candidate.sceneId() == command.preparedSceneId())
                .findFirst()
                .orElseThrow(() -> new MissingForeignReferenceException("Vorbereitete Szene nicht gefunden."));
        Set<Long> activeIds = activePartyIds();
        Set<Long> assignedIds = current.assignedPartyMemberIds();
        List<Long> importedIds = source.participantIds().stream()
                .filter(activeIds::contains)
                .filter(id -> !assignedIds.contains(id))
                .toList();
        String status = importedIds.size() == source.participantIds().size()
                ? "Vorbereitete Szene geladen."
                : "Vorbereitete Szene geladen; bereits zugeordnete oder inaktive PCs wurden übersprungen.";
        return current.importPrepared(
                source.title(),
                source.notes(),
                source.sessionId(),
                source.sceneId(),
                source.sessionName(),
                source.encounterPlanId(),
                source.locationId(),
                importedIds,
                status);
    }

    private void saveAndSynchronize(
            SceneWorkspace candidate,
            CompletableFuture<SceneMutationResult> completion
    ) {
        repository.save(candidate);
        workspace = candidate;
        publishCurrent();
        if (world.current().status() != WorldPlannerReadStatus.SUCCESS) {
            finishSynchronizationFailure(candidate, completion,
                    new IllegalStateException("World Planner facts are unavailable"));
            return;
        }
        CompletionStage<EncounterRuntimeContextSyncResult> synchronization;
        try {
            synchronization = encounters.synchronize(synchronizationCommand(candidate));
        } catch (RuntimeException exception) {
            finishSynchronizationFailure(candidate, completion, exception);
            return;
        }
        if (synchronization == null) {
            finishSynchronizationFailure(candidate, completion,
                    new IllegalStateException("Encounter synchronization returned no stage"));
            return;
        }
        synchronization.whenComplete((syncResult, failure) -> scheduleSynchronizationCompletion(
                candidate, syncResult, failure, completion));
    }

    private void scheduleSynchronizationCompletion(
            SceneWorkspace candidate,
            EncounterRuntimeContextSyncResult syncResult,
            Throwable failure,
            CompletableFuture<SceneMutationResult> completion
    ) {
        try {
            executionLane.execute(() -> finishSynchronization(candidate, syncResult, failure, completion));
        } catch (RuntimeException exception) {
            finishSynchronizationFailure(candidate, completion, exception);
        }
    }

    private void finishSynchronization(
            SceneWorkspace candidate,
            EncounterRuntimeContextSyncResult syncResult,
            Throwable failure,
            CompletableFuture<SceneMutationResult> completion
    ) {
        if (failure != null || !synchronizationSucceeded(candidate, syncResult)) {
            finishSynchronizationFailure(candidate, completion,
                    failure == null ? new IllegalStateException("Encounter synchronization was rejected") : failure);
            return;
        }
        if (workspace != null && workspace.revision() == candidate.revision()) {
            SceneWorkspace synchronizedWorkspace = workspace.withEncounterSynchronized(true, workspace.statusText());
            try {
                repository.save(synchronizedWorkspace);
                workspace = synchronizedWorkspace;
                publishCurrent();
            } catch (IllegalStateException exception) {
                diagnostics.failure(STORAGE_FAILURE, exception.getClass());
            }
        }
        completion.complete(result(SceneMutationResult.Status.SUCCESS, candidate.statusText()));
    }

    private void finishSynchronizationFailure(
            SceneWorkspace candidate,
            CompletableFuture<SceneMutationResult> completion,
            Throwable failure
    ) {
        diagnostics.failure(SYNC_FAILURE, failure.getClass());
        if (workspace != null && workspace.revision() == candidate.revision()) {
            publishCurrent();
        }
        completion.complete(result(SceneMutationResult.Status.SUCCESS,
                candidate.statusText() + " Encounter-Synchronisierung ausstehend."));
    }

    private static boolean synchronizationSucceeded(
            SceneWorkspace candidate,
            EncounterRuntimeContextSyncResult result
    ) {
        if (result == null || result.acceptedRevision() < candidate.revision()) {
            return false;
        }
        return result.status() == EncounterRuntimeContextSyncResult.Status.APPLIED
                || result.status() == EncounterRuntimeContextSyncResult.Status.STALE_IGNORED;
    }

    private SynchronizeEncounterRuntimeContextsCommand synchronizationCommand(SceneWorkspace candidate) {
        WorldPlannerSnapshot worldSnapshot = world.current();
        List<EncounterRuntimeContextSpec> contexts = candidate.scenes().stream()
                .map(scene -> encounterContext(scene, worldSnapshot))
                .toList();
        return new SynchronizeEncounterRuntimeContextsCommand(
                candidate.revision(),
                contextId(candidate.focusedSceneId()),
                contexts);
    }

    private static EncounterRuntimeContextSpec encounterContext(
            RunningScene scene,
            WorldPlannerSnapshot world
    ) {
        List<EncounterRuntimeNpcSpec> npcs = scene.npcIds().stream()
                .map(id -> world.npcs().stream().filter(npc -> npc.npcId() == id).findFirst().orElse(null))
                .filter(Objects::nonNull)
                .filter(npc -> npc.status() == WorldNpcLifecycleStatus.ACTIVE)
                .map(SceneApplicationService::encounterNpc)
                .toList();
        return new EncounterRuntimeContextSpec(
                contextId(scene.sceneId()),
                scene.partyMemberIds(),
                scene.locationId(),
                scene.initialEncounterPlanId(),
                npcs);
    }

    private static EncounterRuntimeNpcSpec encounterNpc(WorldNpcSummary npc) {
        return new EncounterRuntimeNpcSpec(
                npc.npcId(),
                npc.creatureStatblockId(),
                encounterRole(npc.disposition()));
    }

    private static EncounterRuntimeNpcRole encounterRole(
            features.worldplanner.api.WorldDispositionKind disposition
    ) {
        return switch (disposition) {
            case HOSTILE -> EncounterRuntimeNpcRole.ENEMY;
            case FRIENDLY -> EncounterRuntimeNpcRole.ALLY;
            case NEUTRAL -> EncounterRuntimeNpcRole.NEUTRAL;
        };
    }

    private SceneWorkspace requireWorkspace() {
        if (workspace == null) {
            workspace = repository.load().orElseGet(() -> SceneWorkspace.initial(List.copyOf(activePartyIds())));
            if (party.current().status() == ReadStatus.SUCCESS) {
                workspace = workspace.retainActivePartyMembers(activePartyIds());
            }
        }
        return workspace;
    }

    private Set<Long> activePartyIds() {
        ActivePartyResult result = party.current();
        if (result.status() != ReadStatus.SUCCESS) {
            return Set.of();
        }
        java.util.LinkedHashSet<Long> ordered = result.members().stream()
                .map(PartyMemberSummary::id)
                .filter(Objects::nonNull)
                .filter(id -> id.longValue() > 0L)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        return java.util.Collections.unmodifiableSet(ordered);
    }

    private void requireActivePc(long id) {
        if (!activePartyIds().contains(id)) {
            throw new MissingForeignReferenceException("Aktiver PC nicht gefunden.");
        }
    }

    private void requireNpc(long id) {
        if (world.current().npcs().stream().noneMatch(npc -> npc.npcId() == id)) {
            throw new MissingForeignReferenceException("NPC nicht gefunden.");
        }
    }

    private void requireLocation(long id) {
        if (world.current().locations().stream().noneMatch(location -> location.locationId() == id)) {
            throw new MissingForeignReferenceException("Ort nicht gefunden.");
        }
    }

    private void requireCreature(long id) {
        boolean known = creatureCatalog.current().status() == CreatureQueryStatus.SUCCESS
                && creatureCatalog.current().page().rows().stream().anyMatch(row -> row.id() == id);
        if (!known) {
            throw new MissingForeignReferenceException("Kreatur nicht gefunden.");
        }
    }

    private void publishCurrent() {
        if (workspace == null) {
            return;
        }
        publishedState.publish(projection.project(
                workspace,
                party.current(),
                world.current(),
                preparedScenes.current(),
                creatureCatalog.current()));
    }

    private void scheduleProjectionRefresh() {
        try {
            executionLane.execute(this::publishCurrent);
        } catch (RuntimeException exception) {
            diagnostics.failure(STORAGE_FAILURE, exception.getClass());
        }
    }

    private void registerForeignSubscriptions() {
        if (foreignSubscriptionsRegistered) {
            return;
        }
        foreignSubscriptionsRegistered = true;
        party.subscribe(ignored -> execute(new SceneCommand.Refresh()));
        world.subscribe(ignored -> execute(new SceneCommand.Refresh()));
        preparedScenes.subscribe(ignored -> scheduleProjectionRefresh());
        creatureCatalog.subscribe(ignored -> scheduleProjectionRefresh());
        creatures.refreshCatalog(catalogRefreshCommand());
    }

    private static features.scene.domain.SceneParticipantKind domainKind(SceneParticipantKind kind) {
        return switch (kind) {
            case PC -> features.scene.domain.SceneParticipantKind.PC;
            case NPC -> features.scene.domain.SceneParticipantKind.NPC;
            case MOB -> features.scene.domain.SceneParticipantKind.MOB;
        };
    }

    private static RefreshCreatureCatalogCommand catalogRefreshCommand() {
        return new RefreshCreatureCatalogCommand(
                null, null, null, List.of(), List.of(), List.of(), List.of(), List.of(),
                null, null, 500, 0);
    }

    private SceneMutationResult storageError(RuntimeException exception) {
        diagnostics.failure(STORAGE_FAILURE, exception.getClass());
        if (workspace != null) {
            workspace = workspace.withEncounterSynchronized(false, "Szenen konnten nicht gespeichert werden.");
            publishCurrent();
        }
        return result(SceneMutationResult.Status.STORAGE_ERROR, "Szenen konnten nicht gespeichert werden.");
    }

    private static EncounterRuntimeContextId contextId(long sceneId) {
        return new EncounterRuntimeContextId("scene:" + sceneId);
    }

    private static SceneMutationResult result(SceneMutationResult.Status status, String message) {
        return new SceneMutationResult(status, message);
    }

    private static final class MissingForeignReferenceException extends IllegalArgumentException {
        private MissingForeignReferenceException(String message) {
            super(message);
        }
    }
}
