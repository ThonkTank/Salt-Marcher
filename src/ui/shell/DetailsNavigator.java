package ui.shell;

import features.creatures.api.StatBlockRequest;
import javafx.scene.Node;

import java.util.function.Supplier;

/**
 * Shell-owned navigation API for the shared upper-right details pane.
 */
public interface DetailsNavigator {

    record EncounterTableSummary(
            long tableId,
            String name,
            String linkedLootTableName,
            String lootWarning,
            int entryCount
    ) {}

    record LootTableSummary(
            long tableId,
            String name,
            String description,
            int entryCount,
            int totalWeight
    ) {}

    record HexTileSummary(
            Long tileId,
            int q,
            int r,
            String terrainName,
            int elevation,
            String biomeName,
            boolean explored,
            String notes
    ) {}

    void showStatBlock(StatBlockRequest request);

    void ensureStatBlock(StatBlockRequest request);

    void showItem(long itemId);

    void showEncounterTable(EncounterTableSummary summary);

    void showLootTable(LootTableSummary summary);

    void showHexTile(HexTileSummary summary);

    void showContent(String title, Object entryKey, Supplier<Node> contentSupplier);
}
