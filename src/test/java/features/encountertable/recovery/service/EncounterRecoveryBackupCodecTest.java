package features.encountertable.recovery.service;

import features.encountertable.recovery.model.EntrySnapshot;
import features.encountertable.recovery.model.TableSnapshot;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EncounterRecoveryBackupCodecTest {
    @Test
    void roundTripPreservesSnapshotData() throws Exception {
        List<TableSnapshot> snapshot = List.of(
                new TableSnapshot(
                        7L,
                        "Underdark",
                        "Low-level creatures",
                        List.of(
                                new EntrySnapshot(101L, 3, "Goblin", "mm", "goblin"),
                                new EntrySnapshot(102L, 2, "Kobold", "mm", "kobold"))));

        String json = EncounterRecoveryBackupCodec.encode(LocalDateTime.of(2026, 3, 7, 12, 0), snapshot);
        List<TableSnapshot> decoded = EncounterRecoveryBackupCodec.decode(json);

        assertEquals(snapshot, decoded);
    }

    @Test
    void decodeFailsForMalformedJson() {
        IOException ex = assertThrows(IOException.class,
                () -> EncounterRecoveryBackupCodec.decode("{\"tables\": ["));
        assertTrue(ex.getMessage().contains("malformed JSON"));
    }

    @Test
    void decodeFailsWhenTablesFieldMissing() {
        IOException ex = assertThrows(IOException.class,
                () -> EncounterRecoveryBackupCodec.decode("{}"));
        assertTrue(ex.getMessage().contains("tables array missing"));
    }

    @Test
    void decodeSupportsLegacyBackupShape() throws Exception {
        String json = loadResource("/features/encountertable/recovery/legacy-backup.json");
        List<TableSnapshot> decoded = EncounterRecoveryBackupCodec.decode(json);

        assertEquals(1, decoded.size());
        assertEquals(1, decoded.getFirst().entries().size());
        assertEquals(42L, decoded.getFirst().entries().getFirst().creatureId());
        assertEquals(4, decoded.getFirst().entries().getFirst().weight());
    }

    private static String loadResource(String path) throws IOException {
        try (InputStream in = EncounterRecoveryBackupCodecTest.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IOException("Missing resource: " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
