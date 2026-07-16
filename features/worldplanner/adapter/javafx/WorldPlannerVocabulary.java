package features.worldplanner.adapter.javafx;

import java.util.List;
import java.util.Locale;

final class WorldPlannerVocabulary {

    static final String STATUS_FILTER = "status";
    static final String STATBLOCK_FILTER = "statblock";
    static final String TABLE_FILTER = "table";
    static final String NPC_FILTER = "npc";
    static final String STOCK_FILTER = "stock";
    static final String FACTION_FILTER = "faction";
    static final String TYPE_FILTER = "type";

    static String idKey(long id) {
        return Long.toString(Math.max(0L, id));
    }

    static String idLabel(long id, String label) {
        return "#" + id + " | " + text(label);
    }

    static String normalized(String value) {
        return text(value).toLowerCase(Locale.ROOT);
    }

    static String text(String value) {
        return value == null ? "" : value;
    }

    static int indexOf(List<Long> rows, long id) {
        for (int index = 0; index < rows.size(); index++) {
            if (rows.get(index) == id) {
                return index;
            }
        }
        return -1;
    }

    static long idAt(List<Long> rows, int index, long fallback) {
        if (index < 0 || index >= rows.size()) {
            return fallback;
        }
        return rows.get(index);
    }

    static <T> T optionValue(List<Option<T>> options, int index, T fallback) {
        if (index < 0 || index >= options.size()) {
            return fallback;
        }
        return options.get(index).value();
    }

    record Option<T>(
            String key,
            String label,
            T value
    ) {

        Option {
            key = text(key);
            label = text(label);
        }
    }

    private WorldPlannerVocabulary() {
    }
}
