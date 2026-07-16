package src.domain.scene.model;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public record SceneWorkspace(
        long revision,
        long nextSceneId,
        long defaultSceneId,
        long focusedSceneId,
        List<RunningScene> scenes,
        String statusText
) {
    public SceneWorkspace {
        revision = Math.max(1L, revision);
        nextSceneId = Math.max(2L, nextSceneId);
        scenes = scenes == null ? List.of() : List.copyOf(scenes);
        statusText = statusText == null ? "" : statusText;
        validate(defaultSceneId, focusedSceneId, scenes);
    }

    public static SceneWorkspace initial(List<Long> activePartyIds) {
        RunningScene standard = new RunningScene(1L, "Standardszene", "", 0L, 0L, 0L, 0L,
                activePartyIds, List.of());
        return new SceneWorkspace(1L, 2L, 1L, 1L, List.of(standard), "Standardszene bereit.");
    }

    public RunningScene focusedScene() {
        return scene(focusedSceneId);
    }

    public RunningScene scene(long id) {
        return scenes.stream().filter(scene -> scene.sceneId() == id).findFirst().orElse(null);
    }

    public Set<Long> assignedPartyMemberIds() {
        Set<Long> result = new HashSet<>();
        for (RunningScene scene : scenes) {
            result.addAll(scene.partyMemberIds());
        }
        return Set.copyOf(result);
    }

    public SceneWorkspace replace(List<RunningScene> nextScenes, long focus, long nextId, String status) {
        return new SceneWorkspace(revision + 1L, nextId, defaultSceneId, focus, nextScenes, status);
    }

    private static void validate(long defaultId, long focusedId, List<RunningScene> values) {
        if (values.isEmpty() || values.stream().noneMatch(scene -> scene.sceneId() == defaultId)
                || values.stream().noneMatch(scene -> scene.sceneId() == focusedId)) {
            throw new IllegalArgumentException("default and focused scene must exist");
        }
        Set<Long> pcIds = new HashSet<>();
        for (RunningScene scene : values) {
            for (Long pcId : scene.partyMemberIds()) {
                if (!pcIds.add(pcId)) {
                    throw new IllegalArgumentException("PC may belong to at most one running scene");
                }
            }
        }
    }
}
