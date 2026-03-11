package features.loottable.model;

import java.util.List;

public class LootTable {

    public long tableId;
    public String name;
    public String description;
    public List<Entry> entries;

    @Override
    public String toString() { return name != null ? name : ""; }

    public record Entry(
            long itemId,
            String itemName,
            String category,
            String rarity,
            int costCp,
            String costDisplay,
            int weight
    ) {}
}
