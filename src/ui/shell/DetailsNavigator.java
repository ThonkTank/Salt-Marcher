package ui.shell;

import features.creatures.api.StatBlockRequest;
import features.encountertable.api.EncounterTableSummary;
import features.loottable.api.LootTableSummary;
import features.spells.api.SpellSummary;
import features.world.dungeonmap.api.DungeonAreaSummary;
import features.world.dungeonmap.api.DungeonEndpointSummary;
import features.world.dungeonmap.api.DungeonFeatureSummary;
import features.world.dungeonmap.api.DungeonLinkSummary;
import features.world.dungeonmap.api.DungeonPassageSummary;
import features.world.dungeonmap.api.DungeonRoomSummary;
import features.world.dungeonmap.api.DungeonSquareSummary;
import features.world.hexmap.api.HexTileSummary;
import javafx.scene.Node;

import java.util.function.Supplier;

/**
 * Shell-owned navigation API for the shared upper-right inspector.
 * All cross-view informational content shown in the upper-right pane should flow through this
 * navigator so the GM keeps a single back/forward history across stat blocks, items, rooms,
 * summaries, and other read-mostly references. Views should publish into this navigator on
 * explicit "open/show in inspector" intent, not on every local selection change.
 */
public interface DetailsNavigator {
    record EntryKey(String type, Object id) {}

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

    void showDungeonFeature(DungeonFeatureSummary summary);

    void showDungeonEndpoint(DungeonEndpointSummary summary);

    void showDungeonLink(DungeonLinkSummary summary);

    void showDungeonPassage(DungeonPassageSummary summary);

    /**
     * For uncommon read-mostly information cards in the shared inspector.
     * Do not use for transient workflow hints, validation messages, or editor-local guidance.
     */
    void showInfo(String title, Object entryKey, String message);

    /**
     * Clears the shared inspector. Reserve this for explicit user intent or true global resets,
     * not for local selection loss inside a single view.
     */
    void clear();

    /**
     * Returns whether the currently visible inspector entry matches the provided entry key.
     * Views can use this to refresh an already-open card without mirroring local selection state
     * back into the global inspector after the GM has navigated elsewhere.
     */
    boolean isShowing(Object entryKey);

    /**
     * Escape hatch for uncommon inspector content. Keep hosted content read-mostly; view-specific
     * forms and workflow controls belong in the lower-right state pane instead.
     */
    void showContent(String title, Object entryKey, Supplier<Node> contentSupplier);
}
