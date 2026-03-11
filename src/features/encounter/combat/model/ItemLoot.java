package features.encounter.combat.model;

public record ItemLoot(
        long itemId,
        String itemName,
        String category,
        String rarity,
        int costCp,
        String costDisplay
) {
    public ItemLoot {
        itemName = itemName == null ? "" : itemName;
        category = category == null ? "" : category;
        costDisplay = costDisplay == null ? "" : costDisplay;
    }

    public String summary() {
        return costDisplay != null && !costDisplay.isBlank()
                ? itemName + " (" + costDisplay + ")"
                : itemName + " (" + costCp + " cp)";
    }
}
