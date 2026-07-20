package features.scene.domain;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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
        List<Long> npcIds,
        List<SceneMob> mobs,
        List<SceneParticipantState> participantStates
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
        mobs = normalizeMobs(mobs);
        participantStates = normalizeStates(participantStates, partyMemberIds, npcIds, mobs);
    }

    public static RunningScene defaultScene(List<Long> activePartyMemberIds) {
        return new RunningScene(1L, "Standardszene", "", 0L, 0L, "", 0L, 0L,
                activePartyMemberIds, List.of(), List.of(), List.of());
    }

    public RunningScene withDetails(String nextTitle, String nextNotes) {
        return new RunningScene(sceneId, nextTitle, nextNotes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId,
                partyMemberIds, npcIds, mobs, participantStates);
    }

    public RunningScene withPartyMembers(List<Long> ids) {
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId,
                ids, npcIds, mobs, participantStates);
    }

    public RunningScene withNpcs(List<Long> ids) {
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId,
                partyMemberIds, ids, mobs, participantStates);
    }

    public RunningScene withMobs(List<SceneMob> nextMobs) {
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId,
                partyMemberIds, npcIds, nextMobs, participantStates);
    }

    public RunningScene withLocation(long id) {
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, id,
                partyMemberIds, npcIds, mobs, participantStates);
    }

    public RunningScene withParticipantState(SceneParticipantState state) {
        List<SceneParticipantState> next = new ArrayList<>();
        boolean replaced = false;
        for (SceneParticipantState existing : participantStates) {
            if (existing.addressesSameParticipant(state.kind(), state.refId())) {
                next.add(state);
                replaced = true;
            } else {
                next.add(existing);
            }
        }
        if (!replaced) {
            next.add(state);
        }
        return new RunningScene(sceneId, title, notes, sourceSessionId, sourceSceneId,
                sourceSessionName, initialEncounterPlanId, locationId,
                partyMemberIds, npcIds, mobs, next);
    }

    public SceneParticipantState participantState(SceneParticipantKind kind, long refId) {
        return participantStates.stream()
                .filter(state -> state.addressesSameParticipant(kind, refId))
                .findFirst()
                .orElse(new SceneParticipantState(kind, refId, false, ""));
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

    private static List<SceneMob> normalizeMobs(List<SceneMob> values) {
        if (values == null) {
            return List.of();
        }
        LinkedHashMap<Long, SceneMob> byCreature = new LinkedHashMap<>();
        for (SceneMob mob : values) {
            if (mob != null) {
                byCreature.put(mob.creatureId(), mob);
            }
        }
        return List.copyOf(byCreature.values());
    }

    private static List<SceneParticipantState> normalizeStates(
            List<SceneParticipantState> values,
            List<Long> partyMemberIds,
            List<Long> npcIds,
            List<SceneMob> mobs
    ) {
        if (values == null) {
            return List.of();
        }
        LinkedHashMap<String, SceneParticipantState> byParticipant = new LinkedHashMap<>();
        for (SceneParticipantState state : values) {
            if (state != null && isPresent(state, partyMemberIds, npcIds, mobs)) {
                byParticipant.put(state.kind() + ":" + state.refId(), state);
            }
        }
        return List.copyOf(byParticipant.values());
    }

    private static boolean isPresent(
            SceneParticipantState state,
            List<Long> partyMemberIds,
            List<Long> npcIds,
            List<SceneMob> mobs
    ) {
        return switch (state.kind()) {
            case PC -> partyMemberIds.contains(state.refId());
            case NPC -> npcIds.contains(state.refId());
            case MOB -> mobs.stream().anyMatch(mob -> mob.creatureId() == state.refId());
        };
    }
}
