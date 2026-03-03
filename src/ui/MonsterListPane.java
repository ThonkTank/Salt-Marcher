package ui;

import entities.Creature;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.input.KeyCode;
import javafx.scene.layout.*;
import repositories.CreatureRepository;

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
    private final ComboBox<String> sortCombo;

    private Consumer<Creature> onAddCreature;
    private Consumer<Long> onRequestStatBlock;
    private Task<?> currentTask;
    private boolean combatMode = false;

    private FilterPane.FilterCriteria currentCriteria;
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
        sortCombo = new ComboBox<>(FXCollections.observableArrayList(
                "Name (A-Z)", "Name (Z-A)", "CR (aufst.)", "CR (abst.)", "XP (aufst.)", "XP (abst.)"
        ));
        sortCombo.getSelectionModel().selectFirst();

        topBar.getChildren().addAll(countLabel, spacer, sortLabel, sortCombo);
        setTop(topBar);

        // ---- CENTER: Table ----
        table = new TableView<>(items);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.getSelectionModel().setSelectionMode(SelectionMode.SINGLE);
        table.setPlaceholder(new Label("Keine Monster gefunden"));

        TableColumn<Creature, String> nameCol = new TableColumn<>("Name");
        nameCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().Name));
        nameCol.setMinWidth(120);
        nameCol.setPrefWidth(200);
        nameCol.setCellFactory(col -> new TableCell<>() {
            private final Label lbl = new Label();
            {
                lbl.getStyleClass().add("creature-link");
                lbl.setOnMouseClicked(ev -> {
                    if (getIndex() < 0 || getIndex() >= getTableView().getItems().size()) return;
                    Creature c = getTableView().getItems().get(getIndex());
                    if (onRequestStatBlock != null) onRequestStatBlock.accept(c.Id);
                });
                lbl.setAccessibleRole(javafx.scene.AccessibleRole.BUTTON);
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
        crCol.setCellValueFactory(cd -> new SimpleStringProperty(cd.getValue().CR));
        crCol.setMinWidth(40);
        crCol.setPrefWidth(50);
        crCol.setMaxWidth(60);

        TableColumn<Creature, String> typeCol = new TableColumn<>("Typ");
        typeCol.setCellValueFactory(cd -> new SimpleStringProperty(
                cd.getValue().CreatureType != null ? cd.getValue().CreatureType : ""));
        typeCol.setMinWidth(80);
        typeCol.setPrefWidth(110);
        typeCol.setMaxWidth(150);

        TableColumn<Creature, String> sizeCol = new TableColumn<>("Groesse");
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
                        ? "Als Verstaerkung hinzufuegen"
                        : "Zum Encounter hinzufuegen (Shift+Enter)");
                setGraphic(btn);
            }
        });

        table.getColumns().addAll(nameCol, crCol, typeCol, sizeCol, xpCol, addCol);
        setCenter(table);

        // ---- BOTTOM: Pagination ----
        HBox pagination = new HBox(8);
        pagination.setAlignment(Pos.CENTER);
        pagination.setPadding(new Insets(6, 0, 0, 0));

        prevButton = new Button("\u25C0 Zurueck");
        nextButton = new Button("Weiter \u25B6");
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
            int idx = sortCombo.getSelectionModel().getSelectedIndex();
            switch (idx) {
                case 0 -> { sortColumn = "name"; sortDirection = "ASC"; }
                case 1 -> { sortColumn = "name"; sortDirection = "DESC"; }
                case 2 -> { sortColumn = "cr";   sortDirection = "ASC"; }
                case 3 -> { sortColumn = "cr";   sortDirection = "DESC"; }
                case 4 -> { sortColumn = "xp";   sortDirection = "ASC"; }
                case 5 -> { sortColumn = "xp";   sortDirection = "DESC"; }
            }
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

    public void applyFilters(FilterPane.FilterCriteria criteria) {
        this.currentCriteria = criteria;
        this.currentOffset = 0;
        loadPage();
    }

    public void loadInitial() {
        if (!items.isEmpty()) return;
        this.currentCriteria = new FilterPane.FilterCriteria();
        this.currentOffset = 0;
        loadPage();
    }

    private void loadPage() {
        if (currentTask != null && currentTask.isRunning()) currentTask.cancel();

        FilterPane.FilterCriteria c = currentCriteria;
        if (c == null) c = new FilterPane.FilterCriteria();

        final FilterPane.FilterCriteria criteria = c;
        final int offset = currentOffset;

        Task<CreatureRepository.SearchResult> task = new Task<>() {
            @Override
            protected CreatureRepository.SearchResult call() {
                return CreatureRepository.searchWithFiltersAndCount(
                        criteria.nameQuery, criteria.crMin, criteria.crMax,
                        criteria.sizes, criteria.types, criteria.subtypes,
                        criteria.biomes, criteria.alignments,
                        sortColumn, sortDirection, PAGE_SIZE, offset);
            }
        };
        task.setOnSucceeded(e -> {
            CreatureRepository.SearchResult result = task.getValue();
            totalCount = result.totalCount();
            items.setAll(result.creatures());
            updatePagination();
        });
        task.setOnFailed(e ->
                System.err.println("Monster laden fehlgeschlagen: " + task.getException().getMessage()));
        currentTask = task;
        Thread t = new Thread(task, "sm-monster-load");
        t.setDaemon(true);
        t.start();
    }

    private void updatePagination() {
        int currentPage = (currentOffset / PAGE_SIZE) + 1;
        int totalPages = Math.max(1, (int) Math.ceil((double) totalCount / PAGE_SIZE));
        pageLabel.setText("Seite " + currentPage + " / " + totalPages);
        prevButton.setDisable(currentOffset <= 0);
        nextButton.setDisable(currentOffset + PAGE_SIZE >= totalCount);
        countLabel.setText(totalCount + " Monster gefunden");
    }
}
