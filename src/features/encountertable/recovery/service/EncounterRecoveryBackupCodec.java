package features.encountertable.recovery.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import features.encountertable.recovery.model.EntrySnapshot;
import features.encountertable.recovery.model.TableSnapshot;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

public final class EncounterRecoveryBackupCodec {
    private static final ObjectMapper MAPPER = buildMapper();

    private EncounterRecoveryBackupCodec() {
        throw new AssertionError("No instances");
    }

    public static String encode(LocalDateTime generatedAt, List<TableSnapshot> snapshot) throws IOException {
        try {
            return MAPPER.writerWithDefaultPrettyPrinter()
                    .writeValueAsString(new BackupDocument(generatedAt, snapshot));
        } catch (JsonProcessingException e) {
            throw new IOException("Failed to encode encounter backup JSON", e);
        }
    }

    public static List<TableSnapshot> decode(String content) throws IOException {
        BackupDocument document;
        try {
            document = MAPPER.readValue(content, BackupDocument.class);
        } catch (JsonProcessingException e) {
            throw new IOException("Invalid backup format: malformed JSON", e);
        }
        if (document.tables() == null) {
            throw new IOException("Invalid backup format: tables array missing");
        }
        for (TableSnapshot table : document.tables()) {
            if (table == null) {
                throw new IOException("Invalid backup format: table object expected");
            }
            if (table.entries() == null) {
                throw new IOException("Invalid backup format: table entries array expected");
            }
            for (EntrySnapshot entry : table.entries()) {
                if (entry == null) {
                    throw new IOException("Invalid backup format: entry object expected");
                }
            }
        }
        return List.copyOf(document.tables());
    }

    private static ObjectMapper buildMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        return mapper;
    }

    private record BackupDocument(LocalDateTime generatedAt, List<TableSnapshot> tables) {}
}
