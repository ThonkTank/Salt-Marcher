package features.scene.domain;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public record SceneWorkspace(
        long revision,
        long nextSceneId,
        long defaultSceneId,
        long focusedSceneId,
        boolean encounterSynchronized,
        String statusText,
        List<RunningScene> scenes
) {

    public SceneWorkspace {
        if (revision <= 0L || nextSceneId <= 1L || defaultSceneId <= 0L || focusedSceneId <= 0L) {
            throw new IllegalArgumentException("workspace identities and revision must be positive");
        }
        statusText = statusText == null ? "" : statusText;
        scenes = scenes == null ? List.of() : List.copyOf(scenes);
        validate(defaultSceneId, focusedSceneId, scenes);
    }

    public static SceneWorkspace initial(List<Long> activePartyMemberIds) {
        return new SceneWorkspace(1L, 2L, 1L, 1L, false, "Standardszene erstellt.",
                List.of(RunningScene.defaultScene(activePartyMemberIds)));
    }

    public RunningScene scene(long sceneId) {
        return scenes.stream().filter(scene -> scene.sceneId() == sceneId).findFirst().orElse(null);
    }

    public Set<Long> assignedPartyMemberIds() {
        Set<Long> assigned = new LinkedHashSet<>();
        scenes.forEach(scene -> assigned.addAll(scene.partyMemberIds()));
        return Set.copyOf(assigned);
    }

    public SceneWorkspace create(String title) {
        RunningScene created = new RunningScene(nextSceneId, title, "", 0L, 0L, "", 0L, 0L,
                List.of(), List.of());
        return changed(append(scenes, created), nextSceneId, nextSceneId + 1L, "Szene erstellt.");
    }

    public SceneWorkspace importPrepared(
            String title,
            String notes,
            long sourceSessionId,
            long sourceSceneId,
            String sourceSessionName,
            long initialEncounterPlanId,
            long locationId,
            List<Long> partyMemberIds,
            String status
    ) {
        RunningScene imported = new RunningScene(nextSceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId, partyMemberIds, List.of());
        return changed(append(scenes, imported), nextSceneId, nextSceneId + 1L, status);
    }

    public SceneWorkspace focus(long sceneId) {
        requireScene(sceneId);
        return changed(scenes, sceneId, nextSceneId, "Szene gewechselt.");
    }

    public SceneWorkspace updateDetails(long sceneId, String title, String notes) {
        return replace(requireScene(sceneId).withDetails(title, notes), focusedSceneId, "Szene aktualisiert.");
    }

    public SceneWorkspace delete(long sceneId) {
        if (sceneId == defaultSceneId) {
            throw new DefaultSceneProtectedException();
        }
        requireScene(sceneId);
        List<RunningScene> remaining = scenes.stream().filter(scene -> scene.sceneId() != sceneId).toList();
        long nextFocus = focusedSceneId == sceneId ? defaultSceneId : focusedSceneId;
        return changed(remaining, nextFocus, nextSceneId, "Szene gelöscht.");
    }

    public SceneWorkspace assignPc(long sceneId, long partyMemberId) {
        requireScene(sceneId);
        requirePositive(partyMemberId, "partyMemberId");
        List<RunningScene> assigned = scenes.stream()
                .map(scene -> scene.withPartyMembers(move(scene.partyMemberIds(), partyMemberId,
                        scene.sceneId() == sceneId)))
                .toList();
        return changed(assigned, focusedSceneId, nextSceneId, "PC verschoben.");
    }

    public SceneWorkspace unassignPc(long partyMemberId) {
        requirePositive(partyMemberId, "partyMemberId");
        List<RunningScene> assigned = scenes.stream()
                .map(scene -> scene.withPartyMembers(without(scene.partyMemberIds(), partyMemberId)))
                .toList();
        return changed(assigned, focusedSceneId, nextSceneId, "PC ist unzugeordnet.");
    }

    public SceneWorkspace assignNpc(long sceneId, long npcId) {
        requireScene(sceneId);
        requirePositive(npcId, "npcId");
        List<RunningScene> assigned = scenes.stream()
                .map(scene -> scene.withNpcs(move(scene.npcIds(), npcId, scene.sceneId() == sceneId)))
                .toList();
        return changed(assigned, focusedSceneId, nextSceneId, "NPC verschoben.");
    }

    public SceneWorkspace unassignNpc(long npcId) {
        requirePositive(npcId, "npcId");
        List<RunningScene> assigned = scenes.stream()
                .map(scene -> scene.withNpcs(without(scene.npcIds(), npcId)))
                .toList();
        return changed(assigned, focusedSceneId, nextSceneId, "NPC entfernt.");
    }

    public SceneWorkspace setLocation(long sceneId, long locationId) {
        if (locationId < 0L) {
            throw new IllegalArgumentException("locationId must not be negative");
        }
        return replace(requireScene(sceneId).withLocation(locationId), focusedSceneId, "Ort aktualisiert.");
    }

    public SceneWorkspace retainActivePartyMembers(Set<Long> activeIds) {
        Set<Long> safeIds = activeIds == null ? Set.of() : Set.copyOf(activeIds);
        List<RunningScene> retained = scenes.stream()
                .map(scene -> scene.withPartyMembers(scene.partyMemberIds().stream().filter(safeIds::contains).toList()))
                .toList();
        return retained.equals(scenes)
                ? this
                : changed(retained, focusedSceneId, nextSceneId, "Inaktive PCs wurden entfernt.");
    }

    public SceneWorkspace refresh(String status) {
        return changed(scenes, focusedSceneId, nextSceneId, status);
    }

    public SceneWorkspace withEncounterSynchronized(boolean synchronizedState, String status) {
        return new SceneWorkspace(revision, nextSceneId, defaultSceneId, focusedSceneId,
                synchronizedState, status, scenes);
    }

    private SceneWorkspace replace(RunningScene replacement, long focus, String status) {
        List<RunningScene> replaced = scenes.stream()
                .map(scene -> scene.sceneId() == replacement.sceneId() ? replacement : scene)
                .toList();
        return changed(replaced, focus, nextSceneId, status);
    }

    private SceneWorkspace changed(List<RunningScene> nextScenes, long focus, long nextId, String status) {
        return new SceneWorkspace(revision + 1L, nextId, defaultSceneId, focus, false, status, nextScenes);
    }

    private RunningScene requireScene(long sceneId) {
        RunningScene existing = scene(sceneId);
        if (existing == null) {
            throw new SceneNotFoundException();
        }
        return existing;
    }

    private static List<Long> move(List<Long> ids, long id, boolean target) {
        List<Long> moved = new ArrayList<>(without(ids, id));
        if (target) {
            moved.add(id);
        }
        return List.copyOf(moved);
    }

    private static List<Long> without(List<Long> ids, long id) {
        return ids.stream().filter(candidate -> candidate.longValue() != id).toList();
    }

    private static <T> List<T> append(List<T> values, T value) {
        List<T> result = new ArrayList<>(values);
        result.add(value);
        return List.copyOf(result);
    }

    private static void requirePositive(long id, String name) {
        if (id <= 0L) {
            throw new IllegalArgumentException(name + " must be positive");
        }
    }

    private static void validate(long defaultId, long focusedId, List<RunningScene> values) {
        if (values.isEmpty()
                || values.stream().noneMatch(scene -> scene.sceneId() == defaultId)
                || values.stream().noneMatch(scene -> scene.sceneId() == focusedId)) {
            throw new IllegalArgumentException("default and focused scene must exist");
        }
        Set<Long> sceneIds = new LinkedHashSet<>();
        Set<Long> pcIds = new LinkedHashSet<>();
        Set<Long> npcIds = new LinkedHashSet<>();
        for (RunningScene scene : values) {
            if (!sceneIds.add(scene.sceneId())
                    || !addAllUnique(pcIds, scene.partyMemberIds())
                    || !addAllUnique(npcIds, scene.npcIds())) {
                throw new IllegalArgumentException("scene, PC and NPC assignments must be unique");
            }
        }
    }

    private static boolean addAllUnique(Set<Long> target, List<Long> ids) {
        for (Long id : ids) {
            if (!target.add(id)) {
                return false;
            }
        }
        return true;
    }

    public static final class SceneNotFoundException extends IllegalArgumentException { }

    public static final class DefaultSceneProtectedException extends IllegalArgumentException { }
}
