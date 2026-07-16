package features.scene.application;

import features.party.api.ActivePartyResult;
import features.party.api.PartyMemberSummary;
import features.party.api.ReadStatus;
import features.scene.api.SceneSnapshot;
import features.scene.domain.RunningScene;
import features.scene.domain.SceneWorkspace;
import features.sessionplanner.api.PreparedSceneCatalogSnapshot;
import features.worldplanner.api.WorldLocationSummary;
import features.worldplanner.api.WorldNpcLifecycleStatus;
import features.worldplanner.api.WorldNpcSummary;
import features.worldplanner.api.WorldPlannerSnapshot;
import java.util.List;

final class SceneProjection {

    SceneSnapshot project(
            SceneWorkspace workspace,
            ActivePartyResult party,
            WorldPlannerSnapshot world,
            PreparedSceneCatalogSnapshot prepared
    ) {
        List<PartyMemberSummary> members = party.status() == ReadStatus.SUCCESS ? party.members() : List.of();
        List<SceneSnapshot.SceneEntry> scenes = workspace.scenes().stream()
                .map(scene -> sceneEntry(workspace, scene, members, world))
                .toList();
        List<SceneSnapshot.PartyChoice> partyChoices = members.stream()
                .map(member -> partyChoice(member, sceneForPc(workspace, member.id())))
                .toList();
        List<SceneSnapshot.NpcChoice> npcChoices = world.npcs().stream()
                .map(npc -> npcChoice(npc, sceneForNpc(workspace, npc.npcId())))
                .toList();
        List<SceneSnapshot.LocationChoice> locationChoices = world.locations().stream()
                .map(location -> locationChoice(workspace, location))
                .toList();
        List<SceneSnapshot.PreparedChoice> preparedChoices = prepared.scenes().stream()
                .map(source -> new SceneSnapshot.PreparedChoice(
                        source.sessionId(), source.sceneId(), source.sessionName(), source.title()))
                .toList();
        return new SceneSnapshot(
                workspace.revision(),
                workspace.defaultSceneId(),
                workspace.focusedSceneId(),
                scenes,
                partyChoices,
                npcChoices,
                locationChoices,
                preparedChoices,
                true,
                workspace.encounterSynchronized(),
                status(workspace, party));
    }

    private static SceneSnapshot.SceneEntry sceneEntry(
            SceneWorkspace workspace,
            RunningScene scene,
            List<PartyMemberSummary> members,
            WorldPlannerSnapshot world
    ) {
        List<SceneSnapshot.PartyChoice> sceneMembers = scene.partyMemberIds().stream()
                .map(id -> partyChoice(findMember(members, id), scene.sceneId()))
                .toList();
        List<SceneSnapshot.NpcChoice> sceneNpcs = scene.npcIds().stream()
                .map(id -> npcChoice(findNpc(world, id), id, scene.sceneId()))
                .toList();
        return new SceneSnapshot.SceneEntry(
                scene.sceneId(),
                scene.title(),
                scene.notes(),
                scene.sceneId() == workspace.defaultSceneId(),
                scene.sceneId() == workspace.focusedSceneId(),
                new SceneSnapshot.Provenance(
                        scene.sourceSessionId(), scene.sourceSceneId(), scene.sourceSessionName()),
                scene.initialEncounterPlanId(),
                scene.locationId(),
                locationName(world, scene.locationId()),
                sceneMembers,
                sceneNpcs);
    }

    private static PartyMemberSummary findMember(List<PartyMemberSummary> members, long id) {
        return members.stream().filter(member -> member.id() != null && member.id().longValue() == id)
                .findFirst().orElse(new PartyMemberSummary(id, "PC #" + id, 0));
    }

    private static WorldNpcSummary findNpc(WorldPlannerSnapshot world, long id) {
        return world.npcs().stream().filter(npc -> npc.npcId() == id).findFirst().orElse(null);
    }

    private static SceneSnapshot.PartyChoice partyChoice(PartyMemberSummary member, long sceneId) {
        return new SceneSnapshot.PartyChoice(member.id(), member.name(), member.level(), sceneId);
    }

    private static SceneSnapshot.NpcChoice npcChoice(WorldNpcSummary npc, long sceneId) {
        return npcChoice(npc, npc.npcId(), sceneId);
    }

    private static SceneSnapshot.NpcChoice npcChoice(WorldNpcSummary npc, long id, long sceneId) {
        return npc == null
                ? new SceneSnapshot.NpcChoice(id, "NPC #" + id, 0L, sceneId, false)
                : new SceneSnapshot.NpcChoice(
                        npc.npcId(),
                        npc.displayName(),
                        npc.creatureStatblockId(),
                        sceneId,
                        npc.status() == WorldNpcLifecycleStatus.ACTIVE);
    }

    private static SceneSnapshot.LocationChoice locationChoice(
            SceneWorkspace workspace,
            WorldLocationSummary location
    ) {
        List<Long> sceneIds = workspace.scenes().stream()
                .filter(scene -> scene.locationId() == location.locationId())
                .map(RunningScene::sceneId)
                .toList();
        return new SceneSnapshot.LocationChoice(location.locationId(), location.displayName(), sceneIds);
    }

    private static String locationName(WorldPlannerSnapshot world, long id) {
        if (id <= 0L) {
            return "";
        }
        return world.locations().stream().filter(location -> location.locationId() == id)
                .map(WorldLocationSummary::displayName)
                .findFirst().orElse("Ort #" + id);
    }

    private static long sceneForPc(SceneWorkspace workspace, long id) {
        return workspace.scenes().stream().filter(scene -> scene.partyMemberIds().contains(id))
                .mapToLong(RunningScene::sceneId).findFirst().orElse(0L);
    }

    private static long sceneForNpc(SceneWorkspace workspace, long id) {
        return workspace.scenes().stream().filter(scene -> scene.npcIds().contains(id))
                .mapToLong(RunningScene::sceneId).findFirst().orElse(0L);
    }

    private static String status(SceneWorkspace workspace, ActivePartyResult party) {
        String status = party.status() == ReadStatus.SUCCESS
                ? workspace.statusText()
                : "Party konnte nicht geladen werden.";
        return workspace.encounterSynchronized()
                ? status
                : status + " Encounter-Synchronisierung ausstehend.";
    }
}
