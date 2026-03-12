package features.encounter.service;

import database.DatabaseManager;
import features.encounter.model.Encounter;
import features.encounter.repository.EncounterRepository;

import java.sql.Connection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class EncounterStorageService {

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public enum SaveStatus {
        SAVED,
        STORAGE_ERROR,
        INVALID_INPUT
    }

    public record EncounterSummary(
            long encounterId,
            String name,
            String difficulty,
            String shapeLabel,
            int slotCount
    ) {}

    public record StoredEncounter(
            long encounterId,
            String name,
            Encounter encounter
    ) {}

    public record EncounterSummaryCatalogResult(ReadStatus status, List<EncounterSummary> encounters) {}
    public record StoredEncounterResult(ReadStatus status, StoredEncounter encounter) {}
    public record SaveEncounterResult(SaveStatus status, Long encounterId) {}

    private EncounterStorageService() {
        throw new AssertionError("No instances");
    }

    public static EncounterSummaryCatalogResult loadAllSummaries() {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<EncounterSummary> summaries = EncounterRepository.getAllSummaries(conn).stream()
                    .map(row -> new EncounterSummary(
                            row.encounterId(),
                            row.name(),
                            row.difficulty(),
                            row.shapeLabel(),
                            row.slotCount()))
                    .toList();
            return new EncounterSummaryCatalogResult(ReadStatus.SUCCESS, summaries);
        } catch (Exception ex) {
            return new EncounterSummaryCatalogResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public static StoredEncounterResult loadEncounter(long encounterId) {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<EncounterRepository.StoredEncounterRow> row = EncounterRepository.findEncounter(conn, encounterId);
            return new StoredEncounterResult(
                    ReadStatus.SUCCESS,
                    row.map(value -> new StoredEncounter(value.encounterId(), value.name(), value.encounter())).orElse(null));
        } catch (Exception ex) {
            return new StoredEncounterResult(ReadStatus.STORAGE_ERROR, null);
        }
    }

    public static SaveEncounterResult saveEncounter(String name, Encounter encounter) {
        if (name == null || name.isBlank() || encounter == null || encounter.slots().isEmpty()) {
            return new SaveEncounterResult(SaveStatus.INVALID_INPUT, null);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            long encounterId = EncounterRepository.insertEncounter(conn, name.trim(), normalizeEncounter(encounter));
            return new SaveEncounterResult(SaveStatus.SAVED, encounterId);
        } catch (Exception ex) {
            return new SaveEncounterResult(SaveStatus.STORAGE_ERROR, null);
        }
    }

    private static Encounter normalizeEncounter(Encounter encounter) {
        Objects.requireNonNull(encounter, "encounter");
        return new Encounter(
                encounter.slots(),
                encounter.difficulty(),
                Math.max(1, encounter.averageLevel()),
                Math.max(1, encounter.partySize()),
                Math.max(0, encounter.xpBudget()),
                encounter.shapeLabel());
    }
}
