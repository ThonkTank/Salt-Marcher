package features.scene.domain;

import java.util.List;

public record RunningScene(
        long sceneId,
        String title,
        String notes,
        long sourceSessionId,
        long sourceSceneId,
        String sourceSessionName,
        long initialEncounterPlanId,
        long locationId,
        List<Long> partyMemberIds,
        List<Long> npcIds
) {

    public RunningScene {
        if (sceneId <= 0L) {
            throw new IllegalArgumentException("sceneId must be positive");
        }
        title = normalizeTitle(title, sceneId);
        notes = notes == null ? "" : notes.trim();
        sourceSessionId = Math.max(0L, sourceSessionId);
        sourceSceneId = Math.max(0L, sourceSceneId);
        sourceSessionName = sourceSessionName == null ? "" : sourceSessionName.trim();
        initialEncounterPlanId = Math.max(0L, initialEncounterPlanId);
        locationId = Math.max(0L, locationId);
        partyMemberIds = positiveDistinct(partyMemberIds);
        npcIds = positiveDistinct(npcIds);
    }

    public static RunningScene defaultScene(List<Long> activePartyMemberIds) {
        return new RunningScene(1L, "Standardszene", "", 0L, 0L, "", 0L, 0L,
                activePartyMemberIds, List.of());
    }

    public RunningScene withDetails(String nextTitle, String nextNotes) {
        return new RunningScene(sceneId, nextTitle, nextNotes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId, partyMemberIds, npcIds);
    }

    public RunningScene withPartyMembers(List<Long> ids) {
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId, ids, npcIds);
    }

    public RunningScene withNpcs(List<Long> ids) {
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId, partyMemberIds, ids);
    }

    public RunningScene withLocation(long id) {
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, id, partyMemberIds, npcIds);
    }

    private static String normalizeTitle(String value, long id) {
        String candidate = value == null ? "" : value.trim();
        return candidate.isBlank() ? "Szene " + id : candidate;
    }

    private static List<Long> positiveDistinct(List<Long> values) {
        return values == null ? List.of() : values.stream()
                .filter(id -> id != null && id.longValue() > 0L)
                .distinct()
                .toList();
    }
}
