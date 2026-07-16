package src.domain.scene.model;

import java.util.List;

public record RunningScene(
        long sceneId,
        String title,
        String notes,
        long sourceSessionId,
        long sourceSceneId,
        long sourceEncounterPlanId,
        long locationId,
        List<Long> partyMemberIds,
        List<Long> npcIds
) {
    public RunningScene {
        if (sceneId <= 0L) {
            throw new IllegalArgumentException("sceneId must be positive");
        }
        title = title == null || title.isBlank() ? "Szene " + sceneId : title.trim();
        notes = notes == null ? "" : notes.trim();
        sourceSessionId = Math.max(0L, sourceSessionId);
        sourceSceneId = Math.max(0L, sourceSceneId);
        sourceEncounterPlanId = Math.max(0L, sourceEncounterPlanId);
        locationId = Math.max(0L, locationId);
        partyMemberIds = normalize(partyMemberIds);
        npcIds = normalize(npcIds);
    }

    public RunningScene withDetails(String nextTitle, String nextNotes) {
        return copy(nextTitle, nextNotes, locationId, partyMemberIds, npcIds);
    }

    public RunningScene withLocation(long nextLocationId) {
        return copy(title, notes, Math.max(0L, nextLocationId), partyMemberIds, npcIds);
    }

    public RunningScene withPartyMembers(List<Long> ids) {
        return copy(title, notes, locationId, ids, npcIds);
    }

    public RunningScene withNpcs(List<Long> ids) {
        return copy(title, notes, locationId, partyMemberIds, ids);
    }

    private RunningScene copy(String nextTitle, String nextNotes, long nextLocationId, List<Long> pcs, List<Long> npcs) {
        return new RunningScene(sceneId, nextTitle, nextNotes, sourceSessionId, sourceSceneId,
                sourceEncounterPlanId, nextLocationId, pcs, npcs);
    }

    private static List<Long> normalize(List<Long> ids) {
        if (ids == null) {
            return List.of();
        }
        return ids.stream().filter(id -> id != null && id > 0L).distinct().toList();
    }
}
