package features.loottable.ui;

import features.items.api.ItemBrowserPane;
import features.items.api.ItemBrowserRowAction;
import features.items.api.ItemCatalogService;
import features.loottable.api.LootTableSummary;
import features.loottable.model.LootTable;
import features.loottable.service.LootTableNameNormalizer;
import features.loottable.service.LootTableService;
import features.tables.ui.TableActionRequest;
import features.tables.ui.TableEditorTaskRunner;
import javafx.scene.Node;
import ui.components.ConfirmationDropdown;
import ui.components.MessageDropdown;
import ui.components.TextInputDropdown;
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
    private final MessageDropdown messageDropdown = new MessageDropdown();

    public LootTableEditorView() {
        itemBrowserPane = new ItemBrowserPane();
        controls = new LootTableEditorControls();
        entriesPane = new LootTableEntriesPane();

        itemBrowserPane.setPageLoader(this::loadBrowserPage);
        controls.setOnTableSelected(this::onTableSelected);
        controls.setOnCreateTable(this::onCreateTable);
        controls.setOnRenameTableRequested(this::onRenameTable);
        controls.setOnDeleteTableRequested(this::onDeleteTable);
        itemBrowserPane.setOnRequestItem(this::showItemInInspector);
        entriesPane.setOnRequestItem(this::showItemInInspector);
    }

    public void setFilterData(ItemCatalogService.FilterOptions data) {
        controls.setFilterData(data);
        controls.setOnFilterChanged(itemBrowserPane::applyFilters);
    }

    public void setDetailsNavigator(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = detailsNavigator;
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
        publishSelectedTableToInspector();
        setAddActionEnabled(true);
        long tableId = table.tableId;
        entriesPane.setOnRemoveEntry(itemId -> runTask(
                "removeItem",
                () -> LootTableService.removeItem(tableId, itemId),
                status -> {
                    if (status == LootTableService.MutationStatus.SUCCESS) reloadEntries();
                    else showMutationError("Loot-Tabelle", "Item konnte nicht entfernt werden.", entriesPane);
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
                        showMutationError("Loot-Tabelle", "Gewichtung konnte nicht gespeichert werden.", entriesPane);
                        reloadEntries();
                    },
                    throwable -> {
                        pendingWeightItemIds.remove(itemId);
                        entriesPane.setPendingWeightItemIds(pendingWeightItemIds);
                        showMutationError("Loot-Tabelle", "Gewichtung konnte nicht gespeichert werden.", entriesPane);
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
                        showMessage("Item bereits vorhanden", "Item „" + item.name() + "“ ist bereits in der Tabelle.", controls);
                    } else if (status == LootTableService.MutationStatus.VALIDATION_ERROR) {
                        showMutationError("Loot-Tabelle", "Nur Items mit positivem Wert können zu Loot-Tabellen hinzugefügt werden.", controls);
                    } else {
                        showMutationError("Loot-Tabelle", "Item konnte nicht zur Tabelle hinzugefügt werden.", controls);
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
                refreshInspectorTableIfVisible(tableId);
            } else if (result.status() == LootTableService.ReadStatus.NOT_FOUND) {
                currentTable = null;
                pendingWeightItemIds.clear();
                entriesPane.setPendingWeightItemIds(Set.of());
                entriesPane.setEntries(List.of());
                setExcludeIds(java.util.Set.of());
                reloadTableList();
                showMessage("Loot-Tabelle fehlt", "Die ausgewählte Loot-Tabelle existiert nicht mehr.", controls);
            } else {
                showLoadError("Loot-Tabelleneinträge konnten nicht geladen werden.", null);
            }
        });
    }

    private void reloadTableList() {
        runTask("reloadTableList", LootTableService::loadAll, result -> {
            if (result.status() == LootTableService.ReadStatus.SUCCESS) {
                knownTables = List.copyOf(result.tables());
                controls.setTableList(result.tables());
                if (currentTable != null) {
                    refreshInspectorTableIfVisible(currentTable.tableId);
                }
            } else {
                showLoadError("Loot-Tabellen konnten nicht geladen werden.", null);
            }
        });
    }

    private void reloadTableListAndSelect(long tableId) {
        runTask("reloadTableListAndSelect", LootTableService::loadAll, result -> {
            if (result.status() != LootTableService.ReadStatus.SUCCESS) {
                showLoadError("Loot-Tabellen konnten nicht geladen werden.", null);
                return;
            }
            knownTables = List.copyOf(result.tables());
            controls.setTableList(result.tables());
            result.tables().stream().filter(t -> t.tableId == tableId).findFirst().ifPresent(controls::selectTable);
        });
    }

    private void onCreateTable(TableActionRequest<LootTable> request) {
        Node anchor = request.anchor();
        TextInputDropdown tableNameDropdown = new TextInputDropdown();
        tableNameDropdown.show(anchor, "Neue Loot-Tabelle", "Name", "", "Erstellen", stripped -> {
            if (isDuplicateTableName(stripped, null)) {
                tableNameDropdown.showError("Es existiert bereits eine Loot-Tabelle mit dem Namen „" + stripped + "“.");
                return;
            }
            runTask("createTable", () -> LootTableService.createTable(stripped, ""), result -> {
                switch (result.status()) {
                    case SUCCESS -> {
                        tableNameDropdown.hide();
                        reloadTableListAndSelect(result.tableId());
                    }
                    case DUPLICATE_NAME -> tableNameDropdown.showError("Es existiert bereits eine Loot-Tabelle mit dem Namen „" + stripped + "“.");
                    case VALIDATION_ERROR -> tableNameDropdown.showError("Tabellenname ist ungültig.");
                    case STORAGE_ERROR -> showMutationError("Loot-Tabelle", "Tabelle konnte nicht erstellt werden.", anchor);
                }
            });
        });
    }

    private void onRenameTable(TableActionRequest<LootTable> request) {
        LootTable table = request.table();
        if (table == null) return;
        TextInputDropdown tableNameDropdown = new TextInputDropdown();
        tableNameDropdown.show(request.anchor(), "Loot-Tabelle umbenennen", "Name", table.name, "Speichern", stripped -> {
            if (isDuplicateTableName(stripped, table.tableId)) {
                tableNameDropdown.showError("Es existiert bereits eine Loot-Tabelle mit dem Namen „" + stripped + "“.");
                return;
            }
            long tableId = table.tableId;
            runTask("renameTable", () -> LootTableService.renameTable(tableId, stripped), status -> {
                switch (status) {
                    case SUCCESS -> {
                        tableNameDropdown.hide();
                        currentTable.name = stripped;
                        refreshInspectorTableIfVisible(tableId);
                        reloadTableList();
                    }
                    case DUPLICATE_NAME -> tableNameDropdown.showError("Es existiert bereits eine Loot-Tabelle mit dem Namen „" + stripped + "“.");
                    case VALIDATION_ERROR -> tableNameDropdown.showError("Tabellenname ist ungültig.");
                    case STORAGE_ERROR -> showMutationError("Loot-Tabelle", "Tabelle konnte nicht umbenannt werden.", request.anchor());
                }
            });
        });
    }

    private void onDeleteTable(TableActionRequest<LootTable> request) {
        LootTable table = request.table();
        if (table == null) return;
        ConfirmationDropdown deleteTableDropdown = new ConfirmationDropdown();
        deleteTableDropdown.show(
                request.anchor(),
                "Loot-Tabelle löschen",
                "Loot-Tabelle »" + table.name + "« wirklich löschen?",
                "Löschen",
                () -> {
            long tableId = table.tableId;
            runTask("deleteTable", () -> LootTableService.deleteTable(tableId), status -> {
                if (status == LootTableService.MutationStatus.SUCCESS) {
                    deleteTableDropdown.hide();
                    currentTable = null;
                    pendingWeightItemIds.clear();
                    entriesPane.setPendingWeightItemIds(Set.of());
                    entriesPane.setEntries(List.of());
                    setExcludeIds(java.util.Set.of());
                    reloadTableList();
                } else {
                    showMutationError("Loot-Tabelle", "Tabelle konnte nicht gelöscht werden.", request.anchor());
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
        TableEditorTaskRunner.submit("LootTableEditorView", errorLabel, work, onSuccess, onFailure);
    }

    private void publishSelectedTableToInspector() {
        if (detailsNavigator == null || currentTable == null) {
            return;
        }
        detailsNavigator.showLootTable(buildInspectorSummary(currentTable));
    }

    private void refreshInspectorTableIfVisible(long tableId) {
        if (detailsNavigator == null || currentTable == null || currentTable.tableId != tableId) {
            return;
        }
        if (!detailsNavigator.isShowing(inspectorEntryKey(tableId))) {
            return;
        }
        detailsNavigator.showLootTable(buildInspectorSummary(currentTable));
    }

    private LootTableSummary buildInspectorSummary(LootTable table) {
        int entryCount = table.entries == null ? 0 : table.entries.size();
        int totalWeight = table.entries == null ? 0 : table.entries.stream()
                .mapToInt(LootTable.Entry::weight)
                .sum();
        return new LootTableSummary(
                table.tableId,
                table.name,
                table.description,
                entryCount,
                totalWeight);
    }

    private static String inspectorEntryKey(long tableId) {
        return "loot-table:" + tableId;
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
