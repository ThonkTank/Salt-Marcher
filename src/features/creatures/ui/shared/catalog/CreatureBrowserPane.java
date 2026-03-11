package features.creatures.ui.shared.catalog;

import features.creatures.api.CreatureBrowserPageLoader;
import features.creatures.api.CreatureBrowserRowAction;
import features.creatures.api.CreatureCatalogService;
import features.creatures.model.Creature;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.scene.control.Button;
import javafx.scene.control.TableCell;
import javafx.scene.control.TableColumn;
import javafx.scene.control.Tooltip;
import javafx.scene.input.KeyCode;
import ui.components.catalog.AbstractCatalogBrowserPane;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Consumer;

/**
 * Creature database table with sorting and pagination.
 * Stat blocks are displayed externally via onRequestStatBlock callback (routed to InspectorPane).
 * Filters live externally in EncounterControls (left panel).
 */
public class CreatureBrowserPane extends AbstractCatalogBrowserPane<Creature, CreatureCatalogService.FilterCriteria> {
    private static final List<SortOption> SORT_OPTIONS = List.of(
            new SortOption("Name (A-Z)", "name", "ASC"),
            new SortOption("Name (Z-A)", "name", "DESC"),
            new SortOption("CR (aufst.)", "cr", "ASC"),
            new SortOption("CR (abst.)", "cr", "DESC"),
            new SortOption("XP (aufst.)", "xp", "ASC"),
            new SortOption("XP (abst.)", "xp", "DESC")
    );

    private final TableColumn<Creature, Void> actionCol = new TableColumn<>("");
    private final List<TableColumn<Creature, ?>> baseColumns;

    private Consumer<Creature> onAddCreature;
    private Consumer<Long> onRequestStatBlock;
    private boolean combatMode = false;
    private Set<Long> excludeIds = Set.of();
    private List<Long> currentTableIds = List.of();
    private CreatureBrowserPageLoader pageLoader = this::loadDefaultPage;
    private CreatureBrowserRowAction rowAction;
    private boolean compatibilityRowAction = true;

    public CreatureBrowserPane() {
        super("0 Monster gefunden", "Keine Monster gefunden", SORT_OPTIONS);

        TableColumn<Creature, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().Name));
        nameCol.setMinWidth(120);
        nameCol.setPrefWidth(200);
        nameCol.setCellFactory(col -> new TableCell<>() {
            private final Button lbl = new Button();
            {
                lbl.getStyleClass().addAll("creature-link", "flat");
                lbl.setOnAction(ev -> {
                    Creature c = itemAt(getIndex());
                    if (c != null && onRequestStatBlock != null) onRequestStatBlock.accept(c.Id);
                });
            }
            @Override
            protected void updateItem(String name, boolean empty) {
                super.updateItem(name, empty);
                if (empty || name == null) {
                    setText(null);
                    setGraphic(null);
                    return;
                }
                lbl.setText(name);
                lbl.setAccessibleText("Stat Block: " + name);
                setGraphic(lbl);
            }
        });

        TableColumn<Creature, String> crCol = new TableColumn<>("CR");
        crCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().CR.display));
        crCol.setMinWidth(40);
        crCol.setPrefWidth(50);
        crCol.setMaxWidth(60);

        TableColumn<Creature, String> typeCol = new TableColumn<>("Typ");
        typeCol.setCellValueFactory(cd -> new SimpleStringProperty(
                cd.getValue().CreatureType != null ? cd.getValue().CreatureType : ""));
        typeCol.setMinWidth(80);
        typeCol.setPrefWidth(110);
        typeCol.setMaxWidth(150);

        TableColumn<Creature, String> sizeCol = new TableColumn<>("Gr\u00f6\u00dfe");
        sizeCol.setCellValueFactory(cd -> new SimpleStringProperty(
                cd.getValue().Size != null ? cd.getValue().Size : ""));
        sizeCol.setMinWidth(65);
        sizeCol.setPrefWidth(85);
        sizeCol.setMaxWidth(100);

        TableColumn<Creature, Number> xpCol = new TableColumn<>("XP");
        xpCol.setCellValueFactory(cd -> new SimpleIntegerProperty(cd.getValue().XP));
        xpCol.setMinWidth(45);
        xpCol.setPrefWidth(60);
        xpCol.setMaxWidth(75);

        actionCol.setMinWidth(55);
        actionCol.setPrefWidth(65);
        actionCol.setMaxWidth(75);
        actionCol.setSortable(false);
        actionCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button("+Add");
            private final Tooltip tip = new Tooltip();
            {
                btn.getStyleClass().addAll("accent", "compact");
                btn.setTooltip(tip);
                btn.setOnAction(e -> {
                    Creature creature = itemAt(getIndex());
                    if (creature == null || rowAction == null) return;
                    rowAction.handler().accept(creature);
                });
            }

            @Override
            protected void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                Creature creature = itemAt(getIndex());
                if (empty || creature == null || rowAction == null) {
                    setGraphic(null);
                    return;
                }
                btn.setText(rowAction.label());
                tip.setText(rowAction.tooltip());
                btn.setAccessibleText(rowAction.label() + ": " + creature.Name);
                setGraphic(btn);
            }
        });

        baseColumns = List.of(nameCol, crCol, typeCol, sizeCol, xpCol);
        setColumns(baseColumns);

        table().setOnKeyPressed(e -> {
            Creature c = table().getSelectionModel().getSelectedItem();
            if (c == null) return;
            if (e.getCode() == KeyCode.ENTER && !e.isShiftDown()) {
                if (onRequestStatBlock != null) onRequestStatBlock.accept(c.Id);
                e.consume();
            } else if (e.getCode() == KeyCode.ENTER && e.isShiftDown()) {
                if (rowAction != null) rowAction.handler().accept(c);
                e.consume();
            }
        });
    }

    public void setOnAddCreature(Consumer<Creature> callback) {
        this.onAddCreature = callback;
        compatibilityRowAction = true;
        syncCompatibilityRowAction();
    }

    public void setOnRequestStatBlock(Consumer<Long> callback) {
        this.onRequestStatBlock = callback;
    }

    public void setPageLoader(CreatureBrowserPageLoader loader) {
        pageLoader = loader != null ? loader : this::loadDefaultPage;
        if (hasLoadedCriteria()) refresh();
    }

    public void setRowAction(CreatureBrowserRowAction action) {
        compatibilityRowAction = false;
        rowAction = action;
        rebuildColumns();
    }

    public void setCombatMode(boolean combat) {
        this.combatMode = combat;
        if (compatibilityRowAction) {
            syncCompatibilityRowAction();
        } else {
            table().refresh();
        }
    }

    /** Exclude these IDs from search results (e.g. already-added table entries). Pass empty set to clear. */
    public void setExcludeIds(Set<Long> ids) {
        this.excludeIds = ids == null ? Set.of() : Set.copyOf(ids);
        if (hasLoadedCriteria()) refresh();
    }

    /** Filter results to creatures in the given encounter tables (empty = all creatures). */
    public void setTableIds(List<Long> tableIds) {
        this.currentTableIds = tableIds == null ? List.of() : List.copyOf(tableIds);
        resetToFirstPage();
        if (hasLoadedCriteria()) refresh();
    }

    @Override
    protected CreatureCatalogService.FilterCriteria emptyCriteria() {
        return CreatureCatalogService.FilterCriteria.empty();
    }

    @Override
    protected PageLoadResult<Creature> loadPage(
            CreatureCatalogService.FilterCriteria criteria,
            String sortColumn,
            String sortDirection,
            int limit,
            int offset) {
        return sanitizeResult(pageLoader.load(
                criteria,
                new CreatureCatalogService.PageRequest(sortColumn, sortDirection, limit, offset)));
    }

    @Override
    protected String countLabelText(int totalCount) {
        return totalCount + " Monster gefunden";
    }

    @Override
    protected String loadContext() {
        return "CreatureBrowserPane.loadPage()";
    }

    private CreatureCatalogService.ServiceResult<CreatureCatalogService.PageResult> loadDefaultPage(
            CreatureCatalogService.FilterCriteria criteria,
            CreatureCatalogService.PageRequest pageRequest) {
        List<Long> excluded = excludeIds.isEmpty() ? null : List.copyOf(excludeIds);
        return CreatureCatalogService.searchCreatures(criteria, excluded, currentTableIds, pageRequest);
    }

    private void syncCompatibilityRowAction() {
        if (onAddCreature == null) {
            rowAction = null;
        } else {
            rowAction = new CreatureBrowserRowAction(
                    combatMode ? "+Reinf." : "+Add",
                    combatMode ? "Als Verst\u00e4rkung hinzuf\u00fcgen" : "Zum Encounter hinzuf\u00fcgen (Shift+Enter)",
                    onAddCreature);
        }
        rebuildColumns();
        table().refresh();
    }

    private void rebuildColumns() {
        if (rowAction == null) {
            setColumns(baseColumns);
            return;
        }
        List<TableColumn<Creature, ?>> columns = new ArrayList<>(baseColumns);
        columns.add(actionCol);
        setColumns(columns);
    }

    private static PageLoadResult<Creature> sanitizeResult(
            CreatureCatalogService.ServiceResult<CreatureCatalogService.PageResult> result) {
        if (result == null) {
            return invalidResult("CreatureBrowserPageLoader returned null ServiceResult");
        }
        CreatureCatalogService.PageResult page = result.value();
        if (page == null) {
            return invalidResult("CreatureBrowserPageLoader returned null PageResult");
        }
        if (page.creatures() == null) {
            return invalidResult("CreatureBrowserPageLoader returned PageResult with null creatures");
        }
        if (!result.isOk()) {
            return new PageLoadResult<>(
                    page.creatures(),
                    page.totalCount(),
                    false,
                    new IllegalStateException("CreatureCatalogService status: " + result.status()),
                    false);
        }
        return new PageLoadResult<>(page.creatures(), page.totalCount(), true, null, false);
    }

    private static PageLoadResult<Creature> invalidResult(String message) {
        return new PageLoadResult<>(List.of(), 0, false, new IllegalStateException(message), true);
    }
}
