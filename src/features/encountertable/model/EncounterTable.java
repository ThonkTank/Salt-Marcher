package features.encountertable.model;

import java.util.List;

/**
 * Named pool of weighted creatures used as an alternative candidate source for the encounter generator.
 * Entries are lazy-loaded — only populated when explicitly requested (e.g. in the table editor).
 */
public class EncounterTable {

    public long tableId;
    public String name;
    public String description;
    public Long linkedLootTableId;
    public List<Entry> entries;

    @Override
    public String toString() { return name != null ? name : ""; }

    /** A single creature in an encounter table with an associated selection weight (1–10). */
    public record Entry(
        long creatureId,
        String creatureName,
        String creatureType,
        String crDisplay,
        int xp,
        int weight
    ) {}
}
