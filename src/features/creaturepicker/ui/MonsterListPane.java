package features.creaturepicker.ui;

import features.creaturecatalog.model.Creature;
import javafx.beans.property.SimpleIntegerProperty;
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
import features.creaturecatalog.service.CreatureService;
import ui.UiAsyncExecutor;
import ui.UiErrorReporter;

import java.util.List;
import java.util.function.Consumer;

/**
 * Monster database table with sorting and pagination.
 * Stat blocks are displayed externally via onRequestStatBlock callback (routed to InspectorPane).
 * Filters live externally in EncounterControls (left panel).
 */
public class MonsterListPane extends BorderPane {

    private static final int PAGE_SIZE = 50;

    private final TableView<Creature> table;
    private final ObservableList<Creature> items = FXCollections.observableArrayList();
    private final Label countLabel;
    private final Label pageLabel;
    private final Button prevButton;
    private final Button nextButton;
    private final ComboBox<SortOption> sortCombo;

    private record SortOption(String label, String column, String dir) {
        @Override public String toString() { return label; }
    }

    private static final List<SortOption> SORT_OPTIONS = List.of(
            new SortOption("Name (A-Z)",   "name", "ASC"),
            new SortOption("Name (Z-A)",   "name", "DESC"),
            new SortOption("CR (aufst.)",  "cr",   "ASC"),
            new SortOption("CR (abst.)",   "cr",   "DESC"),
            new SortOption("XP (aufst.)",  "xp",   "ASC"),
            new SortOption("XP (abst.)",   "xp",   "DESC")
    );

    private final Label loadingPlaceholder = new Label("Lade...");
    private final Label emptyPlaceholder = new Label("Keine Monster gefunden");
    private final Label errorPlaceholder = new Label("Fehler beim Laden");

    private Consumer<Creature> onAddCreature;
    private Consumer<Long> onRequestStatBlock;
    private Task<?> currentTask;
    private boolean combatMode = false;

    private CreatureService.FilterCriteria currentCriteria;
    private java.util.Set<Long> excludeIds = java.util.Set.of();
    private List<Long> currentTableIds = List.of();
    private int currentOffset = 0;
    private int totalCount = 0;
    private String sortColumn = "name";
    private String sortDirection = "ASC";

    public MonsterListPane() {
        setPadding(new Insets(8));

        // ---- TOP: Count + Sort ----
        HBox topBar = new HBox(8);
        topBar.setAlignment(Pos.CENTER_LEFT);
        topBar.setPadding(new Insets(0, 0, 6, 0));

        countLabel = new Label("0 Monster gefunden");
        countLabel.getStyleClass().add("text-secondary");

        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);

        Label sortLabel = new Label("Sortierung:");
        sortLabel.getStyleClass().add("text-muted");
        sortCombo = new ComboBox<>(FXCollections.observableArrayList(SORT_OPTIONS));
        sortCombo.getSelectionModel().selectFirst();

        topBar.getChildren().addAll(countLabel, spacer, sortLabel, sortCombo);
        setTop(topBar);

        // ---- CENTER: Table ----
        table = new TableView<>(items);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(emptyPlaceholder);

        TableColumn<Creature, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().Name));
        nameCol.setMinWidth(120);
        nameCol.setPrefWidth(200);
        nameCol.setCellFactory(col -> new TableCell<>() {
            private final Button lbl = new Button();
            {
                lbl.getStyleClass().addAll("creature-link", "flat");
                lbl.setOnAction(ev -> {
                    if (getIndex() < 0 || getIndex() >= getTableView().getItems().size()) return;
                    Creature c = getTableView().getItems().get(getIndex());
                    if (onRequestStatBlock != null) onRequestStatBlock.accept(c.Id);
                });
            }
            @Override
            protected void updateItem(String name, boolean empty) {
                super.updateItem(name, empty);
                if (empty || name == null) { setText(null); setGraphic(null); return; }
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

        TableColumn<Creature, Void> addCol = new TableColumn<>("");
        addCol.setMinWidth(55);
        addCol.setPrefWidth(65);
        addCol.setMaxWidth(75);
        addCol.setSortable(false);
        addCol.setCellFactory(col -> new TableCell<>() {
            private final Button btn = new Button("+Add");
            private final Tooltip addTip = new Tooltip();
            {
                btn.getStyleClass().addAll("accent", "compact");
                btn.setTooltip(addTip);
                btn.setOnAction(e -> {
                    Creature c = getTableView().getItems().get(getIndex());
                    if (onAddCreature != null) onAddCreature.accept(c);
                });
            }
            @Override
            protected void updateItem(Void v, boolean empty) {
                super.updateItem(v, empty);
                if (empty) { setGraphic(null); return; }
                btn.setText(combatMode ? "+Reinf." : "+Add");
                addTip.setText(combatMode
                        ? "Als Verst\u00e4rkung hinzuf\u00fcgen"
                        : "Zum Encounter hinzuf\u00fcgen (Shift+Enter)");
                String creatureName = getTableView().getItems().get(getIndex()).Name;
                btn.setAccessibleText((combatMode ? "Als Verstärkung hinzufügen: " : "Zum Encounter hinzufügen: ") + creatureName);
                setGraphic(btn);
            }
        });

        table.getColumns().addAll(nameCol, crCol, typeCol, sizeCol, xpCol, addCol);
        setCenter(table);

        // ---- BOTTOM: Pagination ----
        HBox pagination = new HBox(8);
        pagination.setAlignment(Pos.CENTER);
        pagination.setPadding(new Insets(6, 0, 0, 0));

        prevButton = new Button("\u25C0 _Zur\u00fcck");
        nextButton = new Button("_Weiter \u25B6");
        pageLabel = new Label("Seite 1");
        pageLabel.getStyleClass().add("text-secondary");

        pagination.getChildren().addAll(prevButton, pageLabel, nextButton);
        setBottom(pagination);

        // ---- Listeners ----
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
            SortOption sel = sortCombo.getValue();
            if (sel == null) return;
            sortColumn = sel.column();
            sortDirection = sel.dir();
            currentOffset = 0;
            loadPage();
        });

        // Keyboard: ENTER -> stat block, Shift+ENTER -> add
        table.setOnKeyPressed(e -> {
            Creature c = table.getSelectionModel().getSelectedItem();
            if (c == null) return;
            if (e.getCode() == KeyCode.ENTER && !e.isShiftDown()) {
                if (onRequestStatBlock != null) onRequestStatBlock.accept(c.Id);
                e.consume();
            } else if (e.getCode() == KeyCode.ENTER && e.isShiftDown()) {
                if (onAddCreature != null) onAddCreature.accept(c);
                e.consume();
            }
        });
    }

    public void setOnAddCreature(Consumer<Creature> callback) { this.onAddCreature = callback; }
    public void setOnRequestStatBlock(Consumer<Long> callback) { this.onRequestStatBlock = callback; }

    public void setCombatMode(boolean combat) {
        this.combatMode = combat;
        table.refresh();
    }

    /** Exclude these IDs from search results (e.g. already-added table entries). Pass empty set to clear. */
    public void setExcludeIds(java.util.Set<Long> ids) {
        this.excludeIds = ids == null ? java.util.Set.of() : ids;
        if (!items.isEmpty() || currentCriteria != null) loadPage();
    }

    public void applyFilters(CreatureService.FilterCriteria criteria) {
        this.currentCriteria = criteria;
        this.currentOffset = 0;
        loadPage();
    }

    /** Filter results to creatures in the given encounter tables (empty = all creatures). */
    public void setTableIds(List<Long> tableIds) {
        this.currentTableIds = tableIds == null ? List.of() : tableIds;
        this.currentOffset = 0;
        loadPage();
    }

    public void loadInitial() {
        if (!items.isEmpty()) return;
        this.currentCriteria = CreatureService.FilterCriteria.empty();
        this.currentOffset = 0;
        loadPage();
    }

    private void loadPage() {
        if (currentTask != null && currentTask.isRunning()) currentTask.cancel();

        table.setPlaceholder(loadingPlaceholder);
        prevButton.setDisable(true);
        nextButton.setDisable(true);
        sortCombo.setDisable(true);

        CreatureService.FilterCriteria c = currentCriteria;
        if (c == null) c = CreatureService.FilterCriteria.empty();

        final CreatureService.FilterCriteria criteria = c;
        final int offset = currentOffset;
        final List<Long> tableIds = currentTableIds;

        Task<CreatureService.ServiceResult<CreatureService.PageResult>> task = new Task<>() {
            @Override
            protected CreatureService.ServiceResult<CreatureService.PageResult> call() {
                List<Long> excl = excludeIds.isEmpty() ? null : new java.util.ArrayList<>(excludeIds);
                return CreatureService.searchCreatures(
                        criteria,
                        excl,
                        tableIds,
                        new CreatureService.PageRequest(sortColumn, sortDirection, PAGE_SIZE, offset));
            }
        };
        task.setOnSucceeded(e -> {
            CreatureService.ServiceResult<CreatureService.PageResult> serviceResult = task.getValue();
            CreatureService.PageResult result = serviceResult.value();
            totalCount = result.totalCount();
            items.setAll(result.creatures());
            table.setPlaceholder(serviceResult.isOk() ? emptyPlaceholder : errorPlaceholder);
            sortCombo.setDisable(false);
            updatePagination();
            if (!serviceResult.isOk()) {
                UiErrorReporter.reportBackgroundFailure(
                        "MonsterListPane.loadPage() service failure",
                        new IllegalStateException("CreatureService status: " + serviceResult.status()));
            }
        });
        task.setOnFailed(e -> {
            if (!task.isCancelled()) {
                UiErrorReporter.reportBackgroundFailure("MonsterListPane.loadPage()", task.getException());
                table.setPlaceholder(errorPlaceholder);
                sortCombo.setDisable(false);
                prevButton.setDisable(currentOffset <= 0);
                nextButton.setDisable(currentOffset + PAGE_SIZE >= totalCount);
            }
        });
        currentTask = task;
        UiAsyncExecutor.submit(task);
    }

    private void updatePagination() {
        int currentPage = (currentOffset / PAGE_SIZE) + 1;
        int totalPages = Math.max(1, (int) Math.ceil((double) totalCount / PAGE_SIZE));
        pageLabel.setText("Seite " + currentPage + " / " + totalPages);
        prevButton.setDisable(currentOffset <= 0);
        nextButton.setDisable(currentOffset + PAGE_SIZE >= totalCount);
        countLabel.setText(totalCount + " Monster gefunden");
        pageLabel.notifyAccessibleAttributeChanged(javafx.scene.AccessibleAttribute.TEXT);
        countLabel.notifyAccessibleAttributeChanged(javafx.scene.AccessibleAttribute.TEXT);
    }
}
