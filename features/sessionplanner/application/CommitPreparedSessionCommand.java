package features.sessionplanner.application;

import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionRevision;
import features.sessionplanner.domain.session.SessionTreasure;
import java.util.List;
import java.util.Objects;

public record CommitPreparedSessionCommand(
        long sessionId,
        SessionRevision expectedRevision,
        String preparationIdentity,
        String preparedContentFingerprint,
        List<Scene> scenes,
        List<Rest> rests,
        long selectedSceneId,
        List<ManualLootNote> manualLootNotes,
        List<SessionTreasure> treasures,
        String committedGenerationRunIdentity,
        List<EncounterPlanMapping> encounterPlanMappings
) {

    public CommitPreparedSessionCommand {
        if (sessionId <= 0L) {
            throw new IllegalArgumentException("session id must be positive");
        }
        expectedRevision = Objects.requireNonNull(expectedRevision, "expectedRevision");
        preparationIdentity = fingerprint(preparationIdentity, "preparation identity");
        preparedContentFingerprint = fingerprint(preparedContentFingerprint, "prepared content fingerprint");
        scenes = List.copyOf(Objects.requireNonNull(scenes, "scenes"));
        rests = List.copyOf(Objects.requireNonNull(rests, "rests"));
        manualLootNotes = List.copyOf(Objects.requireNonNull(manualLootNotes, "manualLootNotes"));
        treasures = List.copyOf(Objects.requireNonNull(treasures, "treasures"));
        committedGenerationRunIdentity = required(committedGenerationRunIdentity, "committed generation run identity");
        encounterPlanMappings = List.copyOf(Objects.requireNonNull(encounterPlanMappings, "encounterPlanMappings"));
    }

    public record Scene(
            long sceneId,
            int encounterNumber,
            long encounterPlanId,
            SessionEncounterAllocation allocation,
            String title,
            String notes,
            long locationId
    ) {

        public Scene {
            if (sceneId <= 0L || encounterNumber < 0 || encounterPlanId < 0L
                    || allocation == null || locationId < 0L) {
                throw new IllegalArgumentException("prepared scene carrier is invalid");
            }
            title = required(title, "scene title");
            notes = Objects.requireNonNullElse(notes, "").trim();
        }
    }

    public record Rest(long leftSceneId, long rightSceneId, String kind) {

        public Rest {
            if (leftSceneId <= 0L || rightSceneId <= 0L) {
                throw new IllegalArgumentException("rest scene ids must be positive");
            }
            kind = required(kind, "rest kind");
        }
    }

    public record ManualLootNote(long noteId, long sceneId, String authoredText) {

        public ManualLootNote {
            if (noteId <= 0L || sceneId <= 0L) {
                throw new IllegalArgumentException("manual note ids must be positive");
            }
            authoredText = required(authoredText, "manual note text");
        }
    }

    public record EncounterPlanMapping(int encounterNumber, long planId) {

        public EncounterPlanMapping {
            if (encounterNumber <= 0 || planId <= 0L) {
                throw new IllegalArgumentException("encounter plan mapping is invalid");
            }
        }
    }

    private static String fingerprint(String value, String name) {
        String normalized = required(value, name);
        if (!normalized.matches("v1:[0-9a-f]{64}")) {
            throw new IllegalArgumentException(name + " must use canonical v1 SHA-256");
        }
        return normalized;
    }

    private static String required(String value, String name) {
        String normalized = Objects.requireNonNull(value, name).trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return normalized;
    }
}
