package features.sessionplanner.application;

import features.sessionplanner.domain.session.SessionRevision;
import java.util.List;
import java.util.Objects;

public final class PreparedSessionPersistenceFingerprint {

    private PreparedSessionPersistenceFingerprint() {
    }

    public static String compute(
            long sessionId,
            SessionRevision expectedRevision,
            String preparationIdentity,
            List<Scene> scenes,
            List<Rest> rests,
            long selectedSceneId,
            List<ManualLootNote> notes,
            List<GeneratedRewardReference> rewards,
            String generationRunIdentity,
            List<EncounterPlanMapping> orderedMappings
    ) {
        Objects.requireNonNull(expectedRevision, "expectedRevision");
        CanonicalSha256DigestWriter output = new CanonicalSha256DigestWriter()
                .writeText("prepared-session-persistence-v1")
                .writeLong(sessionId)
                .writeLong(expectedRevision.value())
                .writeText(required(preparationIdentity))
                .writeInt(scenes.size());
        for (Scene scene : scenes) {
            output.writeLong(scene.sceneId())
                    .writeInt(scene.encounterNumber())
                    .writeText(scene.allocationDecimal())
                    .writeText(scene.title())
                    .writeText(scene.notes())
                    .writeLong(scene.locationId());
        }
        output.writeInt(rests.size());
        for (Rest rest : rests) {
            output.writeLong(rest.leftSceneId()).writeLong(rest.rightSceneId()).writeText(rest.kind());
        }
        output.writeLong(selectedSceneId).writeInt(notes.size());
        for (ManualLootNote note : notes) {
            output.writeLong(note.noteId()).writeLong(note.sceneId()).writeText(note.authoredText());
        }
        output.writeInt(rewards.size());
        for (GeneratedRewardReference reward : rewards) {
            output.writeLong(reward.sceneId())
                    .writeText(reward.generationRunIdentity())
                    .writeLong(reward.treasureId())
                    .writeText(reward.lastKnownLabel());
        }
        output.writeText(required(generationRunIdentity)).writeInt(orderedMappings.size());
        for (EncounterPlanMapping mapping : orderedMappings) {
            output.writeInt(mapping.encounterNumber()).writeLong(mapping.planId());
        }
        return output.finishV1();
    }

    private static String required(String value) {
        String normalized = Objects.requireNonNull(value, "value").trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("fingerprint input must not be blank");
        }
        return normalized;
    }

    public record Scene(
            long sceneId,
            int encounterNumber,
            String allocationDecimal,
            String title,
            String notes,
            long locationId
    ) {

        public Scene {
            allocationDecimal = required(allocationDecimal);
            title = required(title);
            notes = Objects.requireNonNullElse(notes, "").trim();
        }
    }

    public record Rest(long leftSceneId, long rightSceneId, String kind) {
        public Rest { kind = required(kind); }
    }

    public record ManualLootNote(long noteId, long sceneId, String authoredText) {
        public ManualLootNote { authoredText = required(authoredText); }
    }

    public record GeneratedRewardReference(
            long sceneId,
            String generationRunIdentity,
            long treasureId,
            String lastKnownLabel
    ) {
        public GeneratedRewardReference {
            generationRunIdentity = required(generationRunIdentity);
            lastKnownLabel = Objects.requireNonNullElse(lastKnownLabel, "").trim();
        }
    }

    public record EncounterPlanMapping(int encounterNumber, long planId) {
    }
}
