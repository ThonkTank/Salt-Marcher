package features.items.ui.shared.catalog;

import features.items.api.ItemBrowserPageLoader;
import features.items.api.ItemBrowserRowAction;
import features.items.api.ItemCatalogService;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.SelectionMode;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.function.Consumer;

public class ItemBrowserPane extends BorderPane {
    private static final int PAGE_SIZE = 50;
    private record SanitizedPageResult(
            ItemCatalogService.PageResult page,
            boolean serviceOk,
            Throwable failureCause,
            boolean loaderContractFailure) {}

    private record SortOption(String label, String column, String dir) {
        @Override public String toString() { return label; }
    }

    private static final List<SortOption> SORT_OPTIONS = List.of(
            new SortOption("Name (A-Z)", "name", "ASC"),
            new SortOption("Name (Z-A)", "name", "DESC"),
            new SortOption("Wert (aufst.)", "cost_cp", "ASC"),
            new SortOption("Wert (abst.)", "cost_cp", "DESC")
    );

    private final ObservableList<ItemCatalogService.ItemSummary> items = FXCollections.observableArrayList();
    private final TableView<ItemCatalogService.ItemSummary> table = new TableView<>(items);
    private final Label countLabel = new Label("0 Items gefunden");
    private final Label pageLabel = new Label("Seite 1");
    private final Button prevButton = new Button("\u25C0 Zur\u00fcck");
    private final Button nextButton = new Button("Weiter \u25B6");
    private final ComboBox<SortOption> sortCombo = new ComboBox<>(FXCollections.observableArrayList(SORT_OPTIONS));
    private final Label loadingPlaceholder = new Label("Lade...");
    private final Label emptyPlaceholder = new Label("Keine Items gefunden");
    private final Label errorPlaceholder = new Label("Fehler beim Laden");
    private final TableColumn<ItemCatalogService.ItemSummary, Void> actionCol = new TableColumn<>("");
    private final List<TableColumn<ItemCatalogService.ItemSummary, ?>> baseColumns;

    private Consumer<Long> onRequestItem;
    private Task<?> currentTask;
    private ItemCatalogService.FilterCriteria currentCriteria;
    private int currentOffset = 0;
    private int totalCount = 0;
    private String sortColumn = "name";
    private String sortDirection = "ASC";
    private ItemBrowserPageLoader pageLoader = (criteria, pageRequest) ->
            ItemCatalogService.searchItems(criteria, null, pageRequest);
    private ItemBrowserRowAction rowAction;

    public ItemBrowserPane() {
        setPadding(new Insets(8));

        HBox topBar = new HBox(8);
        topBar.setAlignment(Pos.CENTER_LEFT);
        topBar.setPadding(new Insets(0, 0, 6, 0));
        countLabel.getStyleClass().add("text-secondary");
        pageLabel.getStyleClass().add("text-secondary");
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        Label sortLabel = new Label("Sortierung:");
        sortLabel.getStyleClass().add("text-muted");
        sortCombo.getSelectionModel().selectFirst();
        topBar.getChildren().addAll(countLabel, spacer, sortLabel, sortCombo);
        setTop(topBar);

        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(emptyPlaceholder);

        TableColumn<ItemCatalogService.ItemSummary, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().name()));
        nameCol.setMinWidth(150);
        nameCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button();
            {
                btn.getStyleClass().addAll("item-link", "flat");
                btn.setOnAction(e -> {
                    ItemCatalogService.ItemSummary item = itemAt(getIndex());
                    if (item != null && onRequestItem != null && item.itemId() > 0) onRequestItem.accept(item.itemId());
                });
            }

            @Override
            protected void updateItem(String value, boolean empty) {
                super.updateItem(value, empty);
                if (empty || value == null) {
                    setText(null);
                    setGraphic(null);
                    return;
                }
                setText(null);
                btn.setText(value);
                btn.setAccessibleText("Item anzeigen: " + value);
                setGraphic(btn);
            }
        });

        TableColumn<ItemCatalogService.ItemSummary, String> typeCol = new TableColumn<>("Typ");
        typeCol.setCellValueFactory(cd -> new SimpleStringProperty(typeText(cd.getValue())));
        typeCol.setMinWidth(170);

        TableColumn<ItemCatalogService.ItemSummary, String> magicCol = new TableColumn<>("Magisch");
        magicCol.setCellValueFactory(cd -> new SimpleStringProperty(magicText(cd.getValue())));
        magicCol.setMinWidth(75);
        magicCol.setMaxWidth(95);

        TableColumn<ItemCatalogService.ItemSummary, String> costCol = new TableColumn<>("Wert");
        costCol.setCellValueFactory(cd -> new SimpleStringProperty(costText(cd.getValue())));
        costCol.setMinWidth(80);
        costCol.setMaxWidth(110);

        actionCol.setMinWidth(55);
        actionCol.setMaxWidth(90);
        actionCol.setSortable(false);
        actionCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button("+Add");
            private final Tooltip tip = new Tooltip();
            {
                btn.getStyleClass().addAll("accent", "compact");
                btn.setTooltip(tip);
                btn.setOnAction(e -> {
                    if (rowAction == null) return;
                    ItemCatalogService.ItemSummary item = itemAt(getIndex());
                    if (item != null) rowAction.handler().accept(item);
                });
            }

            @Override
            protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty || rowAction == null) {
                    setGraphic(null);
                    return;
                }
                btn.setText(rowAction.label());
                tip.setText(rowAction.tooltip());
                btn.setAccessibleText(rowAction.label());
                setGraphic(btn);
            }
        });

        baseColumns = List.of(nameCol, typeCol, magicCol, costCol);
        table.getColumns().addAll(baseColumns);
        setCenter(table);

        HBox pagination = new HBox(8, prevButton, pageLabel, nextButton);
        pagination.setAlignment(Pos.CENTER);
        pagination.setPadding(new Insets(6, 0, 0, 0));
        setBottom(pagination);

        prevButton.setOnAction(e -> {
            if (currentOffset > 0) {
                currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
                loadPage();
            }
        });
        nextButton.setOnAction(e -> {
            if (currentOffset + PAGE_SIZE < totalCount) {
                currentOffset += PAGE_SIZE;
                loadPage();
            }
        });
        sortCombo.setOnAction(e -> {
            SortOption option = sortCombo.getValue();
            if (option == null) return;
            sortColumn = option.column();
            sortDirection = option.dir();
            currentOffset = 0;
            loadPage();
        });
        table.setOnKeyPressed(e -> {
            ItemCatalogService.ItemSummary item = table.getSelectionModel().getSelectedItem();
            if (item == null || item.itemId() <= 0) return;
            if (e.getCode() == KeyCode.ENTER && e.isShiftDown() && rowAction != null) {
                rowAction.handler().accept(item);
                e.consume();
            } else if (e.getCode() == KeyCode.ENTER) {
                if (onRequestItem != null) onRequestItem.accept(item.itemId());
                e.consume();
            }
        });
    }

    public void setOnRequestItem(Consumer<Long> callback) { this.onRequestItem = callback; }
    public void setPageLoader(ItemBrowserPageLoader loader) {
        pageLoader = loader != null ? loader : (criteria, pageRequest) ->
                ItemCatalogService.searchItems(criteria, null, pageRequest);
        if (!items.isEmpty() || currentCriteria != null) loadPage();
    }
    public void setRowAction(ItemBrowserRowAction action) {
        rowAction = action;
        table.getColumns().setAll(baseColumns);
        if (rowAction != null) table.getColumns().add(actionCol);
    }

    public void applyFilters(ItemCatalogService.FilterCriteria criteria) {
        currentCriteria = criteria;
        currentOffset = 0;
        loadPage();
    }

    public void loadInitial() {
        if (!items.isEmpty()) return;
        currentCriteria = ItemCatalogService.FilterCriteria.empty();
        currentOffset = 0;
        loadPage();
    }

    public void refresh() {
        if (items.isEmpty() && currentCriteria == null) {
            loadInitial();
            return;
        }
        loadPage();
    }

    private void loadPage() {
        if (currentTask != null && currentTask.isRunning()) currentTask.cancel();
        table.setPlaceholder(loadingPlaceholder);
        prevButton.setDisable(true);
        nextButton.setDisable(true);
        sortCombo.setDisable(true);

        ItemCatalogService.FilterCriteria criteria = currentCriteria != null
                ? currentCriteria
                : ItemCatalogService.FilterCriteria.empty();
        int offset = currentOffset;
        Task<ItemCatalogService.ServiceResult<ItemCatalogService.PageResult>> task = new Task<>() {
            @Override
            protected ItemCatalogService.ServiceResult<ItemCatalogService.PageResult> call() {
                return pageLoader.load(
                        criteria,
                        new ItemCatalogService.PageRequest(sortColumn, sortDirection, PAGE_SIZE, offset));
            }
        };
        currentTask = task;
        UiAsyncTasks.submit(task, result -> {
            SanitizedPageResult sanitized = sanitizeResult(result);
            ItemCatalogService.PageResult page = sanitized.page();
            totalCount = Math.max(0, page.totalCount());
            items.setAll(page.items());
            table.setPlaceholder(sanitized.serviceOk() ? emptyPlaceholder : errorPlaceholder);
            sortCombo.setDisable(false);
            updatePagination();
            if (sanitized.failureCause() != null) {
                UiErrorReporter.reportBackgroundFailure(
                        sanitized.loaderContractFailure()
                                ? "ItemBrowserPane.loadPage() invalid ItemBrowserPageLoader result"
                                : "ItemBrowserPane.loadPage() service failure",
                        sanitized.failureCause());
            }
        }, throwable -> {
            if (!task.isCancelled()) {
                UiErrorReporter.reportBackgroundFailure("ItemBrowserPane.loadPage()", throwable);
                table.setPlaceholder(errorPlaceholder);
                sortCombo.setDisable(false);
                updatePagination();
            }
        });
    }

    private static SanitizedPageResult sanitizeResult(
            ItemCatalogService.ServiceResult<ItemCatalogService.PageResult> result) {
        if (result == null) {
            return invalidLoaderResult("ItemBrowserPageLoader returned null ServiceResult");
        }
        ItemCatalogService.PageResult page = result.value();
        if (page == null) {
            return invalidLoaderResult("ItemBrowserPageLoader returned null PageResult");
        }
        if (page.items() == null) {
            return invalidLoaderResult("ItemBrowserPageLoader returned PageResult with null items");
        }
        if (!result.isOk()) {
            return new SanitizedPageResult(
                    page,
                    false,
                    new IllegalStateException("ItemCatalogService status: " + result.status()),
                    false
            );
        }
        return new SanitizedPageResult(page, true, null, false);
    }

    private static SanitizedPageResult invalidLoaderResult(String message) {
        return new SanitizedPageResult(
                new ItemCatalogService.PageResult(List.of(), 0),
                false,
                new IllegalStateException(message),
                true);
    }

    private void updatePagination() {
        int currentPage = totalCount == 0 ? 1 : (currentOffset / PAGE_SIZE) + 1;
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil((double) totalCount / PAGE_SIZE);
        countLabel.setText(totalCount + " Items gefunden");
        pageLabel.setText("Seite " + currentPage + " / " + totalPages);
        prevButton.setDisable(currentOffset <= 0);
        nextButton.setDisable(currentOffset + PAGE_SIZE >= totalCount);
    }

    private ItemCatalogService.ItemSummary itemAt(int index) {
        if (index < 0 || index >= items.size()) return null;
        return items.get(index);
    }

    private static String typeText(ItemCatalogService.ItemSummary item) {
        if (item == null) return "";
        StringBuilder text = new StringBuilder();
        if (item.category() != null && !item.category().isBlank()) text.append(item.category());
        if (item.subcategory() != null && !item.subcategory().isBlank()) {
            if (!text.isEmpty()) text.append(" \u00b7 ");
            text.append(item.subcategory());
        }
        if (item.rarity() != null && !item.rarity().isBlank()) {
            if (!text.isEmpty()) text.append(" \u00b7 ");
            text.append(item.rarity());
        }
        return text.toString();
    }

    private static String magicText(ItemCatalogService.ItemSummary item) {
        if (item == null || !item.magic()) return "\u2014";
        return item.requiresAttunement() ? "Ja*" : "Ja";
    }

    private static String costText(ItemCatalogService.ItemSummary item) {
        if (item == null) return "";
        if (item.costDisplay() != null && !item.costDisplay().isBlank()) return item.costDisplay();
        return item.costCp() + " cp";
    }
}
