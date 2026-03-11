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

    record SpellSummary(long spellId) {}

    record DungeonSquareSummary(
            int x,
            int y,
            String roomName,
            String areaName
    ) {}

    record DungeonRoomSummary(
            long roomId,
            String name,
            String description,
            String areaName
    ) {}

    record DungeonAreaSummary(
            long areaId,
            String name,
            String description,
            String encounterTableName
    ) {}

    record DungeonEndpointSummary(
            long endpointId,
            String name,
            String notes,
            String roleLabel,
            boolean defaultEntry,
            int x,
            int y
    ) {}

    record DungeonLinkSummary(
            long linkId,
            String label,
            String fromName,
            String toName
    ) {}

    record DungeonPassageSummary(
            long passageId,
            String name,
            String notes,
            String typeLabel,
            String directionLabel,
            int x,
            int y,
            String endpointName
    ) {}

    void showStatBlock(StatBlockRequest request);

    void ensureStatBlock(StatBlockRequest request);

    void showItem(long itemId);

    void showSpell(SpellSummary summary);

    void showEncounterTable(EncounterTableSummary summary);

    void showLootTable(LootTableSummary summary);

    void showHexTile(HexTileSummary summary);

    void showDungeonSquare(DungeonSquareSummary summary);

    void showDungeonRoom(DungeonRoomSummary summary);

    void showDungeonArea(DungeonAreaSummary summary);

    void showDungeonEndpoint(DungeonEndpointSummary summary);

    void showDungeonLink(DungeonLinkSummary summary);

    void showDungeonPassage(DungeonPassageSummary summary);

    void showInfo(String title, Object entryKey, String message);

    void clear();

    void showContent(String title, Object entryKey, Supplier<Node> contentSupplier);
}
