package src.domain.scene.published;

import java.util.List;
import src.domain.worldplanner.published.WorldDispositionKind;

public record SceneSnapshot(
        long revision,
        long defaultSceneId,
        long focusedSceneId,
        List<SceneEntry> scenes,
        List<PartyChoice> unassignedPartyMembers,
        List<PartyChoice> activePartyMembers,
        List<NpcChoice> availableNpcs,
        List<LocationChoice> availableLocations,
        List<PreparedChoice> preparedScenes,
        boolean encounterSynchronized,
        String statusText
) {
    public SceneSnapshot {
        scenes = copy(scenes);
        unassignedPartyMembers = copy(unassignedPartyMembers);
        activePartyMembers = copy(activePartyMembers);
        availableNpcs = copy(availableNpcs);
        availableLocations = copy(availableLocations);
        preparedScenes = copy(preparedScenes);
        statusText = statusText == null ? "" : statusText;
    }

    public record SceneEntry(
            long sceneId,
            String title,
            String notes,
            boolean defaultScene,
            boolean focused,
            long sourceSessionId,
            long sourceSceneId,
            long locationId,
            String locationName,
            List<PartyChoice> partyMembers,
            List<NpcChoice> npcs
    ) {
        public SceneEntry {
            title = text(title);
            notes = text(notes);
            locationName = text(locationName);
            partyMembers = copy(partyMembers);
            npcs = copy(npcs);
        }
    }

    public record PartyChoice(long id, String name, int level, long sceneId) {
        public PartyChoice { name = text(name); }
    }

    public record NpcChoice(
            long id,
            String name,
            long creatureId,
            WorldDispositionKind disposition,
            int effectiveDisposition,
            boolean active,
            long sceneId
    ) {
        public NpcChoice {
            name = text(name);
            disposition = disposition == null ? WorldDispositionKind.NEUTRAL : disposition;
        }
    }

    public record LocationChoice(long id, String name, long sceneId) {
        public LocationChoice { name = text(name); }
    }

    public record PreparedChoice(long sessionId, long sceneId, String sessionName, String title) {
        public PreparedChoice { sessionName = text(sessionName); title = text(title); }
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }
}
