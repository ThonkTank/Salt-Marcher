package features.loottable.ui;

import features.items.api.ItemBrowserPane;
import features.items.api.ItemBrowserRowAction;
import features.items.api.ItemCatalogService;
import features.loottable.model.LootTable;
import features.loottable.service.LootTableNameNormalizer;
import features.loottable.service.LootTableService;
import javafx.concurrent.Task;
import javafx.scene.Node;
import javafx.scene.control.Alert;
import javafx.scene.control.ButtonType;
import javafx.scene.control.TextInputDialog;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;
import ui.shell.AppView;
import ui.shell.DetailsNavigator;

import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.HashSet;
import java.util.function.Consumer;

public class LootTableEditorView implements AppView {

    private final ItemBrowserPane itemBrowserPane;
    private final LootTableEditorControls controls;
    private final LootTableEntriesPane entriesPane;

    private LootTable currentTable;
    private List<LootTable> knownTables = List.of();
    private boolean initialLoadDone = false;
    private final Set<Long> pendingWeightItemIds = new HashSet<>();
    private Set<Long> excludeIds = Set.of();
    private DetailsNavigator detailsNavigator;

    public LootTableEditorView() {
        itemBrowserPane = new ItemBrowserPane();
        controls = new LootTableEditorControls();
        entriesPane = new LootTableEntriesPane();

        itemBrowserPane.setPageLoader(this::loadBrowserPage);
        controls.setOnTableSelected(this::onTableSelected);
        controls.setOnCreateTable(this::onCreateTable);
        controls.setOnRenameTable(this::onRenameTable);
        controls.setOnDeleteTable(this::onDeleteTable);
        itemBrowserPane.setOnRequestItem(this::showItemInInspector);
        entriesPane.setOnRequestItem(this::showItemInInspector);
    }

    public void setFilterData(ItemCatalogService.FilterOptions data) {
        controls.setFilterData(data);
        controls.setOnFilterChanged(itemBrowserPane::applyFilters);
    }

    public void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
        refreshTableDetails();
    }

    @Override public Node getMainContent() { return itemBrowserPane; }
    @Override public String getTitle() { return "Loot-Tabellen"; }
    @Override public String getIconText() { return "$"; }
    @Override public Node getControlsContent() { return controls; }
    @Override public Node getStateContent() { return entriesPane; }

    @Override
    public void onShow() {
        if (!initialLoadDone) {
            itemBrowserPane.loadInitial();
            reloadTableList();
            initialLoadDone = true;
        }
    }

    private void onTableSelected(LootTable table) {
        currentTable = table;
        refreshTableDetails();
        if (table == null) {
            setAddActionEnabled(false);
            entriesPane.setEntries(List.of());
            pendingWeightItemIds.clear();
            entriesPane.setPendingWeightItemIds(Set.of());
            entriesPane.setOnRemoveEntry(null);
            entriesPane.setOnUpdateWeight(null);
            setExcludeIds(java.util.Set.of());
            return;
        }
        setAddActionEnabled(true);
        long tableId = table.tableId;
        entriesPane.setOnRemoveEntry(itemId -> runTask(
                "removeItem",
                () -> LootTableService.removeItem(tableId, itemId),
                status -> {
                    if (status == LootTableService.MutationStatus.SUCCESS) reloadEntries();
                    else showMutationErrorAlert("Item konnte nicht entfernt werden.");
                }));
        entriesPane.setOnUpdateWeight((itemId, weight) -> {
            if (itemId == null || pendingWeightItemIds.contains(itemId)) {
                return;
            }
            pendingWeightItemIds.add(itemId);
            entriesPane.setPendingWeightItemIds(pendingWeightItemIds);
            runTask(
                    "updateWeight",
                    () -> LootTableService.updateWeight(tableId, itemId, weight),
                    status -> {
                        pendingWeightItemIds.remove(itemId);
                        entriesPane.setPendingWeightItemIds(pendingWeightItemIds);
                        if (status == LootTableService.MutationStatus.SUCCESS) return;
                        showMutationErrorAlert("Gewichtung konnte nicht gespeichert werden.");
                        reloadEntries();
                    },
                    throwable -> {
                        pendingWeightItemIds.remove(itemId);
                        entriesPane.setPendingWeightItemIds(pendingWeightItemIds);
                        showMutationErrorAlert("Gewichtung konnte nicht gespeichert werden.");
                        reloadEntries();
                    });
        });
        reloadEntries();
    }

    private void onAddItem(ItemCatalogService.ItemSummary item) {
        if (currentTable == null || item == null || item.itemId() <= 0) return;
        long tableId = currentTable.tableId;
        runTask("addItem",
                () -> LootTableService.addItem(tableId, item.itemId()),
                status -> {
                    if (status == LootTableService.MutationStatus.SUCCESS) {
                        reloadEntries();
                    } else if (status == LootTableService.MutationStatus.DUPLICATE_ENTRY) {
                        showDuplicateEntryAlert(item.name());
                    } else if (status == LootTableService.MutationStatus.VALIDATION_ERROR) {
                        showMutationErrorAlert("Nur Items mit positivem Wert können zu Loot-Tabellen hinzugefügt werden.");
                    } else {
                        showMutationErrorAlert("Item konnte nicht zur Tabelle hinzugefügt werden.");
                    }
                });
    }

    private void reloadEntries() {
        if (currentTable == null) return;
        long tableId = currentTable.tableId;
        runTask("reloadEntries", () -> LootTableService.loadWithEntries(tableId), result -> {
            if (currentTable == null || currentTable.tableId != tableId) return;
            if (result.status() == LootTableService.ReadStatus.SUCCESS && result.table() != null) {
                LootTable loaded = result.table();
                currentTable.description = loaded.description;
                currentTable.entries = loaded.entries;
                pendingWeightItemIds.clear();
                entriesPane.setPendingWeightItemIds(Set.of());
                entriesPane.setEntries(loaded.entries);
                java.util.Set<Long> ids = new java.util.HashSet<>();
                for (LootTable.Entry entry : loaded.entries) ids.add(entry.itemId());
                setExcludeIds(ids);
                refreshTableDetails();
            } else if (result.status() == LootTableService.ReadStatus.NOT_FOUND) {
                currentTable = null;
                pendingWeightItemIds.clear();
                entriesPane.setPendingWeightItemIds(Set.of());
                entriesPane.setEntries(List.of());
                setExcludeIds(java.util.Set.of());
                reloadTableList();
                showLoadErrorAlert("Die ausgewählte Loot-Tabelle existiert nicht mehr.");
            } else {
                showLoadErrorAlert("Loot-Tabelleneinträge konnten nicht geladen werden.");
            }
        });
    }

    private void reloadTableList() {
        runTask("reloadTableList", LootTableService::loadAll, result -> {
            if (result.status() == LootTableService.ReadStatus.SUCCESS) {
                knownTables = List.copyOf(result.tables());
                controls.setTableList(result.tables());
                refreshTableDetails();
            } else {
                showLoadErrorAlert("Loot-Tabellen konnten nicht geladen werden.");
            }
        });
    }

    private void reloadTableListAndSelect(long tableId) {
        runTask("reloadTableListAndSelect", LootTableService::loadAll, result -> {
            if (result.status() != LootTableService.ReadStatus.SUCCESS) {
                showLoadErrorAlert("Loot-Tabellen konnten nicht geladen werden.");
                return;
            }
            knownTables = List.copyOf(result.tables());
            controls.setTableList(result.tables());
            result.tables().stream().filter(t -> t.tableId == tableId).findFirst().ifPresent(controls::selectTable);
        });
    }

    private void onCreateTable() {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("Neue Loot-Tabelle");
        dialog.setHeaderText("Name der neuen Loot-Tabelle:");
        dialog.setContentText("Name:");
        dialog.showAndWait().filter(name -> !name.isBlank()).ifPresent(name -> {
            String stripped = name.strip();
            if (isDuplicateTableName(stripped, null)) {
                showDuplicateNameAlert(stripped);
                return;
            }
            runTask("createTable", () -> LootTableService.createTable(stripped, ""), result -> {
                switch (result.status()) {
                    case SUCCESS -> reloadTableListAndSelect(result.tableId());
                    case DUPLICATE_NAME -> showDuplicateNameAlert(stripped);
                    case VALIDATION_ERROR -> showMutationErrorAlert("Tabellenname ist ungültig.");
                    case STORAGE_ERROR -> showMutationErrorAlert("Tabelle konnte nicht erstellt werden.");
                }
            });
        });
    }

    private void onRenameTable() {
        if (currentTable == null) return;
        TextInputDialog dialog = new TextInputDialog(currentTable.name);
        dialog.setTitle("Loot-Tabelle umbenennen");
        dialog.setHeaderText("Neuer Name:");
        dialog.setContentText("Name:");
        dialog.showAndWait().filter(name -> !name.isBlank()).ifPresent(name -> {
            String stripped = name.strip();
            if (isDuplicateTableName(stripped, currentTable.tableId)) {
                showDuplicateNameAlert(stripped);
                return;
            }
            long tableId = currentTable.tableId;
            runTask("renameTable", () -> LootTableService.renameTable(tableId, stripped), status -> {
                switch (status) {
                    case SUCCESS -> {
                        currentTable.name = stripped;
                        refreshTableDetails();
                        reloadTableList();
                    }
                    case DUPLICATE_NAME -> showDuplicateNameAlert(stripped);
                    case VALIDATION_ERROR -> showMutationErrorAlert("Tabellenname ist ungültig.");
                    case STORAGE_ERROR -> showMutationErrorAlert("Tabelle konnte nicht umbenannt werden.");
                }
            });
        });
    }

    private void onDeleteTable() {
        if (currentTable == null) return;
        Alert confirm = new Alert(Alert.AlertType.CONFIRMATION,
                "Loot-Tabelle »" + currentTable.name + "« wirklich löschen?",
                ButtonType.OK, ButtonType.CANCEL);
        confirm.setTitle("Loot-Tabelle löschen");
        confirm.showAndWait().filter(btn -> btn == ButtonType.OK).ifPresent(btn -> {
            long tableId = currentTable.tableId;
            runTask("deleteTable", () -> LootTableService.deleteTable(tableId), status -> {
                if (status == LootTableService.MutationStatus.SUCCESS) {
                    currentTable = null;
                    pendingWeightItemIds.clear();
                    entriesPane.setPendingWeightItemIds(Set.of());
                    entriesPane.setEntries(List.of());
                    setExcludeIds(java.util.Set.of());
                    reloadTableList();
                } else {
                    showMutationErrorAlert("Tabelle konnte nicht gelöscht werden.");
                }
            });
        });
    }

    private boolean isDuplicateTableName(String candidate, Long excludeTableId) {
        String normalized = LootTableNameNormalizer.normalizeForComparison(candidate);
        for (LootTable table : knownTables) {
            if (excludeTableId != null && table.tableId == excludeTableId) continue;
            if (LootTableNameNormalizer.normalizeForComparison(table.name).equals(normalized)) return true;
        }
        return false;
    }

    private ItemCatalogService.ServiceResult<ItemCatalogService.PageResult> loadBrowserPage(
            ItemCatalogService.FilterCriteria criteria,
            ItemCatalogService.PageRequest pageRequest) {
        List<Long> excluded = excludeIds.isEmpty() ? null : List.copyOf(excludeIds);
        return ItemCatalogService.searchItems(criteria, excluded, pageRequest);
    }

    private void setExcludeIds(Set<Long> ids) {
        excludeIds = ids == null ? Set.of() : Set.copyOf(ids);
        itemBrowserPane.refresh();
    }

    private void setAddActionEnabled(boolean enabled) {
        if (!enabled) {
            itemBrowserPane.setRowAction(null);
            return;
        }
        itemBrowserPane.setRowAction(new ItemBrowserRowAction(
                "+Add",
                "Zur Loot-Tabelle hinzufügen (Shift+Enter)",
                this::onAddItem));
    }

    private void showItemInInspector(Long itemId) {
        if (itemId == null || detailsNavigator == null) return;
        detailsNavigator.showItem(itemId);
    }

    private <T> void runTask(String errorLabel, Callable<T> work, Consumer<T> onSuccess) {
        runTask(errorLabel, work, onSuccess, null);
    }

    private <T> void runTask(String errorLabel, Callable<T> work, Consumer<T> onSuccess, Consumer<Throwable> onFailure) {
        Task<T> task = new Task<>() {
            @Override protected T call() throws Exception { return work.call(); }
        };
        UiAsyncTasks.submit(task, onSuccess, throwable -> {
            UiErrorReporter.reportBackgroundFailure("LootTableEditorView." + errorLabel + "()", throwable);
            if (onFailure != null) onFailure.accept(throwable);
        });
    }

    private void showDuplicateNameAlert(String name) {
        Alert alert = new Alert(Alert.AlertType.WARNING,
                "Es existiert bereits eine Loot-Tabelle mit dem Namen „" + name + "“.");
        alert.setTitle("Name bereits vergeben");
        alert.setHeaderText("Tabellennamen müssen eindeutig sein.");
        alert.showAndWait();
    }

    private void showDuplicateEntryAlert(String itemName) {
        Alert alert = new Alert(Alert.AlertType.WARNING,
                "Item „" + itemName + "“ ist bereits in der Tabelle.");
        alert.setTitle("Item bereits vorhanden");
        alert.setHeaderText("Doppelte Einträge sind nicht erlaubt.");
        alert.showAndWait();
    }

    private void refreshTableDetails() {
        if (detailsNavigator == null || currentTable == null) return;
        int entryCount = currentTable.entries == null ? 0 : currentTable.entries.size();
        int totalWeight = currentTable.entries == null ? 0 : currentTable.entries.stream()
                .mapToInt(LootTable.Entry::weight)
                .sum();
        detailsNavigator.showLootTable(new DetailsNavigator.LootTableSummary(
                currentTable.tableId,
                currentTable.name,
                currentTable.description,
                entryCount,
                totalWeight));
    }

    private void showMutationErrorAlert(String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR, message);
        alert.setTitle("Loot-Tabellen");
        alert.setHeaderText("Datenbankänderung fehlgeschlagen");
        alert.showAndWait();
    }

    private void showLoadErrorAlert(String message) {
        Alert alert = new Alert(Alert.AlertType.ERROR, message);
        alert.setTitle("Loot-Tabellen");
        alert.setHeaderText("Datenbankzugriff fehlgeschlagen");
        alert.showAndWait();
    }
}
