package features.loottable.ui;

import features.loottable.model.LootTable;
import features.tables.ui.AbstractWeightedEntriesPane;
import javafx.scene.control.TableColumn;

import java.util.Set;
import java.util.function.Consumer;

public class LootTableEntriesPane extends AbstractWeightedEntriesPane<LootTable.Entry> {
    private Set<Long> pendingWeightItemIds = Set.of();
    private Consumer<Long> onRequestItem;

    public LootTableEntriesPane() {
        super("EINTRÄGE", "Keine Einträge");

        TableColumn<LootTable.Entry, String> nameCol = createLinkColumn(
                "Item",
                "item-link",
                "Item anzeigen: ",
                LootTable.Entry::itemName,
                LootTable.Entry::itemId,
                itemId -> {
                    if (onRequestItem != null) {
                        onRequestItem.accept(itemId);
                    }
                });

        TableColumn<LootTable.Entry, String> metaCol = textColumn("Typ", LootTableEntriesPane::metaText);

        TableColumn<LootTable.Entry, String> costCol = textColumn("Wert", LootTableEntriesPane::costText);
        costCol.setMaxWidth(110);

        TableColumn<LootTable.Entry, Void> weightCol = createWeightColumn(
                LootTable.Entry::itemId,
                LootTable.Entry::weight,
                (entry, weight) -> new LootTable.Entry(
                        entry.itemId(), entry.itemName(), entry.category(), entry.rarity(),
                        entry.costCp(), entry.costDisplay(), weight));
        weightCol.setMaxWidth(95);

        TableColumn<LootTable.Entry, Void> removeCol =
                createRemoveColumn("Aus Tabelle entfernen", LootTable.Entry::itemId);
        removeCol.setMaxWidth(55);

        table.getColumns().addAll(nameCol, metaCol, costCol, weightCol, removeCol);
    }

    public void setPendingWeightItemIds(Set<Long> itemIds) {
        pendingWeightItemIds = itemIds == null ? Set.of() : Set.copyOf(itemIds);
        table.refresh();
    }

    public void setOnRequestItem(Consumer<Long> callback) {
        this.onRequestItem = callback;
    }

    @Override
    protected boolean isWeightPending(long entryId) {
        return pendingWeightItemIds.contains(entryId);
    }

    private static String metaText(LootTable.Entry entry) {
        String rarity = entry.rarity();
        if (rarity == null || rarity.isBlank()) return entry.category();
        return entry.category() + " · " + rarity;
    }

    private static String costText(LootTable.Entry entry) {
        if (entry.costCp() > 0) return entry.costDisplay() == null || entry.costDisplay().isBlank()
                ? entry.costCp() + " cp"
                : entry.costDisplay();
        return "0 cp";
    }
}
