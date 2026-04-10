package features.encountertable.ui;

import features.encountertable.EncountertableObject;
import features.encountertable.api.EncounterTableSummary;
import features.encountertable.input.AddCreatureInput;
import features.encountertable.input.CreateTableInput;
import features.encountertable.input.DeleteTableInput;
import features.encountertable.input.LoadTableInput;
import features.encountertable.input.LoadTablesInput;
import features.encountertable.input.RemoveCreatureInput;
import features.encountertable.input.RenameTableInput;
import features.encountertable.input.UpdateLinkedLootTableInput;
import features.encountertable.input.UpdateWeightInput;
import features.encountertable.model.EncounterTable;
import features.encountertable.service.EncounterTableLootCoverageAnalyzer;
import features.loottable.api.LootTableApi;
import features.tables.ui.TableActionRequest;
import features.tables.ui.TableEditorTaskRunner;
import javafx.scene.Node;
import features.creatures.catalog.input.LoadFilterOptionsInput;
import features.encountertable.service.EncounterTableNameNormalizer;
import features.creatures.api.CreatureBrowserPane;
import features.creatures.api.StatBlockRequest;
import ui.components.ConfirmationDropdown;
import ui.components.MessageDropdown;
import ui.components.TextInputDropdown;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.shell.NavigationIcons;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.function.Consumer;

/**
 * EDITOR view for creating and managing encounter tables.
 * Controls: table selector + manage actions + filter.
 * Main:     monster browser (add creatures to the selected table).
 * Inspector: read-only table summary on explicit table selection.
 * State:    creature entries in the selected table.
 */
@SuppressWarnings("unused")
public class EncounterTableEditorView implements AppView {
    private static final EncountertableObject ENCOUNTER_TABLES = new EncountertableObject();

    private final CreatureBrowserPane monsterList;
    private final TableEditorControls controls;
    private final TableEntriesPane entriesPane;

    private EncounterTable currentTable = null;
    private List<EncounterTable> knownTables = List.of();
    private List<LootTableApi.LootTableSummary> knownLootTables = List.of();
    private String currentLootCoverageWarning = null;
    private long lootCoverageRequestVersion = 0;
    private boolean initialLoadDone = false;
    private DetailsNavigator detailsNavigator;
    private final TextInputDropdown tableNameDropdown = new TextInputDropdown();
    private final ConfirmationDropdown deleteTableDropdown = new ConfirmationDropdown();
    private final MessageDropdown messageDropdown = new MessageDropdown();

    public EncounterTableEditorView() {
        monsterList = new CreatureBrowserPane();
        controls    = new TableEditorControls();
        entriesPane = new TableEntriesPane();

        controls.setOnTableSelected(this::onTableSelected);
        controls.setOnLootTableSelected(this::onLootTableSelected);
        controls.setOnCreateTable(this::onCreateTable);
        controls.setOnRenameTable(this::onRenameTable);
        controls.setOnDeleteTable(this::onDeleteTable);

        monsterList.setOnRequestStatBlock(this::showStatBlock);
        entriesPane.setOnRequestStatBlock(this::showStatBlock);
    }

    // ---- Public API (wired by SaltMarcherApp) ----

    public void setFilterData(LoadFilterOptionsInput.LoadedFilterOptionsInput data) {
        controls.setFilterData(data);
        controls.setOnFilterChanged(monsterList::applyFilters);
    }

    public void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
    }

    // ---- AppView interface ----

    @Override public Node getMainContent()     { return monsterList; }
    @Override public String getTitle()          { return "Tabellen-Editor"; }
    @Override public String getIconText()       { return ""; }
    @Override public Node getNavigationGraphic() { return NavigationIcons.tables(); }
    @Override public Node getControlsContent() { return controls; }
    @Override public Node getStateContent()    { return entriesPane; }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            monsterList.loadInitial();
            initialLoadDone = true;
        }
        reloadTableList();
        reloadLootTableList();
    }

    // ---- Internal ----

    private void onTableSelected(EncounterTable table) {
        currentTable = table;
        currentLootCoverageWarning = null;
        if (table != null) {
            publishSelectedTableToInspector();
            long tableId = table.tableId;
            monsterList.setOnAddCreature(creature -> runTask(
                    "addCreature",
                    () -> ENCOUNTER_TABLES.addCreature(new AddCreatureInput(tableId, creature.Id, 1)),
                    status -> {
                        if (status.status() == AddCreatureInput.Status.SUCCESS) {
                            reloadEntries();
                        } else if (status.status() == AddCreatureInput.Status.VALIDATION_ERROR) {
                            showMutationError("Encounter-Tabelle", "Gewichtung muss zwischen 1 und 10 liegen.", controls);
                            reloadEntries();
                        } else {
                            showMutationError("Encounter-Tabelle", "Kreatur konnte nicht zur Tabelle hinzugefügt werden.", controls);
                            reloadEntries();
                        }
                    }));
            entriesPane.setOnRemoveEntry(creatureId -> runTask(
                    "removeEntry",
                    () -> ENCOUNTER_TABLES.removeCreature(new RemoveCreatureInput(tableId, creatureId)),
                    status -> {
                        if (status.status() == RemoveCreatureInput.Status.SUCCESS) {
                            reloadEntries();
                        } else {
                            showMutationError("Encounter-Tabelle", "Kreatur konnte nicht aus der Tabelle entfernt werden.", entriesPane);
                            reloadEntries();
                        }
                    }));
            entriesPane.setOnUpdateWeight((creatureId, weight) -> {
                // Optimistic update already applied in TableEntriesPane; reload only on error
                        runTask("updateWeight",
                                () -> ENCOUNTER_TABLES.updateWeight(new UpdateWeightInput(tableId, creatureId, weight)),
                                status -> {
                                    if (status.status() == UpdateWeightInput.Status.SUCCESS) return;
                                    if (status.status() == UpdateWeightInput.Status.VALIDATION_ERROR) {
                                        showMutationError("Encounter-Tabelle", "Gewichtung muss zwischen 1 und 10 liegen.", entriesPane);
                                        reloadEntries();
                                        return;
                                    }
                                    showMutationError("Encounter-Tabelle", "Gewichtung konnte nicht gespeichert werden.", entriesPane);
                                    reloadEntries();
                                },
                        throwable -> {
                            showMutationError("Encounter-Tabelle", "Gewichtung konnte nicht gespeichert werden.", entriesPane);
                            reloadEntries();
                        });
            });
            reloadEntries();
        } else {
            resetTableSelectionState();
        }
    }

    private void reloadEntries() {
        if (currentTable == null) return;
        long tableId = currentTable.tableId;
        runTask("reloadEntries",
                () -> ENCOUNTER_TABLES.loadTable(new LoadTableInput(tableId)),
                result -> {
                    if (currentTable == null || currentTable.tableId != tableId) return;
                    if (result.status() == LoadTableInput.Status.SUCCESS && result.table() != null) {
                        EncounterTable loaded = toEncounterTable(result.table());
                        currentTable.entries = loaded.entries;
                        currentTable.linkedLootTableId = loaded.linkedLootTableId;
                        entriesPane.setEntries(loaded.entries);
                        java.util.Set<Long> ids = new java.util.HashSet<>();
                        for (EncounterTable.Entry entry : loaded.entries) ids.add(entry.creatureId());
                        monsterList.setExcludeIds(ids);
                        refreshLinkedLootCoverageWarning();
                    } else if (result.status() == LoadTableInput.Status.NOT_FOUND) {
                        currentTable = null;
                        currentLootCoverageWarning = null;
                        entriesPane.setEntries(List.of());
                        monsterList.setExcludeIds(java.util.Set.of());
                        reloadTableList();
                        showMessage("Tabelle nicht gefunden", "Die ausgewählte Tabelle existiert nicht mehr.", controls);
                    } else {
                        showLoadError("Tabelleneinträge konnten nicht geladen werden.", entriesPane);
                    }
                });
    }

    private void reloadTableList() {
        runTask("reloadTableList",
                () -> ENCOUNTER_TABLES.loadTables(new LoadTablesInput()),
                result -> {
                    if (result.success()) {
                        applyTableList(result.tables().stream().map(EncounterTableEditorView::toEncounterTable).toList());
                    } else {
                        showLoadError("Tabellenliste konnte nicht geladen werden.", controls);
                    }
                });
    }

    private void reloadLootTableList() {
        runTask("reloadLootTableList", LootTableApi::loadAllSummaries, result -> {
            if (result.status() == LootTableApi.ReadStatus.SUCCESS) {
                knownLootTables = List.copyOf(result.tables());
                controls.setLootTableList(result.tables());
                if (currentTable != null) {
                    refreshInspectorTableIfVisible(currentTable.tableId);
                    refreshLinkedLootCoverageWarning();
                }
            } else {
                showLoadError("Loot-Tabellen konnten nicht geladen werden.", controls);
            }
        });
    }

    private void reloadTableListAndSelect(long selectId) {
        runTask("reloadTableListAndSelect",
                () -> ENCOUNTER_TABLES.loadTables(new LoadTablesInput()),
                result -> {
                    if (!result.success()) {
                        showLoadError("Tabellenliste konnte nicht geladen werden.", controls);
                        return;
                    }
                    List<EncounterTable> tables = result.tables().stream().map(EncounterTableEditorView::toEncounterTable).toList();
                    applyTableList(tables);
                    controls.setLootTableList(knownLootTables);
                    tables.stream()
                            .filter(t -> t.tableId == selectId)
                            .findFirst()
                            .ifPresent(controls::selectTable);
                });
    }

    private void onCreateTable(TableActionRequest<EncounterTable> request) {
        tableNameDropdown.show(request.anchor(), "Neue Encounter-Tabelle", "Name", "", "Erstellen", stripped -> {
            if (isDuplicateTableName(stripped, null)) {
                tableNameDropdown.showError("Es existiert bereits eine Tabelle mit dem Namen „" + stripped + "“.");
                return;
            }
            runTask("onCreateTable",
                    () -> ENCOUNTER_TABLES.createTable(new CreateTableInput(stripped, "")),
                    createResult -> {
                        switch (createResult.status()) {
                            case SUCCESS -> {
                                tableNameDropdown.hide();
                                reloadTableListAndSelect(createResult.tableId());
                            }
                            case DUPLICATE_NAME -> {
                                tableNameDropdown.showError("Es existiert bereits eine Tabelle mit dem Namen „" + stripped + "“.");
                                reloadTableList();
                            }
                            case VALIDATION_ERROR -> tableNameDropdown.showError("Tabellenname ist ungültig.");
                            case STORAGE_ERROR -> showMutationError("Encounter-Tabelle", "Tabelle konnte nicht erstellt werden.", request.anchor());
                        }
                    });
        });
    }

    private void onRenameTable(TableActionRequest<EncounterTable> request) {
        EncounterTable table = request.table();
        if (table == null) return;
        tableNameDropdown.show(request.anchor(), "Encounter-Tabelle umbenennen", "Name", table.name, "Speichern", stripped -> {
            long tableId = table.tableId;
            if (isDuplicateTableName(stripped, tableId)) {
                tableNameDropdown.showError("Es existiert bereits eine Tabelle mit dem Namen „" + stripped + "“.");
                return;
            }
            runTask("onRenameTable",
                    () -> ENCOUNTER_TABLES.renameTable(new RenameTableInput(tableId, stripped)),
                    status -> {
                        switch (status.status()) {
                            case SUCCESS -> {
                                tableNameDropdown.hide();
                                currentTable.name = stripped;
                                refreshInspectorTableIfVisible(tableId);
                                reloadTableList();
                            }
                            case DUPLICATE_NAME -> {
                                tableNameDropdown.showError("Es existiert bereits eine Tabelle mit dem Namen „" + stripped + "“.");
                                reloadTableList();
                            }
                            case VALIDATION_ERROR -> tableNameDropdown.showError("Tabellenname ist ungültig.");
                            case STORAGE_ERROR -> showMutationError("Encounter-Tabelle", "Tabelle konnte nicht umbenannt werden.", request.anchor());
                        }
                    });
        });
    }

    private void onDeleteTable(TableActionRequest<EncounterTable> request) {
        EncounterTable table = request.table();
        if (table == null) return;
        deleteTableDropdown.show(
                request.anchor(),
                "Encounter-Tabelle löschen",
                "Encounter-Tabelle »" + table.name + "« wirklich löschen?",
                "Löschen",
                () -> {
            long tableId = table.tableId;
            runTask("onDeleteTable",
                    () -> ENCOUNTER_TABLES.deleteTable(new DeleteTableInput(tableId)),
                    status -> {
                        if (status.status() == DeleteTableInput.Status.SUCCESS) {
                            deleteTableDropdown.hide();
                            currentTable = null;
                            resetTableSelectionState();
                            reloadTableList();
                        } else {
                            showMutationError("Encounter-Tabelle", "Tabelle konnte nicht gelöscht werden.", request.anchor());
                            reloadEntries();
                        }
                    });
        });
    }

    private void onLootTableSelected(LootTableApi.LootTableSummary lootTable) {
        if (currentTable == null) return;
        Long lootTableId = lootTable == null || lootTable.tableId() < 0 ? null : lootTable.tableId();
        if (java.util.Objects.equals(currentTable.linkedLootTableId, lootTableId)) return;
        long tableId = currentTable.tableId;
        runTask("updateLinkedLootTable",
                () -> ENCOUNTER_TABLES.updateLinkedLootTable(new UpdateLinkedLootTableInput(tableId, lootTableId)),
                status -> {
                    if (status.status() == UpdateLinkedLootTableInput.Status.SUCCESS) {
                        currentTable.linkedLootTableId = lootTableId;
                        currentLootCoverageWarning = null;
                        refreshInspectorTableIfVisible(tableId);
                        refreshLinkedLootCoverageWarning();
                        reloadTableList();
                    } else {
                        showMutationError("Encounter-Tabelle", "Loot-Verknüpfung konnte nicht gespeichert werden.", controls);
                        reloadTableListAndSelect(tableId);
                    }
                });
    }

    /** Runs {@code work} on the shared UI async executor; delivers result to FX thread via callbacks. */
    private <T> void runTask(String errorLabel, Callable<T> work, Consumer<T> onSuccess) {
        runTask(errorLabel, work, onSuccess, null);
    }

    private <T> void runTask(String errorLabel, Callable<T> work, Consumer<T> onSuccess,
                             Consumer<Throwable> onFailure) {
        TableEditorTaskRunner.submit("EncounterTableEditorView", errorLabel, work, onSuccess, onFailure);
    }

    private void applyTableList(List<EncounterTable> tables) {
        knownTables = List.copyOf(tables);
        controls.setTableList(tables);
        controls.setLootTableList(knownLootTables);
    }

    private void resetTableSelectionState() {
        currentLootCoverageWarning = null;
        monsterList.setOnAddCreature(null);
        entriesPane.setOnRemoveEntry(null);
        entriesPane.setOnUpdateWeight(null);
        entriesPane.setEntries(List.of());
        monsterList.setExcludeIds(java.util.Set.of());
    }

    private void publishSelectedTableToInspector() {
        if (detailsNavigator == null || currentTable == null) {
            return;
        }
        detailsNavigator.showEncounterTable(buildInspectorSummary(currentTable));
    }

    private void refreshInspectorTableIfVisible(long tableId) {
        if (detailsNavigator == null || currentTable == null || currentTable.tableId != tableId) {
            return;
        }
        if (!detailsNavigator.isShowing(inspectorEntryKey(tableId))) {
            return;
        }
        detailsNavigator.showEncounterTable(buildInspectorSummary(currentTable));
    }

    private EncounterTableSummary buildInspectorSummary(EncounterTable table) {
        int entryCount = table.entries == null ? 0 : table.entries.size();
        return new EncounterTableSummary(
                table.tableId,
                table.name,
                linkedLootTableName(table),
                currentLootCoverageWarning,
                entryCount);
    }

    private void showStatBlock(Long creatureId) {
        if (creatureId == null || detailsNavigator == null) return;
        detailsNavigator.showStatBlock(StatBlockRequest.forCreature(creatureId));
    }

    private void refreshLinkedLootCoverageWarning() {
        long requestVersion = ++lootCoverageRequestVersion;
        if (currentTable == null) {
            currentLootCoverageWarning = null;
            return;
        }
        long tableId = currentTable.tableId;
        if (currentTable.linkedLootTableId == null || currentTable.entries == null || currentTable.entries.isEmpty()) {
            currentLootCoverageWarning = null;
            refreshInspectorTableIfVisible(tableId);
            return;
        }
        Long lootTableId = currentTable.linkedLootTableId;
        runTask("refreshLinkedLootCoverageWarning",
                () -> LootTableApi.loadWeightedItems(lootTableId),
                result -> {
                    if (requestVersion != lootCoverageRequestVersion
                            || currentTable == null
                            || !java.util.Objects.equals(currentTable.linkedLootTableId, lootTableId)) {
                        return;
                    }
                    if (result.status() != LootTableApi.ReadStatus.SUCCESS) {
                        currentLootCoverageWarning = "Loot-Analyse konnte nicht geladen werden.";
                    } else {
                        currentLootCoverageWarning = EncounterTableLootCoverageAnalyzer.analyzeCoverageWarning(currentTable, result.items());
                    }
                    refreshInspectorTableIfVisible(tableId);
                },
                throwable -> {
                    if (requestVersion != lootCoverageRequestVersion) {
                        return;
                    }
                    currentLootCoverageWarning = "Loot-Analyse konnte nicht geladen werden.";
                    refreshInspectorTableIfVisible(tableId);
                });
    }

    private static String inspectorEntryKey(long tableId) {
        return "encounter-table:" + tableId;
    }

    private String linkedLootTableName(EncounterTable table) {
        if (table == null || table.linkedLootTableId == null) {
            return null;
        }
        for (LootTableApi.LootTableSummary ref : knownLootTables) {
            if (ref.tableId() == table.linkedLootTableId) {
                return ref.name();
            }
        }
        return null;
    }

    private boolean isDuplicateTableName(String candidate, Long excludeTableId) {
        String normalized = EncounterTableNameNormalizer.normalizeForComparison(candidate);
        for (EncounterTable t : knownTables) {
            if (excludeTableId != null && t.tableId == excludeTableId) continue;
            if (EncounterTableNameNormalizer.normalizeForComparison(t.name).equals(normalized)) return true;
        }
        return false;
    }

    private void showMutationError(String title, String message, Node anchor) {
        showMessage(title, message, anchor);
    }

    private void showLoadError(String message, Node anchor) {
        showMessage("Datenbankzugriff fehlgeschlagen", message, anchor);
    }

    private void showMessage(String title, String message, Node anchor) {
        messageDropdown.show(anchor == null ? controls : anchor, title, message);
    }

    private static EncounterTable toEncounterTable(LoadTablesInput.TableSummaryInput table) {
        EncounterTable mapped = new EncounterTable();
        mapped.tableId = table.tableId();
        mapped.name = table.name();
        mapped.description = table.description();
        mapped.linkedLootTableId = table.linkedLootTableId();
        mapped.entries = List.of();
        return mapped;
    }

    private static EncounterTable toEncounterTable(LoadTableInput.TableInput table) {
        EncounterTable mapped = new EncounterTable();
        mapped.tableId = table.tableId();
        mapped.name = table.name();
        mapped.description = table.description();
        mapped.linkedLootTableId = table.linkedLootTableId();
        mapped.entries = table.entries().stream()
                .map(EncounterTableEditorView::toEntry)
                .toList();
        return mapped;
    }

    private static EncounterTable.Entry toEntry(LoadTableInput.EntryInput entry) {
        return new EncounterTable.Entry(
                entry.creatureId(),
                entry.creatureName(),
                entry.creatureType(),
                entry.crDisplay(),
                entry.xp(),
                entry.weight());
    }
}
