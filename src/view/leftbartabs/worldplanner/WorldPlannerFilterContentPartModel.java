package src.view.leftbartabs.worldplanner;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import src.domain.encountertable.published.EncounterTableCatalogResult;
import src.domain.encountertable.published.EncounterTableSummary;

final class WorldPlannerFilterContentPartModel {

    private WorldPlannerFilterContentPartModel() {
    }

    static List<String> values(Map<String, List<String>> filters, String key) {
        if (filters == null) {
            return List.of();
        }
        List<String> values = filters.get(key);
        return values == null ? List.of() : List.copyOf(values);
    }

    static int indexOf(List<Long> rows, long id) {
        for (int index = 0; index < rows.size(); index++) {
            if (rows.get(index) == id) {
                return index;
            }
        }
        return -1;
    }

    static String text(String value) {
        return value == null ? "" : value;
    }

    static String normalized(String value) {
        return text(value).toLowerCase(Locale.ROOT);
    }

    static List<Long> encounterTableIds(EncounterTableCatalogResult result) {
        return encounterTables(result).stream()
                .map(EncounterTableSummary::tableId)
                .toList();
    }

    static List<String> encounterTableLabels(EncounterTableCatalogResult result) {
        return encounterTables(result).stream()
                .map(table -> "#" + table.tableId() + " | " + table.name())
                .toList();
    }

    private static List<EncounterTableSummary> encounterTables(EncounterTableCatalogResult result) {
        return result == null ? List.of() : result.tables();
    }
}
