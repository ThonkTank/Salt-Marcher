package src.domain.scene;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.encounter.published.EncounterRuntimeContextApi;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.scene.model.RunningScene;
import src.domain.scene.model.SceneWorkspace;
import src.domain.scene.model.repository.SceneWorkspaceRepository;
import src.domain.scene.published.SceneCommand;
import src.domain.scene.published.SceneMutationResult;
import src.domain.scene.published.SceneSnapshot;
import src.domain.sessionplanner.published.PreparedSceneCatalog;
import src.domain.sessionplanner.published.PreparedSceneSource;
import src.domain.worldplanner.published.WorldDispositionKind;
import src.domain.worldplanner.published.WorldLocationSummary;
import src.domain.worldplanner.published.WorldNpcLifecycleStatus;
import src.domain.worldplanner.published.WorldNpcSummary;
import src.domain.worldplanner.published.WorldPlannerSnapshot;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

public final class SceneApplicationService {
    private final SceneWorkspaceRepository repository;
    private final ActivePartyModel party;
    private final WorldPlannerSnapshotModel world;
    private final PreparedSceneSource preparedScenes;
    private final EncounterRuntimeContextApi encounters;
    private boolean encounterSynchronized = true;

    SceneApplicationService(
            SceneWorkspaceRepository repository,
            ActivePartyModel party,
            WorldPlannerSnapshotModel world,
            PreparedSceneSource preparedScenes,
            EncounterRuntimeContextApi encounters
    ) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.party = Objects.requireNonNull(party, "party");
        this.world = Objects.requireNonNull(world, "world");
        this.preparedScenes = Objects.requireNonNull(preparedScenes, "preparedScenes");
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        ensureWorkspace();
        synchronize(repository.load().orElseThrow());
    }

    public SceneMutationResult apply(SceneCommand command) {
        if (command == null) {
            return result(SceneMutationResult.Status.INVALID, "Szenenaktion fehlt.");
        }
        try {
            SceneWorkspace current = workspaceWithoutInactiveMembers(repository.load().orElseThrow());
            SceneWorkspace changed = mutate(current, command);
            repository.save(changed);
            synchronize(changed);
            return result(SceneMutationResult.Status.SUCCESS, changed.statusText());
        } catch (SceneFailure failure) {
            return result(failure.status, failure.getMessage());
        } catch (IllegalArgumentException exception) {
            return result(SceneMutationResult.Status.INVALID, exception.getMessage());
        } catch (IllegalStateException exception) {
            encounterSynchronized = false;
            return result(SceneMutationResult.Status.STORAGE_ERROR, "Szene konnte nicht gespeichert werden.");
        }
    }

    public SceneSnapshot current() {
        SceneWorkspace workspace = repository.load().orElseGet(this::ensureWorkspace);
        return project(workspaceWithoutInactiveMembers(workspace));
    }

    public void refreshForeignFacts() {
        try {
            SceneWorkspace workspace = workspaceWithoutInactiveMembers(repository.load().orElseThrow());
            repository.save(workspace);
            synchronize(workspace);
        } catch (IllegalStateException ignored) {
            encounterSynchronized = false;
        }
    }

    private SceneWorkspace mutate(SceneWorkspace workspace, SceneCommand command) {
        if (command instanceof SceneCommand.Create create) {
            long id = workspace.nextSceneId();
            RunningScene scene = new RunningScene(id, create.title(), "", 0L, 0L, 0L, 0L, List.of(), List.of());
            return workspace.replace(append(workspace.scenes(), scene), id, id + 1L, "Szene erstellt.");
        }
        if (command instanceof SceneCommand.ImportPrepared imported) {
            return importPrepared(workspace, imported);
        }
        if (command instanceof SceneCommand.Focus focus) {
            requireScene(workspace, focus.sceneId());
            return workspace.replace(workspace.scenes(), focus.sceneId(), workspace.nextSceneId(), "Szene gewechselt.");
        }
        if (command instanceof SceneCommand.UpdateDetails details) {
            RunningScene scene = requireScene(workspace, details.sceneId());
            return replace(workspace, scene.withDetails(details.title(), details.notes()), workspace.focusedSceneId(), "Szene aktualisiert.");
        }
        if (command instanceof SceneCommand.Delete delete) {
            if (delete.sceneId() == workspace.defaultSceneId()) {
                throw failure(SceneMutationResult.Status.DEFAULT_SCENE, "Die Standardszene kann nicht gelöscht werden.");
            }
            requireScene(workspace, delete.sceneId());
            List<RunningScene> remaining = workspace.scenes().stream().filter(scene -> scene.sceneId() != delete.sceneId()).toList();
            long focus = workspace.focusedSceneId() == delete.sceneId() ? workspace.defaultSceneId() : workspace.focusedSceneId();
            return workspace.replace(remaining, focus, workspace.nextSceneId(), "Szene gelöscht.");
        }
        if (command instanceof SceneCommand.AssignPc assign) {
            requireActivePc(assign.partyMemberId());
            requireScene(workspace, assign.sceneId());
            List<RunningScene> scenes = workspace.scenes().stream().map(scene -> {
                List<Long> ids = new ArrayList<>(scene.partyMemberIds());
                ids.remove(assign.partyMemberId());
                if (scene.sceneId() == assign.sceneId()) {
                    ids.add(assign.partyMemberId());
                }
                return scene.withPartyMembers(ids);
            }).toList();
            return workspace.replace(scenes, workspace.focusedSceneId(), workspace.nextSceneId(), "PC verschoben.");
        }
        if (command instanceof SceneCommand.UnassignPc unassign) {
            List<RunningScene> scenes = workspace.scenes().stream()
                    .map(scene -> scene.withPartyMembers(scene.partyMemberIds().stream()
                            .filter(id -> id != unassign.partyMemberId()).toList()))
                    .toList();
            return workspace.replace(scenes, workspace.focusedSceneId(), workspace.nextSceneId(), "PC ist unzugeordnet.");
        }
        if (command instanceof SceneCommand.AddNpc add) {
            requireNpc(add.npcId());
            RunningScene scene = requireScene(workspace, add.sceneId());
            List<Long> ids = new ArrayList<>(scene.npcIds());
            ids.add(add.npcId());
            return replace(workspace, scene.withNpcs(ids), workspace.focusedSceneId(), "NPC hinzugefügt.");
        }
        if (command instanceof SceneCommand.RemoveNpc remove) {
            RunningScene scene = requireScene(workspace, remove.sceneId());
            return replace(workspace, scene.withNpcs(scene.npcIds().stream()
                    .filter(id -> id != remove.npcId()).toList()), workspace.focusedSceneId(), "NPC entfernt.");
        }
        SceneCommand.SetLocation location = (SceneCommand.SetLocation) command;
        if (location.locationId() > 0L) {
            requireLocation(location.locationId());
        }
        RunningScene scene = requireScene(workspace, location.sceneId());
        return replace(workspace, scene.withLocation(location.locationId()), workspace.focusedSceneId(), "Ort aktualisiert.");
    }

    private SceneWorkspace importPrepared(SceneWorkspace workspace, SceneCommand.ImportPrepared command) {
        PreparedSceneCatalog.PreparedScene source = preparedScenes.list().scenes().stream()
                .filter(scene -> scene.sessionId() == command.sessionId() && scene.sceneId() == command.sceneId())
                .findFirst().orElseThrow(() -> failure(SceneMutationResult.Status.NOT_FOUND, "Vorbereitete Szene nicht gefunden."));
        List<Long> activeIds = activeParty().stream().map(PartyMemberSummary::id).toList();
        var assigned = workspace.assignedPartyMemberIds();
        List<Long> importedPcs = source.participantIds().stream()
                .filter(activeIds::contains).filter(id -> !assigned.contains(id)).toList();
        long id = workspace.nextSceneId();
        RunningScene scene = new RunningScene(
                id, source.title(), source.notes(), source.sessionId(), source.sceneId(), source.encounterPlanId(),
                source.locationId(), importedPcs, List.of());
        return workspace.replace(append(workspace.scenes(), scene), id, id + 1L,
                importedPcs.size() == source.participantIds().size()
                        ? "Vorbereitete Szene geladen."
                        : "Vorbereitete Szene geladen; bereits zugeordnete oder inaktive PCs wurden übersprungen.");
    }

    private SceneWorkspace workspaceWithoutInactiveMembers(SceneWorkspace workspace) {
        List<Long> activeIds = activeParty().stream().map(PartyMemberSummary::id).toList();
        List<RunningScene> scenes = workspace.scenes().stream()
                .map(scene -> scene.withPartyMembers(scene.partyMemberIds().stream().filter(activeIds::contains).toList()))
                .toList();
        if (scenes.equals(workspace.scenes())) {
            return workspace;
        }
        return workspace.replace(scenes, workspace.focusedSceneId(), workspace.nextSceneId(), "Inaktive PCs wurden entfernt.");
    }

    private SceneWorkspace ensureWorkspace() {
        return repository.load().orElseGet(() -> repository.save(SceneWorkspace.initial(
                activeParty().stream().map(PartyMemberSummary::id).toList())));
    }

    private void synchronize(SceneWorkspace workspace) {
        WorldPlannerSnapshot worldSnapshot = world.current();
        List<EncounterRuntimeContextApi.Context> contexts = workspace.scenes().stream()
                .map(scene -> new EncounterRuntimeContextApi.Context(
                        contextKey(scene.sceneId()), scene.partyMemberIds(), scene.locationId(),
                        scene.sourceEncounterPlanId(),
                        scene.npcIds().stream().map(id -> encounterNpc(id, worldSnapshot)).filter(Objects::nonNull).toList()))
                .toList();
        EncounterRuntimeContextApi.SyncResult result = encounters.synchronize(
                new EncounterRuntimeContextApi.SynchronizeEncounterContextsCommand(
                        workspace.revision(), contextKey(workspace.focusedSceneId()), contexts));
        encounterSynchronized = result.success();
    }

    private static EncounterRuntimeContextApi.Npc encounterNpc(long id, WorldPlannerSnapshot world) {
        WorldNpcSummary npc = world.npcs().stream().filter(value -> value.npcId() == id).findFirst().orElse(null);
        if (npc == null) {
            return null;
        }
        return new EncounterRuntimeContextApi.Npc(
                npc.npcId(), npc.creatureStatblockId(),
                EncounterRuntimeContextApi.Role.valueOf(npc.disposition().name()),
                npc.status() == WorldNpcLifecycleStatus.ACTIVE);
    }

    private SceneSnapshot project(SceneWorkspace workspace) {
        ActivePartyResult partyResult = party.current();
        List<PartyMemberSummary> members = activeParty();
        WorldPlannerSnapshot worlds = world.current();
        List<SceneSnapshot.SceneEntry> entries = workspace.scenes().stream()
                .map(scene -> sceneEntry(workspace, scene, members, worlds)).toList();
        List<SceneSnapshot.PartyChoice> allPcs = members.stream().map(member -> partyChoice(member, sceneForPc(workspace, member.id()))).toList();
        List<SceneSnapshot.PartyChoice> unassigned = allPcs.stream().filter(choice -> choice.sceneId() == 0L).toList();
        List<SceneSnapshot.NpcChoice> npcs = worlds.npcs().stream().map(npc -> npcChoice(npc, sceneForNpc(workspace, npc.npcId()))).toList();
        List<SceneSnapshot.LocationChoice> locations = worlds.locations().stream()
                .map(location -> new SceneSnapshot.LocationChoice(location.locationId(), location.displayName(), sceneForLocation(workspace, location.locationId())))
                .toList();
        List<SceneSnapshot.PreparedChoice> prepared = preparedScenes.list().scenes().stream()
                .map(scene -> new SceneSnapshot.PreparedChoice(scene.sessionId(), scene.sceneId(), scene.sessionName(), scene.title())).toList();
        String status = partyResult.status() == ReadStatus.SUCCESS ? workspace.statusText() : "Party konnte nicht geladen werden.";
        if (!encounterSynchronized) {
            status = status + " Encounter-Synchronisierung ausstehend.";
        }
        return new SceneSnapshot(workspace.revision(), workspace.defaultSceneId(), workspace.focusedSceneId(), entries,
                unassigned, allPcs, npcs, locations, prepared, encounterSynchronized, status);
    }

    private static SceneSnapshot.SceneEntry sceneEntry(
            SceneWorkspace workspace, RunningScene scene, List<PartyMemberSummary> members, WorldPlannerSnapshot world
    ) {
        WorldLocationSummary location = world.locations().stream().filter(value -> value.locationId() == scene.locationId()).findFirst().orElse(null);
        List<SceneSnapshot.PartyChoice> pcs = members.stream().filter(member -> scene.partyMemberIds().contains(member.id()))
                .map(member -> partyChoice(member, scene.sceneId())).toList();
        List<SceneSnapshot.NpcChoice> npcs = world.npcs().stream().filter(npc -> scene.npcIds().contains(npc.npcId()))
                .map(npc -> npcChoice(npc, scene.sceneId())).toList();
        return new SceneSnapshot.SceneEntry(scene.sceneId(), scene.title(), scene.notes(),
                scene.sceneId() == workspace.defaultSceneId(), scene.sceneId() == workspace.focusedSceneId(),
                scene.sourceSessionId(), scene.sourceSceneId(), scene.locationId(),
                location == null ? "" : location.displayName(), pcs, npcs);
    }

    private static SceneSnapshot.PartyChoice partyChoice(PartyMemberSummary member, long sceneId) {
        return new SceneSnapshot.PartyChoice(member.id(), member.name(), member.level(), sceneId);
    }

    private static SceneSnapshot.NpcChoice npcChoice(WorldNpcSummary npc, long sceneId) {
        return new SceneSnapshot.NpcChoice(npc.npcId(), npc.displayName(), npc.creatureStatblockId(),
                npc.disposition(), npc.effectiveDisposition(), npc.status() == WorldNpcLifecycleStatus.ACTIVE, sceneId);
    }

    private List<PartyMemberSummary> activeParty() {
        ActivePartyResult result = party.current();
        return result.status() == ReadStatus.SUCCESS ? result.members() : List.of();
    }

    private void requireActivePc(long id) {
        if (activeParty().stream().noneMatch(member -> member.id() == id)) {
            throw failure(SceneMutationResult.Status.NOT_FOUND, "Aktiver PC nicht gefunden.");
        }
    }

    private void requireNpc(long id) {
        if (world.current().npcs().stream().noneMatch(npc -> npc.npcId() == id)) {
            throw failure(SceneMutationResult.Status.NOT_FOUND, "NPC nicht gefunden.");
        }
    }

    private void requireLocation(long id) {
        if (world.current().locations().stream().noneMatch(location -> location.locationId() == id)) {
            throw failure(SceneMutationResult.Status.NOT_FOUND, "Ort nicht gefunden.");
        }
    }

    private static RunningScene requireScene(SceneWorkspace workspace, long id) {
        RunningScene scene = workspace.scene(id);
        if (scene == null) {
            throw failure(SceneMutationResult.Status.NOT_FOUND, "Szene nicht gefunden.");
        }
        return scene;
    }

    private static SceneWorkspace replace(SceneWorkspace workspace, RunningScene replacement, long focus, String status) {
        List<RunningScene> scenes = workspace.scenes().stream()
                .map(scene -> scene.sceneId() == replacement.sceneId() ? replacement : scene).toList();
        return workspace.replace(scenes, focus, workspace.nextSceneId(), status);
    }

    private static <T> List<T> append(List<T> values, T value) {
        List<T> result = new ArrayList<>(values); result.add(value); return List.copyOf(result);
    }

    private static long sceneForPc(SceneWorkspace workspace, long id) {
        return workspace.scenes().stream().filter(scene -> scene.partyMemberIds().contains(id))
                .mapToLong(RunningScene::sceneId).findFirst().orElse(0L);
    }

    private static long sceneForNpc(SceneWorkspace workspace, long id) {
        return workspace.scenes().stream().filter(scene -> scene.npcIds().contains(id))
                .mapToLong(RunningScene::sceneId).findFirst().orElse(0L);
    }

    private static long sceneForLocation(SceneWorkspace workspace, long id) {
        return workspace.scenes().stream().filter(scene -> scene.locationId() == id)
                .mapToLong(RunningScene::sceneId).findFirst().orElse(0L);
    }

    private static String contextKey(long sceneId) { return "scene:" + sceneId; }
    private static SceneMutationResult result(SceneMutationResult.Status status, String message) { return new SceneMutationResult(status, message); }
    private static SceneFailure failure(SceneMutationResult.Status status, String message) { return new SceneFailure(status, message); }

    private static final class SceneFailure extends RuntimeException {
        private final SceneMutationResult.Status status;
        private SceneFailure(SceneMutationResult.Status status, String message) { super(message); this.status = status; }
    }
}
