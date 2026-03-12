package ui.shell;

import features.creatures.api.StatBlockLoader;
import features.creatures.api.StatBlockRequest;
import features.encountertable.api.EncounterTableSummary;
import features.items.api.ItemCatalogService;
import features.items.api.ItemViewerPane;
import features.loottable.api.LootTableSummary;
import features.spells.api.SpellSummary;
import features.spells.api.SpellCatalogService;
import features.world.dungeonmap.api.DungeonAreaSummary;
import features.world.dungeonmap.api.DungeonEndpointSummary;
import features.world.dungeonmap.api.DungeonFeatureSummary;
import features.world.dungeonmap.api.DungeonLinkSummary;
import features.world.dungeonmap.api.DungeonPassageSummary;
import features.world.dungeonmap.api.DungeonRoomSummary;
import features.world.dungeonmap.api.DungeonSquareSummary;
import features.world.hexmap.api.HexTileSummary;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Top-right panel: shared history-aware inspector for stat blocks, items, and other read-mostly
 * references across all views. Interactive controls are exceptions, not the default.
 */
public class InspectorPane extends VBox implements DetailsNavigator {
    private final VBox detailContent;
    private final Label detailTitle;
    private final ScrollPane detailScroll;
    private final HBox mobFooter;
    private final TextField mobAcField;
    private final IntegerProperty mobTargetAc = new SimpleIntegerProperty(15);
    private final Label placeholder;
    private final Button backBtn;
    private final Button forwardBtn;
    private final Button closeBtn;

    private final List<HistoryEntry> history = new ArrayList<>();
    private int historyIndex = -1;
    private boolean placeholderVisible = true;

    private Task<?> pendingStatBlockTask = null;
    private long renderVersion = 0;

    public InspectorPane() {
        setPrefWidth(380);
        setMinWidth(320);
        getStyleClass().add("inspector-pane");

        // ---- Header ----
        detailTitle = new Label();
        detailTitle.getStyleClass().add("bold");
        backBtn = new Button("\u2039");
        backBtn.getStyleClass().addAll("compact", "flat");
        backBtn.setAccessibleText("Zurück");
        backBtn.setOnAction(e -> goBack());

        forwardBtn = new Button("\u203a");
        forwardBtn.getStyleClass().addAll("compact", "flat");
        forwardBtn.setAccessibleText("Vorwärts");
        forwardBtn.setOnAction(e -> goForward());

        closeBtn = new Button("\u00d7");
        closeBtn.getStyleClass().addAll("compact", "remove-btn");
        closeBtn.setAccessibleText("Details schliessen");
        closeBtn.setOnAction(e -> hideCurrent());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox detailHeader = new HBox(4, backBtn, forwardBtn, detailTitle, spacer, closeBtn);
        detailHeader.setAlignment(Pos.CENTER_LEFT);
        detailHeader.setPadding(new Insets(4, 8, 4, 8));
        detailHeader.getStyleClass().add("stat-block-fixed-header");

        detailContent = new VBox();
        detailScroll = new ScrollPane(detailContent);
        detailScroll.setFitToWidth(true);
        detailScroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        VBox.setVgrow(detailScroll, Priority.ALWAYS);

        Label acLabel = new Label("Ziel-AC");
        acLabel.getStyleClass().add("text-secondary");
        mobAcField = new TextField("15");
        mobAcField.setPrefWidth(72);
        mobAcField.getStyleClass().addAll("quick-search-field", "inspector-mob-ac-field");
        mobAcField.textProperty().addListener((obs, oldText, newText) -> {
            try {
                mobTargetAc.set(Integer.parseInt(newText.trim()));
            } catch (NumberFormatException ignored) {
                // Keep previous valid AC while input is temporarily invalid.
            }
        });
        mobFooter = new HBox(8, acLabel, mobAcField);
        mobFooter.setAlignment(Pos.CENTER_LEFT);
        mobFooter.setPadding(new Insets(6, 8, 6, 8));
        mobFooter.getStyleClass().add("inspector-mob-footer");
        mobFooter.setVisible(false);
        mobFooter.setManaged(false);

        placeholder = new Label("Keine Details ausgewählt");
        placeholder.getStyleClass().add("text-muted");
        placeholder.setMaxWidth(Double.MAX_VALUE);
        placeholder.setWrapText(true);

        VBox.setVgrow(detailScroll, Priority.ALWAYS);
        getChildren().addAll(detailHeader, detailScroll, mobFooter);
        showPlaceholder();
    }

    @Override
    public void showStatBlock(StatBlockRequest request) {
        if (request == null) return;
        StatBlockEntry entry = new StatBlockEntry(request);
        if (!placeholderVisible && isCurrentEntry(entry)) {
            hideCurrent();
            return;
        }
        openEntry(entry);
    }

    @Override
    public void ensureStatBlock(StatBlockRequest request) {
        if (request == null) return;
        openEntry(new StatBlockEntry(request));
    }

    @Override
    public void showItem(long itemId) {
        if (itemId <= 0) return;
        openEntry(new ItemEntry(itemId));
    }

    @Override
    public void showSpell(SpellSummary summary) {
        if (summary == null || summary.spellId() <= 0) return;
        openEntry(new SpellEntry(summary.spellId()));
    }

    @Override
    public void showEncounterTable(EncounterTableSummary summary) {
        if (summary == null) return;
        openEntry(new EncounterTableEntry(summary));
    }

    @Override
    public void showLootTable(LootTableSummary summary) {
        if (summary == null) return;
        openEntry(new LootTableEntry(summary));
    }

    @Override
    public void showHexTile(HexTileSummary summary) {
        if (summary == null) return;
        openEntry(new HexTileEntry(summary));
    }

    @Override
    public void showDungeonSquare(DungeonSquareSummary summary) {
        if (summary == null) return;
        openEntry(new DungeonSquareEntry(summary));
    }

    @Override
    public void showDungeonRoom(DungeonRoomSummary summary) {
        if (summary == null) return;
        openEntry(new DungeonRoomEntry(summary));
    }

    @Override
    public void showDungeonArea(DungeonAreaSummary summary) {
        if (summary == null) return;
        openEntry(new DungeonAreaEntry(summary));
    }

    @Override
    public void showDungeonFeature(DungeonFeatureSummary summary) {
        if (summary == null) return;
        openEntry(new DungeonFeatureEntry(summary));
    }

    @Override
    public void showDungeonEndpoint(DungeonEndpointSummary summary) {
        if (summary == null) return;
        openEntry(new DungeonEndpointEntry(summary));
    }

    @Override
    public void showDungeonLink(DungeonLinkSummary summary) {
        if (summary == null) return;
        openEntry(new DungeonLinkEntry(summary));
    }

    @Override
    public void showDungeonPassage(DungeonPassageSummary summary) {
        if (summary == null) return;
        openEntry(new DungeonPassageEntry(summary));
    }

    @Override
    public void showInfo(String title, Object entryKey, String message) {
        if (title == null || title.isBlank() || message == null || message.isBlank()) return;
        openEntry(new InfoEntry(title, entryKey, message));
    }

    @Override
    public void clear() {
        hideCurrent();
    }

    @Override
    public boolean isShowing(Object entryKey) {
        if (placeholderVisible || historyIndex < 0 || historyIndex >= history.size()) {
            return false;
        }
        return Objects.equals(history.get(historyIndex).entryKey(), entryKey);
    }

    @Override
    public void showContent(String title, Object entryKey, Supplier<Node> contentSupplier) {
        if (title == null || title.isBlank() || contentSupplier == null) return;
        openEntry(new HostedContentEntry(title, entryKey, contentSupplier));
    }

    private void openEntry(HistoryEntry entry) {
        if (historyIndex >= 0 && history.get(historyIndex).sameEntry(entry)) {
            history.set(historyIndex, entry);
        } else {
            if (historyIndex < history.size() - 1) {
                history.subList(historyIndex + 1, history.size()).clear();
            }
            history.add(entry);
            historyIndex = history.size() - 1;
        }
        placeholderVisible = false;
        renderCurrentEntry();
    }

    private void goBack() {
        if (historyIndex <= 0) return;
        historyIndex--;
        placeholderVisible = false;
        renderCurrentEntry();
    }

    private void goForward() {
        if (historyIndex < 0 || historyIndex >= history.size() - 1) return;
        historyIndex++;
        placeholderVisible = false;
        renderCurrentEntry();
    }

    private void renderCurrentEntry() {
        updateNavigationState();
        if (historyIndex < 0 || historyIndex >= history.size()) {
            showPlaceholder();
            return;
        }
        HistoryEntry entry = history.get(historyIndex);
        entry.render(this, ++renderVersion);
    }

    private boolean isCurrentEntry(HistoryEntry candidate) {
        return historyIndex >= 0
                && historyIndex < history.size()
                && history.get(historyIndex).sameEntry(candidate);
    }

    private void renderStatBlock(StatBlockRequest request) {
        cancelPendingTask();
        boolean mobContext = request.mobCount() != null;
        showContentNode("Stat Block", loadingNode("Lade Stat Block..."), mobContext);
        pendingStatBlockTask = StatBlockLoader.loadAsync(request, detailContent, mobTargetAc);
    }

    private void renderItem(long itemId, long requestVersion) {
        cancelPendingTask();
        showContentNode("Item", loadingNode("Lade Item..."), false);
        Task<ItemCatalogService.ServiceResult<ItemCatalogService.ItemDetails>> task = new Task<>() {
            @Override protected ItemCatalogService.ServiceResult<ItemCatalogService.ItemDetails> call() {
                return ItemCatalogService.getItem(itemId);
            }
        };
        pendingStatBlockTask = task;
        ui.async.UiAsyncTasks.submit(task, result -> {
            if (requestVersion != renderVersion) return;
            if (!result.isOk()) {
                ui.async.UiErrorReporter.reportBackgroundFailure(
                        "InspectorPane.renderItem() service failure",
                        new IllegalStateException("ItemCatalogService status: " + result.status()));
                showContentNode("Item", loadingNode("Item konnte nicht geladen werden."), false);
                return;
            }
            ItemCatalogService.ItemDetails item = result.value();
            String title = item != null && item.name() != null && !item.name().isBlank() ? item.name() : "Item";
            showContentNode(title, new ItemViewerPane(item), false);
        }, throwable -> {
            if (task.isCancelled() || requestVersion != renderVersion) return;
            ui.async.UiErrorReporter.reportBackgroundFailure("InspectorPane.renderItem()", throwable);
            showContentNode("Item", loadingNode("Item konnte nicht geladen werden."), false);
        });
    }

    private void renderEncounterTable(EncounterTableSummary summary) {
        showContentNode(summary.name(), buildEncounterTableNode(summary), false);
    }

    private void renderLootTable(LootTableSummary summary) {
        showContentNode(summary.name(), buildLootTableNode(summary), false);
    }

    private void renderHexTile(HexTileSummary summary) {
        showContentNode("Feld-Eigenschaften", buildHexTileNode(summary), false);
    }

    private void renderSpell(long spellId, long requestVersion) {
        cancelPendingTask();
        showContentNode("Spell", loadingNode("Lade Spell..."), false);
        Task<SpellCatalogService.ServiceResult<SpellCatalogService.SpellDetails>> task = new Task<>() {
            @Override protected SpellCatalogService.ServiceResult<SpellCatalogService.SpellDetails> call() {
                return SpellCatalogService.getSpell(spellId);
            }
        };
        pendingStatBlockTask = task;
        ui.async.UiAsyncTasks.submit(task, result -> {
            if (requestVersion != renderVersion) return;
            if (!result.isOk()) {
                ui.async.UiErrorReporter.reportBackgroundFailure(
                        "InspectorPane.renderSpell() service failure",
                        new IllegalStateException("SpellCatalogService status: " + result.status()));
                showContentNode("Spell", loadingNode("Spell konnte nicht geladen werden."), false);
                return;
            }
            SpellCatalogService.SpellDetails spell = result.value();
            if (spell == null) {
                showContentNode("Spell", loadingNode("Spell konnte nicht geladen werden."), false);
                return;
            }
            showContentNode(spell.name(), buildSpellNode(spell), false);
        }, throwable -> {
            if (task.isCancelled() || requestVersion != renderVersion) return;
            ui.async.UiErrorReporter.reportBackgroundFailure("InspectorPane.renderSpell()", throwable);
            showContentNode("Spell", loadingNode("Spell konnte nicht geladen werden."), false);
        });
    }

    private void renderDungeonSquare(DungeonSquareSummary summary) {
        showContentNode("Feld", buildDungeonSquareNode(summary), false);
    }

    private void renderDungeonRoom(DungeonRoomSummary summary) {
        showContentNode(summary.name(), buildDungeonRoomNode(summary), false);
    }

    private void renderDungeonArea(DungeonAreaSummary summary) {
        showContentNode(summary.name(), buildDungeonAreaNode(summary), false);
    }

    private void renderDungeonFeature(DungeonFeatureSummary summary) {
        showContentNode(summary.name(), buildDungeonFeatureNode(summary), false);
    }

    private void renderDungeonEndpoint(DungeonEndpointSummary summary) {
        showContentNode(summary.name(), buildDungeonEndpointNode(summary), false);
    }

    private void renderDungeonLink(DungeonLinkSummary summary) {
        showContentNode("Link", buildDungeonLinkNode(summary), false);
    }

    private void renderDungeonPassage(DungeonPassageSummary summary) {
        String title = summary.name() != null && !summary.name().isBlank() ? summary.name() : "Durchgang";
        showContentNode(title, buildDungeonPassageNode(summary), false);
    }

    private void renderInfo(String title, String message) {
        showContentNode(title, buildInfoNode(message), false);
    }

    private void showContentNode(String title, Node content, boolean mobContext) {
        cancelPendingTask();
        detailTitle.setText(title);
        detailContent.getChildren().setAll(content);
        detailScroll.setVvalue(0);
        mobFooter.setVisible(mobContext);
        mobFooter.setManaged(mobContext);
        placeholderVisible = false;
        updateNavigationState();
    }

    private void hideCurrent() {
        cancelPendingTask();
        showPlaceholder();
    }

    private void showPlaceholder() {
        detailTitle.setText("Details");
        detailContent.getChildren().clear();
        detailContent.getChildren().add(placeholder);
        detailScroll.setVvalue(0);
        mobFooter.setVisible(false);
        mobFooter.setManaged(false);
        placeholderVisible = true;
        updateNavigationState();
    }

    private void updateNavigationState() {
        backBtn.setDisable(historyIndex <= 0);
        forwardBtn.setDisable(historyIndex < 0 || historyIndex >= history.size() - 1);
        closeBtn.setDisable(placeholderVisible);
    }

    private void cancelPendingTask() {
        if (pendingStatBlockTask != null) {
            pendingStatBlockTask.cancel(false);
            pendingStatBlockTask = null;
        }
    }

    private static Node loadingNode(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        VBox box = new VBox(label);
        box.setPadding(new Insets(12));
        return box;
    }

    private static Node buildEncounterTableNode(EncounterTableSummary summary) {
        VBox box = new VBox(10);
        box.setPadding(new Insets(12));

        Label kind = new Label("Encounter-Tabelle");
        kind.getStyleClass().addAll("section-header", "text-muted");
        Label entries = secondary("Einträge: " + Math.max(summary.entryCount(), 0));
        String linkedLoot = summary.linkedLootTableName() == null || summary.linkedLootTableName().isBlank()
                ? "Keine Loot-Tabelle verknüpft"
                : "Loot: " + summary.linkedLootTableName();
        Label loot = secondary(linkedLoot);

        box.getChildren().addAll(kind, entries, loot);
        if (summary.lootWarning() != null && !summary.lootWarning().isBlank()) {
            Label warning = new Label(summary.lootWarning());
            warning.getStyleClass().add("text-warning");
            warning.setWrapText(true);
            box.getChildren().add(warning);
        }
        return box;
    }

    private static Node buildLootTableNode(LootTableSummary summary) {
        VBox box = new VBox(10);
        box.setPadding(new Insets(12));

        Label kind = new Label("Loot-Tabelle");
        kind.getStyleClass().addAll("section-header", "text-muted");
        Label entries = secondary("Einträge: " + Math.max(summary.entryCount(), 0));
        Label totalWeight = secondary("Gesamtgewicht: " + Math.max(summary.totalWeight(), 0));
        box.getChildren().addAll(kind, entries, totalWeight);

        if (summary.description() != null && !summary.description().isBlank()) {
            Label descriptionHeader = new Label("Beschreibung");
            descriptionHeader.getStyleClass().addAll("section-header", "text-muted");
            Label description = new Label(summary.description());
            description.setWrapText(true);
            box.getChildren().addAll(descriptionHeader, description);
        }
        return box;
    }

    private static Label secondary(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-secondary");
        label.setWrapText(true);
        return label;
    }

    private static Node buildHexTileNode(HexTileSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));

        Label kind = new Label("Hex-Feld");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Position: " + summary.q() + ", " + summary.r()),
                secondary("Gelände: " + valueOrDash(summary.terrainName())),
                secondary("Höhe: " + summary.elevation()),
                secondary("Biom: " + valueOrDash(summary.biomeName())),
                secondary(summary.explored() ? "Erkundet" : "Nicht erkundet"));
        if (summary.notes() != null && !summary.notes().isBlank()) {
            Label notesHeader = new Label("Notizen");
            notesHeader.getStyleClass().addAll("section-header", "text-muted");
            Label notes = new Label(summary.notes());
            notes.setWrapText(true);
            box.getChildren().addAll(notesHeader, notes);
        }
        return box;
    }

    private static Node buildSpellNode(SpellCatalogService.SpellDetails spell) {
        VBox box = new VBox(10);
        box.setPadding(new Insets(12));

        Label kind = new Label(levelAndSchool(spell.level(), spell.school()));
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().add(kind);

        addSecondary(box, "Zauberzeit: " + valueOrDash(spell.castingTime()));
        addSecondary(box, "Reichweite: " + valueOrDash(spell.rangeText()));
        addSecondary(box, "Dauer: " + valueOrDash(spell.durationText()));
        addSecondary(box, "Komponenten: " + valueOrDash(spell.componentsText()));
        if (spell.materialComponentText() != null && !spell.materialComponentText().isBlank()) {
            addSecondary(box, "Material: " + spell.materialComponentText());
        }
        if (spell.classesText() != null && !spell.classesText().isBlank()) {
            addSecondary(box, "Klassen: " + spell.classesText());
        }
        if (spell.attackOrSaveText() != null && !spell.attackOrSaveText().isBlank()) {
            addSecondary(box, "Angriff/Rettung: " + spell.attackOrSaveText());
        }
        if (spell.damageEffectText() != null && !spell.damageEffectText().isBlank()) {
            addSecondary(box, "Effekt: " + spell.damageEffectText());
        }
        if (spell.ritual() || spell.concentration()) {
            addSecondary(box, (spell.ritual() ? "Ritual" : "") + (spell.ritual() && spell.concentration() ? " • " : "")
                    + (spell.concentration() ? "Konzentration" : ""));
        }
        if (spell.description() != null && !spell.description().isBlank()) {
            addSection(box, "Beschreibung", spell.description());
        }
        if (spell.higherLevelsText() != null && !spell.higherLevelsText().isBlank()) {
            addSection(box, "Auf höheren Graden", spell.higherLevelsText());
        }
        if (!spell.tags().isEmpty()) {
            addSecondary(box, "Tags: " + String.join(", ", spell.tags()));
        }
        if (spell.source() != null && !spell.source().isBlank()) {
            addSecondary(box, "Quelle: " + spell.source());
        }
        return box;
    }

    private static Node buildDungeonSquareNode(DungeonSquareSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Dungeon-Feld");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Position: " + summary.x() + ", " + summary.y()),
                secondary("Raum: " + valueOrDash(summary.roomName())),
                secondary("Bereich: " + valueOrDash(summary.areaName())));
        return box;
    }

    private static Node buildDungeonRoomNode(DungeonRoomSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Raum");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(kind, secondary("Bereich: " + valueOrDash(summary.areaName())));
        if (summary.description() != null && !summary.description().isBlank()) {
            addSection(box, "Beschreibung", summary.description());
        }
        return box;
    }

    private static Node buildDungeonAreaNode(DungeonAreaSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Bereich");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(kind, secondary("Encounter Table: " + valueOrDash(summary.encounterTableName())));
        if (summary.description() != null && !summary.description().isBlank()) {
            addSection(box, "Beschreibung", summary.description());
        }
        return box;
    }

    private static Node buildDungeonFeatureNode(DungeonFeatureSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Feature");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Kategorie: " + valueOrDash(summary.categoryLabel())),
                secondary("Encounter: " + valueOrDash(summary.encounterName())),
                secondary("Felder: " + Math.max(summary.tileCount(), 0)));
        if (summary.notes() != null && !summary.notes().isBlank()) {
            addSection(box, "Notizen", summary.notes());
        }
        return box;
    }

    private static Node buildDungeonEndpointNode(DungeonEndpointSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Übergang");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Position: " + summary.x() + ", " + summary.y()),
                secondary("Typ: " + valueOrDash(summary.roleLabel())),
                secondary(summary.defaultEntry() ? "Standard-Einstieg" : "Kein Standard-Einstieg"));
        if (summary.notes() != null && !summary.notes().isBlank()) {
            addSection(box, "Notizen", summary.notes());
        }
        return box;
    }

    private static Node buildDungeonLinkNode(DungeonLinkSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Link");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Von: " + valueOrDash(summary.fromName())),
                secondary("Nach: " + valueOrDash(summary.toName())));
        if (summary.label() != null && !summary.label().isBlank()) {
            addSection(box, "Label", summary.label());
        }
        return box;
    }

    private static Node buildDungeonPassageNode(DungeonPassageSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Durchgang");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Position: " + summary.x() + ", " + summary.y()),
                secondary("Richtung: " + valueOrDash(summary.directionLabel())),
                secondary("Typ: " + valueOrDash(summary.typeLabel())),
                secondary("Verknüpfter Übergang: " + valueOrDash(summary.endpointName())));
        if (summary.notes() != null && !summary.notes().isBlank()) {
            addSection(box, "Notizen", summary.notes());
        }
        return box;
    }

    private static Node buildInfoNode(String message) {
        VBox box = new VBox(10);
        box.setPadding(new Insets(12));
        Label label = new Label(message);
        label.getStyleClass().add("text-muted");
        label.setWrapText(true);
        box.getChildren().add(label);
        return box;
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }

    private static void addSecondary(VBox box, String text) {
        box.getChildren().add(secondary(text));
    }

    private static void addSection(VBox box, String title, String text) {
        Label header = new Label(title);
        header.getStyleClass().addAll("section-header", "text-muted");
        Label content = new Label(text);
        content.setWrapText(true);
        box.getChildren().addAll(header, content);
    }

    private static String levelAndSchool(int level, String school) {
        String levelText = level <= 0 ? "Zaubertrick" : "Grad " + level;
        return school == null || school.isBlank() ? levelText : levelText + " • " + school;
    }

    private sealed interface HistoryEntry permits StatBlockEntry, ItemEntry, SpellEntry, EncounterTableEntry, LootTableEntry, HexTileEntry, DungeonSquareEntry, DungeonRoomEntry, DungeonAreaEntry, DungeonFeatureEntry, DungeonEndpointEntry, DungeonLinkEntry, DungeonPassageEntry, InfoEntry, HostedContentEntry {
        Object entryKey();
        boolean sameEntry(HistoryEntry other);
        void render(InspectorPane pane, long requestVersion);
    }

    private record StatBlockEntry(StatBlockRequest request) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("stat-block", request);
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof StatBlockEntry entry && request.equals(entry.request);
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderStatBlock(request);
        }
    }

    private record ItemEntry(long itemId) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("item", itemId);
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof ItemEntry entry && itemId == entry.itemId;
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderItem(itemId, requestVersion);
        }
    }

    private record SpellEntry(long spellId) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("spell", spellId);
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof SpellEntry entry && spellId == entry.spellId;
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderSpell(spellId, requestVersion);
        }
    }

    private record EncounterTableEntry(EncounterTableSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return "encounter-table:" + summary.tableId();
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof EncounterTableEntry entry && summary.tableId() == entry.summary.tableId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderEncounterTable(summary);
        }
    }

    private record LootTableEntry(LootTableSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return "loot-table:" + summary.tableId();
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof LootTableEntry entry && summary.tableId() == entry.summary.tableId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderLootTable(summary);
        }
    }

    private record HexTileEntry(HexTileSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("hex-tile", summary.tileId() != null ? summary.tileId() : summary.q() + ":" + summary.r());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof HexTileEntry entry
                    && Objects.equals(summary.tileId(), entry.summary.tileId())
                    && summary.q() == entry.summary.q()
                    && summary.r() == entry.summary.r();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderHexTile(summary);
        }
    }

    private record DungeonSquareEntry(DungeonSquareSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("dungeon-square", summary.x() + ":" + summary.y());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof DungeonSquareEntry entry
                    && summary.x() == entry.summary.x()
                    && summary.y() == entry.summary.y();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderDungeonSquare(summary);
        }
    }

    private record DungeonRoomEntry(DungeonRoomSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("dungeon-room", summary.roomId());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof DungeonRoomEntry entry && summary.roomId() == entry.summary.roomId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderDungeonRoom(summary);
        }
    }

    private record DungeonAreaEntry(DungeonAreaSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("dungeon-area", summary.areaId());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof DungeonAreaEntry entry && summary.areaId() == entry.summary.areaId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderDungeonArea(summary);
        }
    }

    private record DungeonFeatureEntry(DungeonFeatureSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("dungeon-feature", summary.featureId());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof DungeonFeatureEntry entry && summary.featureId() == entry.summary.featureId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderDungeonFeature(summary);
        }
    }

    private record DungeonEndpointEntry(DungeonEndpointSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("dungeon-endpoint", summary.endpointId());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof DungeonEndpointEntry entry && summary.endpointId() == entry.summary.endpointId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderDungeonEndpoint(summary);
        }
    }

    private record DungeonLinkEntry(DungeonLinkSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("dungeon-link", summary.linkId());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof DungeonLinkEntry entry && summary.linkId() == entry.summary.linkId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderDungeonLink(summary);
        }
    }

    private record DungeonPassageEntry(DungeonPassageSummary summary) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("dungeon-passage", summary.passageId());
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof DungeonPassageEntry entry && summary.passageId() == entry.summary.passageId();
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderDungeonPassage(summary);
        }
    }

    private record InfoEntry(String title, Object entryKey, String message) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("info", entryKey);
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof InfoEntry entry && Objects.equals(entryKey, entry.entryKey);
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.renderInfo(title, message);
        }
    }

    private record HostedContentEntry(String title, Object entryKey, Supplier<Node> contentSupplier) implements HistoryEntry {
        @Override
        public Object entryKey() {
            return new DetailsNavigator.EntryKey("content", entryKey);
        }

        @Override
        public boolean sameEntry(HistoryEntry other) {
            return other instanceof HostedContentEntry entry && Objects.equals(entryKey, entry.entryKey);
        }

        @Override
        public void render(InspectorPane pane, long requestVersion) {
            pane.showContentNode(title, contentSupplier.get(), false);
        }
    }
}
