package features.creatures.api;

import java.util.List;
import java.util.TreeSet;

public record CreatureFactsQuery(Mode mode, List<Long> values) {

    public enum Mode { XP_VALUES, CREATURE_IDS }

    public CreatureFactsQuery {
        if (mode == null) {
            throw new IllegalArgumentException("mode is required");
        }
        TreeSet<Long> normalized = new TreeSet<>();
        if (values != null) {
            for (Long value : values) {
                if (value == null || value.longValue() <= 0L) {
                    throw new IllegalArgumentException("query values must be positive");
                }
                normalized.add(value);
            }
        }
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("at least one query value is required");
        }
        values = List.copyOf(normalized);
    }

    @Override
    public List<Long> values() {
        return List.copyOf(values);
    }

    public static CreatureFactsQuery forXpValues(List<Long> xpValues) {
        return new CreatureFactsQuery(Mode.XP_VALUES, xpValues);
    }

    public static CreatureFactsQuery forCreatureIds(List<Long> creatureIds) {
        return new CreatureFactsQuery(Mode.CREATURE_IDS, creatureIds);
    }
}
