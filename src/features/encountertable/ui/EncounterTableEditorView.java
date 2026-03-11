package features.encountertable.ui;

import features.encountertable.model.EncounterTable;
import features.encountertable.service.EncounterTableLootCoverageAnalyzer;
import features.loottable.api.LootTableApi;
import javafx.concurrent.Task;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputDialog;
import features.creatures.api.CreatureCatalogService;
import features.encountertable.service.EncounterTableNameNormalizer;
import features.encountertable.service.EncounterTableService;
import features.creatures.api.CreatureBrowserPane;
import features.creatures.api.StatBlockRequest;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Optional;
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
                            showMutationErrorAlert("Gewichtung muss zwischen 1 und 10 liegen.");
                            reloadEntries();
                        } else {
                            showMutationErrorAlert("Kreatur konnte nicht zur Tabelle hinzugefügt werden.");
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
                            showMutationErrorAlert("Kreatur konnte nicht aus der Tabelle entfernt werden.");
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
                                        showMutationErrorAlert("Gewichtung muss zwischen 1 und 10 liegen.");
                                        reloadEntries();
                                        return;
                                    }
                                    showMutationErrorAlert("Gewichtung konnte nicht gespeichert werden.");
                                    reloadEntries();
                                },
                        throwable -> {
                            showMutationErrorAlert("Gewichtung konnte nicht gespeichert werden.");
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
                        showTableMissingAlert();
                    } else {
                        showLoadErrorAlert("Tabelleneinträge konnten nicht geladen werden.");
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
                        showLoadErrorAlert("Tabellenliste konnte nicht geladen werden.");
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
                showLoadErrorAlert("Loot-Tabellen konnten nicht geladen werden.");
            }
        });
    }

    private void reloadTableListAndSelect(long selectId) {
        runTask("reloadTableListAndSelect",
                EncounterTableService::loadAll,
                result -> {
                    if (result.status() != EncounterTableService.ReadStatus.SUCCESS) {
                        showLoadErrorAlert("Tabellenliste konnte nicht geladen werden.");
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

    private void onCreateTable() {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("Neue Tabelle");
        dialog.setHeaderText("Name der neuen Encounter-Tabelle:");
        dialog.setContentText("Name:");
        Optional<String> result = dialog.showAndWait();
        result.filter(name -> !name.isBlank()).ifPresent(name -> {
            String stripped = name.strip();
            if (isDuplicateTableName(stripped, null)) {
                showDuplicateNameAlert(stripped);
                return;
            }
            runTask("onCreateTable",
                    () -> EncounterTableService.createTable(stripped, ""),
                    createResult -> {
                        switch (createResult.status()) {
                            case SUCCESS -> reloadTableListAndSelect(createResult.tableId());
                            case DUPLICATE_NAME -> {
                                showDuplicateNameAlert(stripped);
                                reloadTableList();
                            }
                            case VALIDATION_ERROR ->
                                    showMutationErrorAlert("Tabellenname ist ungültig.");
                            case STORAGE_ERROR ->
                                    showMutationErrorAlert("Tabelle konnte nicht erstellt werden.");
                        }
                    });
        });
    }

    private void onRenameTable() {
        if (currentTable == null) return;
        TextInputDialog dialog = new TextInputDialog(currentTable.name);
        dialog.setTitle("Tabelle umbenennen");
        dialog.setHeaderText("Neuer Name:");
        dialog.setContentText("Name:");
        Optional<String> result = dialog.showAndWait();
        result.filter(name -> !name.isBlank()).ifPresent(name -> {
            long tableId = currentTable.tableId;
            String stripped = name.strip();
            if (isDuplicateTableName(stripped, tableId)) {
                showDuplicateNameAlert(stripped);
                return;
            }
            runTask("onRenameTable",
                    () -> EncounterTableService.renameTable(tableId, stripped),
                    status -> {
                        switch (status) {
                            case SUCCESS -> {
                                currentTable.name = stripped;
                                refreshTableDetails();
                                reloadTableList();
                            }
                            case DUPLICATE_NAME -> {
                                showDuplicateNameAlert(stripped);
                                reloadTableList();
                            }
                            case VALIDATION_ERROR ->
                                    showMutationErrorAlert("Tabellenname ist ungültig.");
                            case STORAGE_ERROR ->
                                    showMutationErrorAlert("Tabelle konnte nicht umbenannt werden.");
                        }
                    });
        });
    }

    private void onDeleteTable() {
        if (currentTable == null) return;
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "Tabelle \u00bb" + currentTable.name + "\u00ab wirklich l\u00f6schen?",
                ButtonType.OK, ButtonType.CANCEL);
        confirm.setTitle("Tabelle l\u00f6schen");
        confirm.showAndWait().filter(btn -> btn == ButtonType.OK).ifPresent(btn -> {
            long tableId = currentTable.tableId;
            runTask("onDeleteTable",
                    () -> EncounterTableService.deleteTable(tableId),
                    status -> {
                        if (status == EncounterTableService.MutationStatus.SUCCESS) {
                            currentTable = null;
                            resetTableSelectionState();
                            reloadTableList();
                        } else {
                            showMutationErrorAlert("Tabelle konnte nicht gelöscht werden.");
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
                        showMutationErrorAlert("Loot-Verknüpfung konnte nicht gespeichert werden.");
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
        Task<T> task = new Task<>() {
            @Override protected T call() throws Exception { return work.call(); }
        };
        Consumer<T> successHandler = onSuccess != null ? onSuccess : ignored -> {};
        UiAsyncTasks.submit(
                task,
                successHandler,
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("EncounterTableEditorView." + errorLabel + "()", throwable);
                    if (onFailure != null) onFailure.accept(throwable);
                });
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
        if (detailsNavigator == null || currentTable == null) return;
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

    private void showDuplicateNameAlert(String name) {
        Alert alert = new Alert(Alert.AlertType.WARNING,
                "Es existiert bereits eine Tabelle mit dem Namen „" + name + "“.");
        alert.setTitle("Name bereits vergeben");
        alert.setHeaderText("Tabellennamen müssen eindeutig sein.");
        alert.showAndWait();
    }

    private void showMutationErrorAlert(String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR, message);
        alert.setTitle("Tabellen-Editor");
        alert.setHeaderText("Datenbankänderung fehlgeschlagen");
        alert.showAndWait();
    }

    private void showLoadErrorAlert(String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR, message);
        alert.setTitle("Tabellen-Editor");
        alert.setHeaderText("Datenbankzugriff fehlgeschlagen");
        alert.showAndWait();
    }

    private void showTableMissingAlert() {
        Alert alert = new Alert(Alert.AlertType.WARNING,
                "Die ausgewählte Tabelle existiert nicht mehr.");
        alert.setTitle("Tabellen-Editor");
        alert.setHeaderText("Tabelle nicht gefunden");
        alert.showAndWait();
    }
}
