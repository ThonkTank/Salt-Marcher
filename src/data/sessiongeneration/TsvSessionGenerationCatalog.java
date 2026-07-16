package src.data.sessiongeneration;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.sessiongeneration.SessionGenerationCatalog;

public final class TsvSessionGenerationCatalog implements SessionGenerationCatalog {

    public static final String CONTENT_HASH = "f87f6046444b7bf17814fae71c17802f4f875bfe4e4c9ec75574a1fc01a07621";
    private static final String ROOT = "/sessiongeneration/sheet-v1/";
    private static final Map<String, Integer> EXPECTED_ROWS = Map.ofEntries(
            Map.entry("DB_Progression", 20),
            Map.entry("DB_CR", 34),
            Map.entry("DB_EncounterRoleBands", 680),
            Map.entry("DB_EncounterPatterns", 24),
            Map.entry("DB_LootItems", 681),
            Map.entry("DB_LootModifiers", 59),
            Map.entry("DB_LootRelations", 1698),
            Map.entry("DB_Themes", 8),
            Map.entry("DB_MagicItems", 552),
            Map.entry("DB_MagicVariants", 41),
            Map.entry("DB_MagicDecisionTypes", 5),
            Map.entry("DB_Spells", 450),
            Map.entry("DB_Containers", 28),
            Map.entry("DB_EnspelledRules", 45),
            Map.entry("DB_MagicCurses", 300),
            Map.entry("DB_LootSources", 8));

    private final Map<String, List<Map<String, String>>> tables;

    public TsvSessionGenerationCatalog() {
        Map<String, List<Map<String, String>>> loaded = new LinkedHashMap<>();
        EXPECTED_ROWS.forEach((name, expected) -> loaded.put(name, load(name, expected)));
        tables = Map.copyOf(loaded);
    }

    @Override
    public List<Map<String, String>> table(String name) {
        return tables.getOrDefault(name, List.of());
    }

    @Override
    public String contentHash() {
        return CONTENT_HASH;
    }

    private static List<Map<String, String>> load(String name, int expectedRows) {
        try (InputStream input = TsvSessionGenerationCatalog.class.getResourceAsStream(ROOT + name + ".tsv")) {
            if (input == null) {
                throw new IllegalStateException("Missing sheet-v1 table: " + name);
            }
            List<Map<String, String>> rows = parse(input);
            if (rows.size() != expectedRows) {
                throw new IllegalStateException(name + " expected " + expectedRows + " rows but found " + rows.size());
            }
            return List.copyOf(rows);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not load sheet-v1 table: " + name, exception);
        }
    }

    private static List<Map<String, String>> parse(InputStream input) throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                return List.of();
            }
            String[] headers = headerLine.split("\\t", -1);
            List<Map<String, String>> rows = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                String[] values = line.split("\\t", -1);
                Map<String, String> row = new LinkedHashMap<>();
                for (int index = 0; index < headers.length; index++) {
                    row.put(headers[index], index < values.length ? values[index] : "");
                }
                rows.add(Map.copyOf(row));
            }
            return rows;
        }
    }
}
