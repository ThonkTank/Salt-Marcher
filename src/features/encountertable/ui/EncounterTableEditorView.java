package features.encountertable.ui;

import features.encountertable.model.EncounterTable;
import features.encountertable.service.EncounterTableLootCoverageAnalyzer;
import features.loottable.api.LootTableApi;
import features.tables.ui.TableActionRequest;
import features.tables.ui.TableEditorTaskRunner;
import javafx.scene.Node;
import features.creatures.api.CreatureCatalogService;
import features.encountertable.service.EncounterTableNameNormalizer;
import features.encountertable.service.EncounterTableService;
import features.creatures.api.CreatureBrowserPane;
import features.creatures.api.StatBlockRequest;
import ui.components.ConfirmationDropdown;
import ui.components.MessageDropdown;
import ui.components.TextInputDropdown;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.function.Consumer;

/**
 * EDITOR view for creating and managing encounter tables.
 * Controls: table selector + manage actions + filter.
 * Main:     monster browser (add creatures to the selected table).
 * Details:  selected table name.
 * State:    creature entries in the selected table.
 */
public class EncounterTableEditorView implements AppView {

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

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        controls.setFilterData(data);
        controls.setOnFilterChanged(monsterList::applyFilters);
    }

    public void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        refreshTableDetails();
    }

    // ---- AppView interface ----

    @Override public Node getMainContent()     { return monsterList; }
    @Override public String getTitle()          { return "Tabellen-Editor"; }
    @Override public String getIconText()       { return "\uD83D\uDCCB"; }
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
        refreshTableDetails();
        if (table != null) {
            long tableId = table.tableId;
            monsterList.setOnAddCreature(creature -> runTask(
                    "addCreature",
                    () -> EncounterTableService.addCreature(tableId, creature.Id),
                    status -> {
                        if (status == EncounterTableService.MutationStatus.SUCCESS) {
                            reloadEntries();
                        } else if (status == EncounterTableService.MutationStatus.VALIDATION_ERROR) {
                            showMutationError("Encounter-Tabelle", "Gewichtung muss zwischen 1 und 10 liegen.", controls);
                            reloadEntries();
                        } else {
                            showMutationError("Encounter-Tabelle", "Kreatur konnte nicht zur Tabelle hinzugefügt werden.", controls);
                            reloadEntries();
                        }
                    }));
            entriesPane.setOnRemoveEntry(creatureId -> runTask(
                    "removeEntry",
                    () -> EncounterTableService.removeCreature(tableId, creatureId),
                    status -> {
                        if (status == EncounterTableService.MutationStatus.SUCCESS) {
                            reloadEntries();
                        } else {
                            showMutationError("Encounter-Tabelle", "Kreatur konnte nicht aus der Tabelle entfernt werden.", entriesPane);
                            reloadEntries();
                        }
                    }));
            entriesPane.setOnUpdateWeight((creatureId, weight) -> {
                // Optimistic update already applied in TableEntriesPane; reload only on error
                        runTask("updateWeight",
                                () -> EncounterTableService.updateWeight(tableId, creatureId, weight),
                                status -> {
                                    if (status == EncounterTableService.MutationStatus.SUCCESS) return;
                                    if (status == EncounterTableService.MutationStatus.VALIDATION_ERROR) {
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
                () -> EncounterTableService.loadWithEntries(tableId),
                result -> {
                    if (currentTable == null || currentTable.tableId != tableId) return;
                    if (result.status() == EncounterTableService.ReadStatus.SUCCESS && result.table() != null) {
                        EncounterTable loaded = result.table();
                        currentTable.entries = loaded.entries;
                        currentTable.linkedLootTableId = loaded.linkedLootTableId;
                        entriesPane.setEntries(loaded.entries);
                        java.util.Set<Long> ids = new java.util.HashSet<>();
                        for (EncounterTable.Entry entry : loaded.entries) ids.add(entry.creatureId());
                        monsterList.setExcludeIds(ids);
                        refreshLinkedLootCoverageWarning();
                    } else if (result.status() == EncounterTableService.ReadStatus.NOT_FOUND) {
                        currentTable = null;
                        currentLootCoverageWarning = null;
                        refreshTableDetails();
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
                EncounterTableService::loadAll,
                result -> {
                    if (result.status() == EncounterTableService.ReadStatus.SUCCESS) {
                        applyTableList(result.tables());
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
                refreshTableDetails();
                refreshLinkedLootCoverageWarning();
            } else {
                showLoadError("Loot-Tabellen konnten nicht geladen werden.", controls);
            }
        });
    }

    private void reloadTableListAndSelect(long selectId) {
        runTask("reloadTableListAndSelect",
                EncounterTableService::loadAll,
                result -> {
                    if (result.status() != EncounterTableService.ReadStatus.SUCCESS) {
                        showLoadError("Tabellenliste konnte nicht geladen werden.", controls);
                        return;
                    }
                    List<EncounterTable> tables = result.tables();
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
                    () -> EncounterTableService.createTable(stripped, ""),
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
                    () -> EncounterTableService.renameTable(tableId, stripped),
                    status -> {
                        switch (status) {
                            case SUCCESS -> {
                                tableNameDropdown.hide();
                                currentTable.name = stripped;
                                refreshTableDetails();
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
                    () -> EncounterTableService.deleteTable(tableId),
                    status -> {
                        if (status == EncounterTableService.MutationStatus.SUCCESS) {
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
                () -> EncounterTableService.updateLinkedLootTable(tableId, lootTableId),
                status -> {
                    if (status == EncounterTableService.MutationStatus.SUCCESS) {
                        currentTable.linkedLootTableId = lootTableId;
                        currentLootCoverageWarning = null;
                        refreshTableDetails();
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
        refreshTableDetails();
    }

    private void resetTableSelectionState() {
        currentLootCoverageWarning = null;
        refreshTableDetails();
        monsterList.setOnAddCreature(null);
        entriesPane.setOnRemoveEntry(null);
        entriesPane.setOnUpdateWeight(null);
        entriesPane.setEntries(List.of());
        monsterList.setExcludeIds(java.util.Set.of());
    }

    private void refreshTableDetails() {
        if (detailsNavigator == null) return;
        if (currentTable == null) {
            detailsNavigator.clear();
            return;
        }
        int entryCount = currentTable.entries == null ? 0 : currentTable.entries.size();
        detailsNavigator.showEncounterTable(new DetailsNavigator.EncounterTableSummary(
                currentTable.tableId,
                currentTable.name,
                linkedLootTableName(currentTable),
                currentLootCoverageWarning,
                entryCount));
    }

    private void showStatBlock(Long creatureId) {
        if (creatureId == null || detailsNavigator == null) return;
        detailsNavigator.showStatBlock(StatBlockRequest.forCreature(creatureId));
    }

    private void refreshLinkedLootCoverageWarning() {
        long requestVersion = ++lootCoverageRequestVersion;
        if (currentTable == null || currentTable.linkedLootTableId == null || currentTable.entries == null || currentTable.entries.isEmpty()) {
            currentLootCoverageWarning = null;
            refreshTableDetails();
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
                    refreshTableDetails();
                },
                throwable -> {
                    if (requestVersion != lootCoverageRequestVersion) {
                        return;
                    }
                    currentLootCoverageWarning = "Loot-Analyse konnte nicht geladen werden.";
                    refreshTableDetails();
                });
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
}
