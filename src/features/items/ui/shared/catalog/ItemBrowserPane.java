package features.items.ui.shared.catalog;

import features.items.api.ItemBrowserPageLoader;
import features.items.api.ItemBrowserRowAction;
import features.items.api.ItemCatalogService;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.control.Button;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import ui.components.catalog.AbstractCatalogBrowserPane;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class ItemBrowserPane extends AbstractCatalogBrowserPane<ItemCatalogService.ItemSummary, ItemCatalogService.FilterCriteria> {
    private static final List<SortOption> SORT_OPTIONS = List.of(
            new SortOption("Name (A-Z)", "name", "ASC"),
            new SortOption("Name (Z-A)", "name", "DESC"),
            new SortOption("Wert (aufst.)", "cost_cp", "ASC"),
            new SortOption("Wert (abst.)", "cost_cp", "DESC")
    );

    private final TableColumn<ItemCatalogService.ItemSummary, Void> actionCol = new TableColumn<>("");
    private final List<TableColumn<ItemCatalogService.ItemSummary, ?>> baseColumns;

    private Consumer<Long> onRequestItem;
    private ItemBrowserPageLoader pageLoader = (criteria, pageRequest) ->
            ItemCatalogService.searchItems(criteria, null, pageRequest);
    private ItemBrowserRowAction rowAction;

    public ItemBrowserPane() {
        super("0 Items gefunden", "Keine Items gefunden", SORT_OPTIONS);

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
        setColumns(baseColumns);

        table().setOnKeyPressed(e -> {
            ItemCatalogService.ItemSummary item = table().getSelectionModel().getSelectedItem();
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

    public void setOnRequestItem(Consumer<Long> callback) {
        this.onRequestItem = callback;
    }

    public void setPageLoader(ItemBrowserPageLoader loader) {
        pageLoader = loader != null ? loader : (criteria, pageRequest) ->
                ItemCatalogService.searchItems(criteria, null, pageRequest);
        if (hasLoadedCriteria()) refresh();
    }

    public void setRowAction(ItemBrowserRowAction action) {
        rowAction = action;
        if (rowAction == null) {
            setColumns(baseColumns);
            return;
        }
        List<TableColumn<ItemCatalogService.ItemSummary, ?>> columns = new ArrayList<>(baseColumns);
        columns.add(actionCol);
        setColumns(columns);
    }

    @Override
    protected ItemCatalogService.FilterCriteria emptyCriteria() {
        return ItemCatalogService.FilterCriteria.empty();
    }

    @Override
    protected PageLoadResult<ItemCatalogService.ItemSummary> loadPage(
            ItemCatalogService.FilterCriteria criteria,
            String sortColumn,
            String sortDirection,
            int limit,
            int offset) {
        return sanitizeResult(pageLoader.load(
                criteria,
                new ItemCatalogService.PageRequest(sortColumn, sortDirection, limit, offset)));
    }

    @Override
    protected String countLabelText(int totalCount) {
        return totalCount + " Items gefunden";
    }

    @Override
    protected String loadContext() {
        return "ItemBrowserPane.loadPage()";
    }

    private static PageLoadResult<ItemCatalogService.ItemSummary> sanitizeResult(
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
            return new PageLoadResult<>(
                    page.items(),
                    page.totalCount(),
                    false,
                    new IllegalStateException("ItemCatalogService status: " + result.status()),
                    false
            );
        }
        return new PageLoadResult<>(page.items(), page.totalCount(), true, null, false);
    }

    private static PageLoadResult<ItemCatalogService.ItemSummary> invalidLoaderResult(String message) {
        return new PageLoadResult<>(List.of(), 0, false, new IllegalStateException(message), true);
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
