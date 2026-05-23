package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.animation.PauseTransition;
import javafx.geometry.Side;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Slider;
import javafx.scene.control.TextField;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import org.jspecify.annotations.Nullable;

public final class CatalogControlsView extends VBox {

    private static final String FILTER_SECTION_TITLE = "FILTER";
    private static final String ENCOUNTER_SECTION_TITLE = "ENCOUNTER";
    private static final String SEARCH_KEY = "search";
    private static final String CHALLENGE_RATING_KEY = "cr";
    private static final String SIZE_PREFIX = "size:";
    private static final String TYPE_PREFIX = "type:";
    private static final String SUBTYPE_PREFIX = "subtype:";
    private static final String BIOME_PREFIX = "biome:";
    private static final String ALIGNMENT_PREFIX = "alignment:";
    private static final String ENCOUNTER_TABLE_PREFIX = "encounter-table:";
    private static final String CLOSED_SUFFIX = " ▾";
    private static final String DEFAULT_TABLE_TRIGGER = "Tabelle ▾";
    private static final String DEFAULT_TABLE_TOOLTIP = "Mehrere Encounter-Tabellen können kombiniert werden.";
    private static final String LOOT_CONFLICT_TOOLTIP =
            "Mehrere ausgewählte Tabellen verweisen auf unterschiedliche Loot-Tabellen. "
                    + "Kampfstart bleibt blockiert, bis höchstens eine verknüpfte Loot-Tabelle aktiv ist.";
    private static final Object VALUE_KEY = new Object();
    private static final Object LOOT_TABLE_ID_KEY = new Object();

    private final PauseTransition searchDebounce = new PauseTransition(Duration.millis(300));
    private final TextField searchField = new TextField();
    private final ComboBox<String> crMinimum = new ComboBox<>();
    private final ComboBox<String> crMaximum = new ComboBox<>();
    private final Button sizeButton = new Button("Größe" + CLOSED_SUFFIX);
    private final Button typeButton = new Button("Typ" + CLOSED_SUFFIX);
    private final Button subtypeButton = new Button("Unterart" + CLOSED_SUFFIX);
    private final Button biomeButton = new Button("Umgebung" + CLOSED_SUFFIX);
    private final Button alignmentButton = new Button("Gesinnung" + CLOSED_SUFFIX);
    private final Button encounterTableButton = new Button(DEFAULT_TABLE_TRIGGER);
    private final Tooltip encounterTableTooltip = new Tooltip(DEFAULT_TABLE_TOOLTIP);
    private final FlowPane chips = new FlowPane(4, 2);
    private final ContextMenu sizeMenu = new ContextMenu();
    private final ContextMenu typeMenu = new ContextMenu();
    private final ContextMenu subtypeMenu = new ContextMenu();
    private final ContextMenu biomeMenu = new ContextMenu();
    private final ContextMenu alignmentMenu = new ContextMenu();
    private final ContextMenu encounterTableMenu = new ContextMenu();
    private final TextField sizeSearch = new TextField();
    private final TextField typeSearch = new TextField();
    private final TextField subtypeSearch = new TextField();
    private final TextField biomeSearch = new TextField();
    private final TextField alignmentSearch = new TextField();
    private final VBox sizeOptions = new VBox(2);
    private final VBox typeOptions = new VBox(2);
    private final VBox subtypeOptions = new VBox(2);
    private final VBox biomeOptions = new VBox(2);
    private final VBox alignmentOptions = new VBox(2);
    private final VBox encounterTableOptions = new VBox(2);
    private final Button difficultyAuto = new Button("⚅");
    private final Button balanceAuto = new Button("⚅");
    private final Button amountAuto = new Button("⚅");
    private final Button diversityAuto = new Button("⚅");
    private final Slider difficultySlider = new Slider(1.0, 4.0, 2.0);
    private final Slider balanceSlider = new Slider(1.0, 5.0, 3.0);
    private final Slider amountSlider = new Slider(1.0, 5.0, 3.0);
    private final Slider diversitySlider = new Slider(1.0, 4.0, 3.0);
    private final Label difficultyValue = new Label();
    private final Label balanceValue = new Label();
    private final Label amountValue = new Label();
    private final Label diversityValue = new Label();

    private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = ignored -> { };

    public CatalogControlsView() {
        configureSearch();
        configureCrRange();
        configureFilterButton(sizeButton, sizeMenu, sizeSearch, sizeOptions, "Größe");
        configureFilterButton(typeButton, typeMenu, typeSearch, typeOptions, "Typ");
        configureFilterButton(subtypeButton, subtypeMenu, subtypeSearch, subtypeOptions, "Unterart");
        configureFilterButton(biomeButton, biomeMenu, biomeSearch, biomeOptions, "Umgebung");
        configureFilterButton(alignmentButton, alignmentMenu, alignmentSearch, alignmentOptions, "Gesinnung");
        configureEncounterTablePicker();
        configureTuning();

        setMaxHeight(Double.MAX_VALUE);
        getChildren().setAll(
                section(FILTER_SECTION_TITLE, padded(surface(
                        new HBox(6, searchField),
                        new FlowPane(
                                4,
                                4,
                                new Label("CR"),
                                crMinimum,
                                new Label("-"),
                                crMaximum,
                                sizeButton,
                                typeButton,
                                subtypeButton,
                                biomeButton,
                                alignmentButton,
                                encounterTableButton,
                                clearButton()),
                        chips))),
                separator(),
                section(ENCOUNTER_SECTION_TITLE, tuningRow()));
    }

    public void bind(CatalogControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        applyProjection(contentModel.projectionProperty().get());
        contentModel.projectionProperty().addListener((obs, oldValue, newValue) -> applyProjection(newValue));
    }

    void onViewInputEvent(Consumer<CatalogControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void configureSearch() {
        searchField.setPromptText("Monster suchen...");
        HBox.setHgrow(searchField, Priority.ALWAYS);
        searchDebounce.setOnFinished(event -> publishSnapshot());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> searchDebounce.playFromStart());
    }

    private void configureCrRange() {
        crMinimum.setAccessibleText("Minimaler CR");
        crMaximum.setAccessibleText("Maximaler CR");
        crMinimum.setOnAction(event -> {
            ensureCrOrder();
            publishSnapshot();
        });
        crMaximum.setOnAction(event -> {
            ensureCrOrder();
            publishSnapshot();
        });
    }

    private void configureFilterButton(
            Button button,
            ContextMenu menu,
            TextField search,
            VBox options,
            String label
    ) {
        button.getStyleClass().addAll("compact", "filter-trigger");
        search.setPromptText(label + " suchen...");
        search.textProperty().addListener((obs, oldValue, newValue) -> {
            applyOptionFilter(options, newValue);
            publishSnapshot();
        });
        VBox content = new VBox(4, search, scroll(options));
        content.getStyleClass().add("filter-dropdown");
        menu.getItems().setAll(new CustomMenuItem(content, false));
        menu.setOnHidden(event -> {
            updateFilterTrigger(button, options, label, menu);
            publishSnapshot();
        });
        button.setOnAction(event -> {
            if (menu.isShowing()) {
                menu.hide();
            } else {
                menu.show(button, Side.BOTTOM, 0.0, 2.0);
            }
            updateFilterTrigger(button, options, label, menu);
            publishSnapshot();
        });
    }

    private void configureEncounterTablePicker() {
        encounterTableButton.getStyleClass().addAll("compact", "filter-trigger");
        encounterTableButton.setTooltip(encounterTableTooltip);
        VBox content = new VBox(2, clearEncounterTablesButton(), scroll(encounterTableOptions));
        content.getStyleClass().add("filter-dropdown");
        encounterTableMenu.getItems().setAll(new CustomMenuItem(content, false));
        encounterTableMenu.setOnHidden(event -> {
            updateEncounterTableTrigger();
            publishSnapshot();
        });
        encounterTableButton.setOnAction(event -> {
            if (encounterTableMenu.isShowing()) {
                encounterTableMenu.hide();
            } else {
                encounterTableMenu.show(encounterTableButton, Side.BOTTOM, 0.0, 2.0);
            }
            updateEncounterTableTrigger();
            publishSnapshot();
        });
    }

    private void configureTuning() {
        configureTuningControl(difficultyAuto, difficultySlider, difficultyValue, "Schwierigkeit", true);
        configureTuningControl(balanceAuto, balanceSlider, balanceValue, "Balance", true);
        configureTuningControl(amountAuto, amountSlider, amountValue, "Menge", false);
        configureTuningControl(diversityAuto, diversitySlider, diversityValue, "Diversität", true);
    }

    private void configureTuningControl(
            Button autoButton,
            Slider slider,
            Label valueLabel,
            String title,
            boolean snapToTicks
    ) {
        autoButton.getStyleClass().addAll("compact", "auto-dice-btn", "active");
        autoButton.setAccessibleText(title + " automatisch bestimmen");
        autoButton.setUserData(Boolean.TRUE);
        autoButton.setOnAction(event -> {
            boolean nextAuto = !Boolean.TRUE.equals(autoButton.getUserData());
            autoButton.setUserData(nextAuto);
            updateTuningVisual(autoButton, slider, valueLabel);
            publishSnapshot();
        });
        slider.setShowTickLabels(true);
        slider.setShowTickMarks(true);
        slider.setSnapToTicks(snapToTicks);
        slider.setMajorTickUnit(1.0);
        slider.setMinorTickCount(0);
        slider.valueProperty().addListener((obs, oldValue, newValue) -> {
            updateTuningVisual(autoButton, slider, valueLabel);
            publishSnapshot();
        });
        HBox.setHgrow(slider, Priority.ALWAYS);
        updateTuningVisual(autoButton, slider, valueLabel);
    }

    private void applyProjection(CatalogControlsContentModel.ControlsProjection projection) {
        if (projection == null) {
            return;
        }
        Consumer<CatalogControlsViewInputEvent> handler = viewInputEventHandler;
        viewInputEventHandler = ignored -> { };
        try {
            CatalogControlsContentModel.FilterOptionsProjection filterOptions = projection.filterOptions();
            CatalogControlsContentModel.CreatureFilters filters = projection.creatureFilters();
            CatalogControlsContentModel.ControlsState controls = projection.controlsState();
            searchField.setText(filters.nameQuery());
            applyCrOptions(filterOptions.challengeRatings(), filters.challengeRatingMin(), filters.challengeRatingMax());
            rebuildFilter(sizeButton, sizeMenu, sizeSearch, sizeOptions, "Größe",
                    filterOptions.sizes(), filters.sizes(), projection.sizeDropdownState());
            rebuildFilter(typeButton, typeMenu, typeSearch, typeOptions, "Typ",
                    filterOptions.types(), filters.types(), projection.typeDropdownState());
            rebuildFilter(subtypeButton, subtypeMenu, subtypeSearch, subtypeOptions, "Unterart",
                    filterOptions.subtypes(), filters.subtypes(), projection.subtypeDropdownState());
            rebuildFilter(biomeButton, biomeMenu, biomeSearch, biomeOptions, "Umgebung",
                    filterOptions.biomes(), filters.biomes(), projection.biomeDropdownState());
            rebuildFilter(alignmentButton, alignmentMenu, alignmentSearch, alignmentOptions, "Gesinnung",
                    filterOptions.alignments(), filters.alignments(), projection.alignmentDropdownState());
            rebuildEncounterTables(
                    projection.encounterTableOptions(),
                    controls.encounterTableIds(),
                    projection.encounterTableDropdownState().open());
            applyTuning(difficultyAuto, difficultySlider, difficultyValue, controls.difficulty());
            applyTuning(balanceAuto, balanceSlider, balanceValue, controls.balance());
            applyTuning(amountAuto, amountSlider, amountValue, controls.amount());
            applyTuning(diversityAuto, diversitySlider, diversityValue, controls.diversity());
            rebuildChips(projection.chips());
            searchDebounce.stop();
        } finally {
            viewInputEventHandler = handler;
        }
    }

    private void applyCrOptions(List<String> values, String minimum, String maximum) {
        List<String> safeValues = values == null || values.isEmpty() ? List.of("0", "30") : List.copyOf(values);
        crMinimum.getItems().setAll(safeValues);
        crMaximum.getItems().setAll(safeValues);
        selectCrValue(crMinimum, minimum, true);
        selectCrValue(crMaximum, maximum, false);
        ensureCrOrder();
    }

    private void selectCrValue(ComboBox<String> comboBox, String value, boolean first) {
        if (value != null && !value.isBlank() && comboBox.getItems().contains(value)) {
            comboBox.getSelectionModel().select(value);
            return;
        }
        comboBox.getSelectionModel().select(first ? 0 : Math.max(comboBox.getItems().size() - 1, 0));
    }

    private void ensureCrOrder() {
        int minimumIndex = crMinimum.getSelectionModel().getSelectedIndex();
        int maximumIndex = crMaximum.getSelectionModel().getSelectedIndex();
        if (minimumIndex > maximumIndex && minimumIndex >= 0) {
            crMaximum.getSelectionModel().select(minimumIndex);
        }
    }

    private void rebuildFilter(
            Button button,
            ContextMenu menu,
            TextField search,
            VBox options,
            String label,
            List<String> availableValues,
            List<String> selectedValues,
            CatalogControlsContentModel.FilterDropdownState dropdownState
    ) {
        options.getChildren().clear();
        for (String value : availableValues == null ? List.<String>of() : availableValues) {
            CheckBox checkBox = new CheckBox(value);
            checkBox.setUserData(value);
            checkBox.setSelected(selectedValues != null && selectedValues.contains(value));
            checkBox.selectedProperty().addListener((obs, oldValue, newValue) -> {
                updateFilterTrigger(button, options, label, menu);
                publishSnapshot();
            });
            options.getChildren().add(checkBox);
        }
        search.setText(dropdownState == null ? "" : dropdownState.searchQuery());
        applyOptionFilter(options, search.getText());
        updateFilterTrigger(button, options, label, menu);
        if (dropdownState != null && dropdownState.open()) {
            if (!menu.isShowing()) {
                menu.show(button, Side.BOTTOM, 0.0, 2.0);
            }
        } else if (menu.isShowing()) {
            menu.hide();
        }
    }

    private void rebuildEncounterTables(
            List<CatalogControlsContentModel.EncounterTableOption> tables,
            List<Long> selectedTableIds,
            boolean open
    ) {
        encounterTableOptions.getChildren().clear();
        for (CatalogControlsContentModel.EncounterTableOption table : tables == null
                ? List.<CatalogControlsContentModel.EncounterTableOption>of()
                : tables) {
            CheckBox checkBox = new CheckBox(table.name());
            checkBox.setUserData(table.tableId());
            if (table.linkedLootTableId() != null) {
                checkBox.getProperties().put(LOOT_TABLE_ID_KEY, table.linkedLootTableId());
            }
            checkBox.setSelected(selectedTableIds != null && selectedTableIds.contains(table.tableId()));
            checkBox.selectedProperty().addListener((obs, oldValue, newValue) -> {
                updateEncounterTableTrigger();
                publishSnapshot();
            });
            encounterTableOptions.getChildren().add(checkBox);
        }
        updateEncounterTableTrigger();
        if (open) {
            if (!encounterTableMenu.isShowing()) {
                encounterTableMenu.show(encounterTableButton, Side.BOTTOM, 0.0, 2.0);
            }
        } else if (encounterTableMenu.isShowing()) {
            encounterTableMenu.hide();
        }
    }

    private void applyTuning(
            Button autoButton,
            Slider slider,
            Label valueLabel,
            CatalogControlsContentModel.SliderProjection projection
    ) {
        if (projection == null) {
            return;
        }
        autoButton.setUserData(projection.auto());
        slider.setValue(projection.value());
        updateTuningVisual(autoButton, slider, valueLabel);
    }

    private void updateTuningVisual(Button autoButton, Slider slider, Label valueLabel) {
        boolean auto = Boolean.TRUE.equals(autoButton.getUserData());
        slider.setDisable(auto);
        autoButton.getStyleClass().remove("active");
        if (auto) {
            autoButton.getStyleClass().add("active");
        }
        valueLabel.setText(auto ? "" : String.valueOf((int) Math.round(slider.getValue())));
    }

    private void rebuildChips(List<CatalogControlsContentModel.FilterChip> filterChips) {
        chips.getChildren().clear();
        for (CatalogControlsContentModel.FilterChip chip : filterChips == null
                ? List.<CatalogControlsContentModel.FilterChip>of()
                : filterChips) {
            HBox chipBox = new HBox(2);
            chipBox.getStyleClass().addAll("chip", chip.styleClass());
            Button remove = new Button("×");
            remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
            remove.setAccessibleText("Entfernen: " + chip.label());
            remove.setOnAction(event -> clearChip(chip.key()));
            chipBox.getChildren().setAll(new Label(chip.label()), remove);
            chips.getChildren().add(chipBox);
        }
    }

    private void clearChip(String key) {
        if (SEARCH_KEY.equals(key)) {
            searchField.setText("");
            publishSnapshot();
            return;
        }
        if (CHALLENGE_RATING_KEY.equals(key)) {
            selectCrValue(crMinimum, "", true);
            selectCrValue(crMaximum, "", false);
            publishSnapshot();
            return;
        }
        if (key != null && key.startsWith(SIZE_PREFIX)) {
            clearSelectedValue(sizeOptions, key.substring(SIZE_PREFIX.length()));
            publishSnapshot();
            return;
        }
        if (key != null && key.startsWith(TYPE_PREFIX)) {
            clearSelectedValue(typeOptions, key.substring(TYPE_PREFIX.length()));
            publishSnapshot();
            return;
        }
        if (key != null && key.startsWith(SUBTYPE_PREFIX)) {
            clearSelectedValue(subtypeOptions, key.substring(SUBTYPE_PREFIX.length()));
            publishSnapshot();
            return;
        }
        if (key != null && key.startsWith(BIOME_PREFIX)) {
            clearSelectedValue(biomeOptions, key.substring(BIOME_PREFIX.length()));
            publishSnapshot();
            return;
        }
        if (key != null && key.startsWith(ALIGNMENT_PREFIX)) {
            clearSelectedValue(alignmentOptions, key.substring(ALIGNMENT_PREFIX.length()));
            publishSnapshot();
            return;
        }
        if (key != null && key.startsWith(ENCOUNTER_TABLE_PREFIX)) {
            clearSelectedTable(key.substring(ENCOUNTER_TABLE_PREFIX.length()));
            publishSnapshot();
        }
    }

    private void clearSelectedValue(VBox options, String value) {
        for (Node node : options.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (value.equals(checkBox.getUserData())) {
                checkBox.setSelected(false);
            }
        }
    }

    private void clearSelectedTable(String rawTableId) {
        for (Node node : encounterTableOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            Object tableId = checkBox.getUserData();
            if (rawTableId.equals(String.valueOf(tableId))) {
                checkBox.setSelected(false);
            }
        }
    }

    private Button clearButton() {
        Button button = new Button("Leeren");
        button.getStyleClass().addAll("compact", "flat");
        button.setOnAction(event -> {
            searchField.setText("");
            selectCrValue(crMinimum, "", true);
            selectCrValue(crMaximum, "", false);
            clearAll(sizeOptions);
            clearAll(typeOptions);
            clearAll(subtypeOptions);
            clearAll(biomeOptions);
            clearAll(alignmentOptions);
            publishSnapshot();
        });
        return button;
    }

    private Button clearEncounterTablesButton() {
        Button button = new Button("(Alle Monster)");
        button.getStyleClass().addAll("flat", "compact");
        button.setOnAction(event -> {
            clearAll(encounterTableOptions);
            updateEncounterTableTrigger();
            publishSnapshot();
        });
        return button;
    }

    private void clearAll(VBox options) {
        for (Node node : options.getChildren()) {
            ((CheckBox) node).setSelected(false);
        }
    }

    private void applyOptionFilter(VBox options, @Nullable String query) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
        for (Node node : options.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            boolean visible = normalizedQuery.isEmpty()
                    || checkBox.getText().toLowerCase(java.util.Locale.ROOT).contains(normalizedQuery);
            checkBox.setVisible(visible);
            checkBox.setManaged(visible);
        }
    }

    private void updateFilterTrigger(Button button, VBox options, String label, ContextMenu menu) {
        int selectedCount = 0;
        for (Node node : options.getChildren()) {
            if (((CheckBox) node).isSelected()) {
                selectedCount++;
            }
        }
        button.getStyleClass().remove("filter-trigger-active");
        if (selectedCount > 0) {
            button.setText(label + " (" + selectedCount + ")" + CLOSED_SUFFIX);
            button.getStyleClass().add("filter-trigger-active");
        } else {
            button.setText(label + CLOSED_SUFFIX);
        }
        button.setAccessibleText(menu.isShowing() ? label + " geöffnet - Escape zum Schließen" : button.getText());
    }

    private void updateEncounterTableTrigger() {
        int selectedCount = 0;
        String singleName = "";
        List<Object> lootIds = new ArrayList<>();
        for (Node node : encounterTableOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                selectedCount++;
                singleName = checkBox.getText();
                Object lootId = checkBox.getProperties().get(LOOT_TABLE_ID_KEY);
                if (lootId != null && !lootIds.contains(lootId)) {
                    lootIds.add(lootId);
                }
            }
        }
        encounterTableButton.getStyleClass().remove("filter-trigger-active");
        if (selectedCount == 0) {
            encounterTableButton.setText(DEFAULT_TABLE_TRIGGER);
            encounterTableTooltip.setText(DEFAULT_TABLE_TOOLTIP);
            return;
        }
        encounterTableButton.getStyleClass().add("filter-trigger-active");
        if (selectedCount == 1) {
            encounterTableButton.setText(singleName + CLOSED_SUFFIX);
            encounterTableTooltip.setText(DEFAULT_TABLE_TOOLTIP);
            return;
        }
        if (lootIds.size() > 1) {
            encounterTableButton.setText("Tabellen (" + selectedCount + ", Loot-Konflikt)" + CLOSED_SUFFIX);
            encounterTableTooltip.setText(LOOT_CONFLICT_TOOLTIP);
            return;
        }
        encounterTableButton.setText("Tabellen (" + selectedCount + ")" + CLOSED_SUFFIX);
        encounterTableTooltip.setText(DEFAULT_TABLE_TOOLTIP);
    }

    private Node section(String title, Node content) {
        Label header = new Label(title);
        header.getStyleClass().addAll("section-header", "text-muted");
        return new VBox(0, header, content);
    }

    private Node padded(Node content) {
        return new VBox(content);
    }

    private Node surface(Node... children) {
        VBox surface = new VBox(children);
        surface.getStyleClass().add("surface-root");
        return surface;
    }

    private Node separator() {
        Region region = new Region();
        region.getStyleClass().add("control-separator");
        return region;
    }

    private Node scroll(Node content) {
        ScrollPane scrollPane = new ScrollPane(content);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        return scrollPane;
    }

    private Node tuningRow() {
        HBox row = new HBox(
                8,
                tuningControl("Schwierigkeit", difficultyAuto, difficultyValue, difficultySlider),
                tuningControl("Balance", balanceAuto, balanceValue, balanceSlider),
                tuningControl("Menge", amountAuto, amountValue, amountSlider),
                tuningControl("Diversität", diversityAuto, diversityValue, diversitySlider));
        return row;
    }

    private Node tuningControl(String title, Button autoButton, Label valueLabel, Slider slider) {
        Label label = new Label(title);
        label.getStyleClass().add("text-muted");
        valueLabel.getStyleClass().add("text-secondary");
        HBox box = new HBox(4, label, autoButton, valueLabel, slider);
        HBox.setHgrow(slider, Priority.ALWAYS);
        HBox.setHgrow(box, Priority.ALWAYS);
        return box;
    }

    private void publishSnapshot() {
        List<String> sizeValues = new ArrayList<>();
        for (Node node : sizeOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                sizeValues.add(String.valueOf(checkBox.getUserData()));
            }
        }
        List<String> typeValues = new ArrayList<>();
        for (Node node : typeOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                typeValues.add(String.valueOf(checkBox.getUserData()));
            }
        }
        List<String> subtypeValues = new ArrayList<>();
        for (Node node : subtypeOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                subtypeValues.add(String.valueOf(checkBox.getUserData()));
            }
        }
        List<String> biomeValues = new ArrayList<>();
        for (Node node : biomeOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                biomeValues.add(String.valueOf(checkBox.getUserData()));
            }
        }
        List<String> alignmentValues = new ArrayList<>();
        for (Node node : alignmentOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                alignmentValues.add(String.valueOf(checkBox.getUserData()));
            }
        }
        List<Long> selectedTableIds = new ArrayList<>();
        for (Node node : encounterTableOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            Object tableId = checkBox.getUserData();
            if (checkBox.isSelected() && tableId instanceof Long value) {
                selectedTableIds.add(value);
            }
        }
        String sizeQuery = sizeSearch.getText() == null ? "" : sizeSearch.getText();
        String typeQuery = typeSearch.getText() == null ? "" : typeSearch.getText();
        String subtypeQuery = subtypeSearch.getText() == null ? "" : subtypeSearch.getText();
        String biomeQuery = biomeSearch.getText() == null ? "" : biomeSearch.getText();
        String alignmentQuery = alignmentSearch.getText() == null ? "" : alignmentSearch.getText();
        String minimum = crMinimum.getValue() == null || crMinimum.getSelectionModel().getSelectedIndex() <= 0
                ? ""
                : crMinimum.getValue();
        String maximum = crMaximum.getValue() == null
                || crMaximum.getSelectionModel().getSelectedIndex() < 0
                || crMaximum.getSelectionModel().getSelectedIndex() >= crMaximum.getItems().size() - 1
                ? ""
                : crMaximum.getValue();
        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                searchField.getText() == null ? "" : searchField.getText().trim(),
                minimum,
                maximum,
                List.copyOf(sizeValues),
                List.copyOf(typeValues),
                List.copyOf(subtypeValues),
                List.copyOf(biomeValues),
                List.copyOf(alignmentValues),
                sizeMenu.isShowing(),
                sizeQuery,
                typeMenu.isShowing(),
                typeQuery,
                subtypeMenu.isShowing(),
                subtypeQuery,
                biomeMenu.isShowing(),
                biomeQuery,
                alignmentMenu.isShowing(),
                alignmentQuery,
                encounterTableMenu.isShowing(),
                Boolean.TRUE.equals(difficultyAuto.getUserData()),
                difficultySlider.getValue(),
                Boolean.TRUE.equals(balanceAuto.getUserData()),
                balanceSlider.getValue(),
                Boolean.TRUE.equals(amountAuto.getUserData()),
                amountSlider.getValue(),
                Boolean.TRUE.equals(diversityAuto.getUserData()),
                diversitySlider.getValue(),
                List.copyOf(selectedTableIds)));
    }
}
