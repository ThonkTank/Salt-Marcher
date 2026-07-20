package features.scene.api;

import java.util.List;

public record SceneSnapshot(
        long revision,
        long defaultSceneId,
        long focusedSceneId,
        List<SceneEntry> scenes,
        List<PartyChoice> activePartyMembers,
        List<NpcChoice> availableNpcs,
        List<LocationChoice> availableLocations,
        List<CreatureChoice> availableCreatures,
        List<PreparedChoice> preparedScenes,
        boolean initialized,
        boolean encounterSynchronized,
        String statusText
) {

    public SceneSnapshot {
        revision = Math.max(0L, revision);
        defaultSceneId = Math.max(0L, defaultSceneId);
        focusedSceneId = Math.max(0L, focusedSceneId);
        scenes = copy(scenes);
        activePartyMembers = copy(activePartyMembers);
        availableNpcs = copy(availableNpcs);
        availableLocations = copy(availableLocations);
        availableCreatures = copy(availableCreatures);
        preparedScenes = copy(preparedScenes);
        statusText = statusText == null ? "" : statusText;
    }

    public static SceneSnapshot uninitialized() {
        return new SceneSnapshot(0L, 0L, 0L, List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), false, false, "Szenen werden geladen.");
    }

    public record SceneEntry(
            long sceneId,
            String title,
            String notes,
            boolean defaultScene,
            boolean focused,
            Provenance provenance,
            long initialEncounterPlanId,
            long locationId,
            String locationName,
            List<PartyChoice> partyMembers,
            List<NpcChoice> npcs,
            List<MobChoice> mobs,
            List<ParticipantStateView> participantStates
    ) {
        public SceneEntry {
            title = normalized(title, "Szene " + sceneId);
            notes = notes == null ? "" : notes;
            provenance = provenance == null ? Provenance.none() : provenance;
            locationName = locationName == null ? "" : locationName;
            partyMembers = copy(partyMembers);
            npcs = copy(npcs);
            mobs = copy(mobs);
            participantStates = copy(participantStates);
        }

        public ParticipantStateView participantState(SceneParticipantKind kind, long refId) {
            return participantStates.stream()
                    .filter(state -> state.kind() == kind && state.refId() == refId)
                    .findFirst()
                    .orElse(new ParticipantStateView(kind, refId, false, ""));
        }
    }

    public record ParticipantStateView(SceneParticipantKind kind, long refId, boolean defeated, String notes) {
        public ParticipantStateView {
            refId = Math.max(0L, refId);
            notes = notes == null ? "" : notes;
        }
    }

    public record Provenance(long sourceSessionId, long sourceSceneId, String sourceSessionName) {
        public Provenance {
            sourceSessionId = Math.max(0L, sourceSessionId);
            sourceSceneId = Math.max(0L, sourceSceneId);
            sourceSessionName = sourceSessionName == null ? "" : sourceSessionName;
        }

        public static Provenance none() {
            return new Provenance(0L, 0L, "");
        }

        public boolean present() {
            return sourceSessionId > 0L && sourceSceneId > 0L;
        }
    }

    public record PartyChoice(long id, String name, int level, long sceneId) {
        public PartyChoice {
            name = normalized(name, "PC #" + id);
            level = Math.max(0, level);
            sceneId = Math.max(0L, sceneId);
        }
    }

    public record NpcChoice(long id, String name, long statblockId, long sceneId, boolean active) {
        public NpcChoice {
            name = normalized(name, "NPC #" + id);
            statblockId = Math.max(0L, statblockId);
            sceneId = Math.max(0L, sceneId);
        }
    }

    public record LocationChoice(long id, String name, List<Long> sceneIds) {
        public LocationChoice {
            name = normalized(name, "Ort #" + id);
            sceneIds = copy(sceneIds);
        }
    }

    public record CreatureChoice(
            long id,
            String name,
            String challengeRating,
            int hitPoints,
            int armorClass
    ) {
        public CreatureChoice {
            name = normalized(name, "Kreatur #" + id);
            challengeRating = challengeRating == null ? "" : challengeRating;
        }
    }

    public record MobChoice(
            long creatureId,
            String name,
            int count,
            String challengeRating,
            int hitPoints,
            int armorClass
    ) {
        public MobChoice {
            name = normalized(name, "Kreatur #" + creatureId);
            count = Math.max(0, count);
            challengeRating = challengeRating == null ? "" : challengeRating;
        }
    }

    public record PreparedChoice(long sessionId, long sceneId, String sessionName, String title) {
        public PreparedChoice {
            sessionName = normalized(sessionName, "Session #" + sessionId);
            title = normalized(title, "Szene " + sceneId);
        }
    }

    private static String normalized(String value, String fallback) {
        String candidate = value == null ? "" : value.trim();
        return candidate.isBlank() ? fallback : candidate;
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
