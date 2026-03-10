package features.encountertable.ui;

import features.encountertable.model.EncounterTable;
import javafx.concurrent.Task;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputDialog;
import features.creatures.api.CreatureCatalogService;
import features.encountertable.service.EncounterTableNameNormalizer;
import features.encountertable.service.EncounterTableService;
import ui.components.creatures.catalog.CreatureBrowserPane;
import ui.shell.AppView;
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
    private final TableDetailsPane detailsPane;
    private final TableEntriesPane entriesPane;

    private EncounterTable currentTable = null;
    private List<EncounterTable> knownTables = List.of();
    private boolean initialLoadDone = false;

    public EncounterTableEditorView() {
        monsterList = new CreatureBrowserPane();
        controls    = new TableEditorControls();
        detailsPane = new TableDetailsPane();
        entriesPane = new TableEntriesPane();

        controls.setOnTableSelected(this::onTableSelected);
        controls.setOnCreateTable(this::onCreateTable);
        controls.setOnRenameTable(this::onRenameTable);
        controls.setOnDeleteTable(this::onDeleteTable);

        monsterList.setOnRequestStatBlock(detailsPane::showStatBlock);
        entriesPane.setOnRequestStatBlock(detailsPane::showStatBlock);
    }

    // ---- Public API (wired by SaltMarcherApp) ----

    public void setFilterData(CreatureCatalogService.FilterOptions data) {
        controls.setFilterData(data);
        controls.setOnFilterChanged(monsterList::applyFilters);
    }

    // ---- AppView interface ----

    @Override public Node getMainContent()     { return monsterList; }
    @Override public String getTitle()          { return "Tabellen-Editor"; }
    @Override public String getIconText()       { return "\uD83D\uDCCB"; }
    @Override public Node getControlsContent() { return controls; }
    @Override public Node getDetailsContent()  { return detailsPane; }
    @Override public Node getStateContent()    { return entriesPane; }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            monsterList.loadInitial();
            reloadTableList();
            initialLoadDone = true;
        }
    }

    // ---- Internal ----

    private void onTableSelected(EncounterTable table) {
        currentTable = table;
        detailsPane.showTable(table);
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
            monsterList.setOnAddCreature(null);
            entriesPane.setOnRemoveEntry(null);
            entriesPane.setOnUpdateWeight(null);
            entriesPane.setEntries(List.of());
            monsterList.setExcludeIds(java.util.Set.of());
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
                        entriesPane.setEntries(loaded.entries);
                        java.util.Set<Long> ids = new java.util.HashSet<>();
                        for (EncounterTable.Entry entry : loaded.entries) ids.add(entry.creatureId());
                        monsterList.setExcludeIds(ids);
                    } else if (result.status() == EncounterTableService.ReadStatus.NOT_FOUND) {
                        currentTable = null;
                        detailsPane.showTable(null);
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
                                detailsPane.showTable(currentTable);
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
                            detailsPane.showTable(null);
                            entriesPane.setEntries(List.of());
                            reloadTableList();
                        } else {
                            showMutationErrorAlert("Tabelle konnte nicht gelöscht werden.");
                            reloadEntries();
                        }
                    });
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
