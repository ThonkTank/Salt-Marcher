package features.sessionplanner.application;

import features.sessionplanner.domain.session.SessionRevision;
import features.sessionplanner.domain.session.SessionTreasure;
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
            List<SessionTreasure> treasures,
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
        output.writeInt(treasures.size());
        for (SessionTreasure treasure : treasures) {
            output.writeLong(treasure.sceneId()).writeLong(treasure.treasureId())
                    .writeText(treasure.title()).writeText(treasure.note())
                    .writeText(treasure.stockClass()).writeText(treasure.channel())
                    .writeText(treasure.theme()).writeText(treasure.magicType())
                    .writeLong(treasure.targetCp()).writeInt(treasure.nonMagicSlots())
                    .writeInt(treasure.magicSlots()).writeInt(treasure.items().size());
            for (SessionTreasure.Item item : treasure.items()) {
                output.writeLong(item.lineId()).writeText(item.role()).writeText(item.itemId())
                        .writeText(item.text()).writeLong(item.quantity()).writeLong(item.unitCp())
                        .writeLong(item.actualCp()).writeText(item.totalCapacity().toPlainString())
                        .writeText(item.allowedContainers()).writeText(item.magicRarity())
                        .writeBoolean(item.cursed());
            }
            output.writeInt(treasure.packing().size());
            for (SessionTreasure.Packing row : treasure.packing()) {
                output.writeLong(row.lineId()).writeText(row.containerType()).writeInt(row.containerCount())
                        .writeText(row.containerId()).writeBoolean(row.valid());
            }
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

    public record EncounterPlanMapping(int encounterNumber, long planId) {
    }
}
