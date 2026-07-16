package features.encounter.adapter.javafx.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.event.ActionEvent;
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
import javafx.scene.control.ToggleButton;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;

public final class CatalogControlsView extends VBox {

    private static final String FILTER_SECTION_TITLE = "FILTER";
    private static final String ENCOUNTER_SECTION_TITLE = "ENCOUNTER";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_FLAT = "flat";
    private static final String STYLE_FILTER_TRIGGER = "filter-trigger";
    private static final String STYLE_FILTER_TRIGGER_ACTIVE = "filter-trigger-active";
    private static final String SIZE_LABEL = "Größe";
    private static final String TYPE_LABEL = "Typ";
    private static final String SUBTYPE_LABEL = "Unterart";
    private static final String BIOME_LABEL = "Umgebung";
    private static final String ALIGNMENT_LABEL = "Gesinnung";
    private static final Consumer<CatalogControlsViewInputEvent> IGNORE_INPUT_EVENT = ignored -> { };

    private final Button sizeButton = new Button("Größe ▾");
    private final Button typeButton = new Button("Typ ▾");
    private final Button subtypeButton = new Button("Unterart ▾");
    private final Button biomeButton = new Button("Umgebung ▾");
    private final Button alignmentButton = new Button("Gesinnung ▾");
    private final ContextMenu sizeMenu = new ContextMenu();
    private final ContextMenu typeMenu = new ContextMenu();
    private final ContextMenu subtypeMenu = new ContextMenu();
    private final ContextMenu biomeMenu = new ContextMenu();
    private final ContextMenu alignmentMenu = new ContextMenu();
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
    private final Button encounterTableButton = new Button("Tabelle ▾");
    private final Tooltip encounterTableTooltip = new Tooltip("Mehrere Encounter-Tabellen können kombiniert werden.");
    private final ContextMenu encounterTableMenu = new ContextMenu();
    private final VBox encounterTableOptions = new VBox(2);
    private final ToggleButton difficultyAuto = new ToggleButton("⚅");
    private final ToggleButton balanceAuto = new ToggleButton("⚅");
    private final ToggleButton amountAuto = new ToggleButton("⚅");
    private final ToggleButton diversityAuto = new ToggleButton("⚅");
    private final Slider difficultySlider = new Slider(1.0, 4.0, 2.0);
    private final Slider balanceSlider = new Slider(1.0, 5.0, 3.0);
    private final Slider amountSlider = new Slider(1.0, 5.0, 3.0);
    private final Slider diversitySlider = new Slider(1.0, 4.0, 3.0);
    private final Label difficultyValue = new Label();
    private final Label balanceValue = new Label();
    private final Label amountValue = new Label();
    private final Label diversityValue = new Label();
    private final TextField searchField = new TextField();
    private final Button worldFactionButton = new Button("Fraktionen ▾");
    private final ContextMenu worldFactionMenu = new ContextMenu();
    private final VBox worldFactionOptions = new VBox(2);
    private final ComboBox<Long> worldLocationChoice = new ComboBox<>();
    private final ChangeListener<Long> worldLocationListener = this::publishWorldLocationChoice;
    private final ComboBox<String> crMinimum = new ComboBox<>();
    private final ComboBox<String> crMaximum = new ComboBox<>();
    private final CatalogControlsChallengeRatingControls challengeRating =
            new CatalogControlsChallengeRatingControls(crMinimum, crMaximum, this::publishSnapshot);
    private final CatalogControlsSearchControls searchControls =
            new CatalogControlsSearchControls(searchField, challengeRating, this::publishSnapshot);
    private final CatalogControlsFilterPickers filterPickers = new CatalogControlsFilterPickers(
            new CatalogControlsMultiSelectFilter(
                    sizeButton,
                    sizeMenu,
                    sizeSearch,
                    sizeOptions,
                    SIZE_LABEL,
                    this::publishSnapshot),
            new CatalogControlsMultiSelectFilter(
                    typeButton,
                    typeMenu,
                    typeSearch,
                    typeOptions,
                    TYPE_LABEL,
                    this::publishSnapshot),
            new CatalogControlsMultiSelectFilter(
                    subtypeButton,
                    subtypeMenu,
                    subtypeSearch,
                    subtypeOptions,
                    SUBTYPE_LABEL,
                    this::publishSnapshot),
            new CatalogControlsMultiSelectFilter(
                    biomeButton,
                    biomeMenu,
                    biomeSearch,
                    biomeOptions,
                    BIOME_LABEL,
                    this::publishSnapshot),
            new CatalogControlsMultiSelectFilter(
                    alignmentButton,
                    alignmentMenu,
                    alignmentSearch,
                    alignmentOptions,
                    ALIGNMENT_LABEL,
                    this::publishSnapshot));
    private final CatalogControlsEncounterTablePicker encounterTablePicker =
            new CatalogControlsEncounterTablePicker(
                    encounterTableButton,
                    encounterTableTooltip,
                    encounterTableMenu,
                    encounterTableOptions,
                    this::publishSnapshot);
    private final CatalogControlsTuningControl difficultyTuning = new CatalogControlsTuningControl(
            "Schwierigkeit",
            difficultyAuto,
            difficultyValue,
            difficultySlider,
            true,
            this::publishSnapshot);
    private final CatalogControlsTuningControl balanceTuning = new CatalogControlsTuningControl(
            "Balance",
            balanceAuto,
            balanceValue,
            balanceSlider,
            true,
            this::publishSnapshot);
    private final CatalogControlsTuningControl amountTuning = new CatalogControlsTuningControl(
            "Menge",
            amountAuto,
            amountValue,
            amountSlider,
            false,
            this::publishSnapshot);
    private final CatalogControlsTuningControl diversityTuning = new CatalogControlsTuningControl(
            "Diversität",
            diversityAuto,
            diversityValue,
            diversitySlider,
            true,
            this::publishSnapshot);
    private final CatalogControlsTuningControls tuningControls = new CatalogControlsTuningControls(
            difficultyTuning,
            balanceTuning,
            amountTuning,
            diversityTuning);
    private final CatalogControlsChipControls chipControls = new CatalogControlsChipControls(
            searchControls,
            filterPickers,
            encounterTablePicker,
            this::clearWorldSources,
            this::publishSnapshot);

    private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = IGNORE_INPUT_EVENT;

    public CatalogControlsView() {
        setMaxHeight(Double.MAX_VALUE);
        configureWorldSourceControls();
        getChildren().setAll(
                CatalogControlsChrome.section(FILTER_SECTION_TITLE, CatalogControlsChrome.padded(
                        CatalogControlsChrome.surface(
                                searchControls,
                                CatalogControlsChrome.flow(
                                        4,
                                        4,
                                        new Label("CR"),
                                        searchControls.minimumChallengeRatingNode(),
                                        new Label("-"),
                                        searchControls.maximumChallengeRatingNode(),
                                        sizeButton,
                                        typeButton,
                                        subtypeButton,
                                        biomeButton,
                                        alignmentButton,
                                        chipControls.clearButton()),
                                CatalogControlsChrome.flow(
                                        4,
                                        4,
                                        worldFactionButton,
                                        new Label("Location"),
                                        worldLocationChoice),
                                chipControls.node()))),
                CatalogControlsChrome.separator(),
                CatalogControlsChrome.section(ENCOUNTER_SECTION_TITLE, tuningControls.node()));
    }

    public void bind(CatalogControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        applyProjection(contentModel.projectionProperty().get());
        contentModel.projectionProperty().addListener((obs, oldValue, newValue) -> applyProjection(newValue));
    }

    void onViewInputEvent(Consumer<CatalogControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? IGNORE_INPUT_EVENT : handler;
    }

    private void applyProjection(CatalogControlsContentModel.ControlsProjection projection) {
        if (projection == null) {
            return;
        }
        Consumer<CatalogControlsViewInputEvent> handler = viewInputEventHandler;
        viewInputEventHandler = IGNORE_INPUT_EVENT;
        try {
            applyProjectionValues(projection);
        } finally {
            viewInputEventHandler = handler;
        }
    }

    private void applyProjectionValues(CatalogControlsContentModel.ControlsProjection projection) {
        CatalogControlsContentModel.FilterOptionsProjection filterOptions = projection.filterOptions();
        CatalogControlsContentModel.CreatureFilters filters = projection.creatureFilters();
        CatalogControlsContentModel.ControlsState controls = projection.controlsState();
        searchControls.apply(filterOptions.challengeRatings(), filters);
        filterPickers.apply(filterOptions, filters, projection);
        encounterTablePicker.apply(
                projection.encounterTableOptions(),
                controls.encounterTableIds(),
                projection.encounterTableDropdownState().open());
        applyWorldSourceOptions(projection, controls);
        tuningControls.apply(controls);
        chipControls.apply(projection.chips());
    }

    private void applyWorldSourceOptions(
            CatalogControlsContentModel.ControlsProjection projection,
            CatalogControlsContentModel.ControlsState controls
    ) {
        runWithoutWorldLocationListener(() -> {
            applyWorldFactionOptions(projection.worldFactionOptions(), controls.worldFactionIds());
            applyWorldLocationOptions(projection.worldLocationOptions(), controls.worldLocationId());
        });
    }

    private void publishSnapshot() {
        publishSnapshotEvent(new CatalogControlsViewInputEvent(
                rawSearchText().trim(),
                rawMinimumChallengeRating(),
                rawMaximumChallengeRating(),
                rawSelectedValues(sizeOptions),
                rawSelectedValues(typeOptions),
                rawSelectedValues(subtypeOptions),
                rawSelectedValues(biomeOptions),
                rawSelectedValues(alignmentOptions),
                sizeMenu.isShowing(),
                rawText(sizeSearch),
                typeMenu.isShowing(),
                rawText(typeSearch),
                subtypeMenu.isShowing(),
                rawText(subtypeSearch),
                biomeMenu.isShowing(),
                rawText(biomeSearch),
                alignmentMenu.isShowing(),
                rawText(alignmentSearch),
                encounterTableMenu.isShowing(),
                difficultyAuto.isSelected(),
                difficultySlider.getValue(),
                balanceAuto.isSelected(),
                balanceSlider.getValue(),
                amountAuto.isSelected(),
                amountSlider.getValue(),
                diversityAuto.isSelected(),
                diversitySlider.getValue(),
                rawSelectedEncounterTableIds(encounterTableOptions),
                rawWorldFactionIds(),
                rawWorldLocationId()));
    }

    private void publishSnapshotEvent(CatalogControlsViewInputEvent event) {
        viewInputEventHandler.accept(event);
    }

    private String rawSearchText() {
        String value = searchField.getText();
        return value == null ? "" : value;
    }

    private String rawMinimumChallengeRating() {
        return crMinimum.getValue() == null || crMinimum.getSelectionModel().getSelectedIndex() <= 0
                ? ""
                : crMinimum.getValue();
    }

    private String rawMaximumChallengeRating() {
        return crMaximum.getValue() == null
                || crMaximum.getSelectionModel().getSelectedIndex() < 0
                || crMaximum.getSelectionModel().getSelectedIndex() >= crMaximum.getItems().size() - 1
                ? ""
                : crMaximum.getValue();
    }

    private static List<String> rawSelectedValues(VBox options) {
        List<String> values = new ArrayList<>();
        for (Node node : options.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                values.add(String.valueOf(checkBox.getUserData()));
            }
        }
        return List.copyOf(values);
    }

    private static List<Long> rawSelectedEncounterTableIds(VBox options) {
        List<Long> selectedTableIds = new ArrayList<>();
        for (Node node : options.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            Object tableId = checkBox.getUserData();
            if (checkBox.isSelected() && tableId instanceof Long value) {
                selectedTableIds.add(value);
            }
        }
        return List.copyOf(selectedTableIds);
    }

    private static String rawText(TextField field) {
        String value = field.getText();
        return value == null ? "" : value;
    }

    private void applyWorldFactionOptions(
            List<CatalogControlsContentModel.WorldSourceOption> factions,
            List<Long> selectedFactionIds
    ) {
        worldFactionOptions.getChildren().clear();
        for (CatalogControlsContentModel.WorldSourceOption faction : factions == null
                ? List.<CatalogControlsContentModel.WorldSourceOption>of()
                : factions) {
            CheckBox checkBox = new CheckBox(formatWorldChoice(faction.id(), faction.name()));
            checkBox.setUserData(faction.id());
            checkBox.setSelected(selectedFactionIds != null && selectedFactionIds.contains(faction.id()));
            checkBox.setOnAction(event -> {
                updateWorldFactionTrigger();
                publishSnapshot();
            });
            worldFactionOptions.getChildren().add(checkBox);
        }
        for (Long selectedFactionId : selectedFactionIds == null ? List.<Long>of() : selectedFactionIds) {
            if (!hasWorldFactionOption(selectedFactionId)) {
                CheckBox checkBox = new CheckBox(formatWorldChoice(selectedFactionId, "Faction #" + selectedFactionId));
                checkBox.setUserData(selectedFactionId);
                checkBox.setSelected(true);
                checkBox.setOnAction(event -> {
                    updateWorldFactionTrigger();
                    publishSnapshot();
                });
                worldFactionOptions.getChildren().add(checkBox);
            }
        }
        updateWorldFactionTrigger();
    }

    private void applyWorldLocationOptions(
            List<CatalogControlsContentModel.WorldSourceOption> locations,
            long selectedLocationId
    ) {
        List<Long> choiceIds = new ArrayList<>();
        List<String> choiceLabels = new ArrayList<>();
        choiceIds.add(0L);
        choiceLabels.add("(Alle Locations)");
        boolean selectedPresent = selectedLocationId <= 0L;
        for (CatalogControlsContentModel.WorldSourceOption location : locations == null
                ? List.<CatalogControlsContentModel.WorldSourceOption>of()
                : locations) {
            choiceIds.add(location.id());
            choiceLabels.add(formatWorldChoice(location.id(), location.name()));
            selectedPresent = selectedPresent || location.id() == selectedLocationId;
        }
        if (!selectedPresent) {
            choiceIds.add(selectedLocationId);
            choiceLabels.add(formatWorldChoice(selectedLocationId, "Location #" + selectedLocationId));
        }
        applyWorldLocationLabels(choiceIds, choiceLabels);
        worldLocationChoice.getItems().setAll(choiceIds);
        worldLocationChoice.getSelectionModel().select(choiceForId(choiceIds, selectedLocationId));
    }

    private void updateWorldFactionTrigger() {
        int selectedCount = 0;
        String singleName = "";
        for (Node node : worldFactionOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (checkBox.isSelected()) {
                selectedCount++;
                singleName = checkBox.getText();
            }
        }
        worldFactionButton.getStyleClass().remove(STYLE_FILTER_TRIGGER_ACTIVE);
        if (selectedCount == 0) {
            worldFactionButton.setText("Fraktionen ▾");
            return;
        }
        worldFactionButton.getStyleClass().add(STYLE_FILTER_TRIGGER_ACTIVE);
        worldFactionButton.setText(selectedCount == 1 ? singleName + " ▾" : "Fraktionen (" + selectedCount + ") ▾");
    }

    private List<Long> rawWorldFactionIds() {
        List<Long> selectedFactionIds = new ArrayList<>();
        for (Node node : worldFactionOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            Object factionId = checkBox.getUserData();
            if (checkBox.isSelected() && factionId instanceof Long value) {
                selectedFactionIds.add(value);
            }
        }
        return List.copyOf(selectedFactionIds);
    }

    private long rawWorldLocationId() {
        Long selectedLocationId = worldLocationChoice.getSelectionModel().getSelectedItem();
        return selectedLocationId == null ? 0L : selectedLocationId;
    }

    private boolean hasWorldFactionOption(long factionId) {
        for (Node node : worldFactionOptions.getChildren()) {
            CheckBox checkBox = (CheckBox) node;
            if (Long.valueOf(factionId).equals(checkBox.getUserData())) {
                return true;
            }
        }
        return false;
    }

    private static Long choiceForId(List<Long> choices, long selectedId) {
        for (Long choice : choices == null ? List.<Long>of() : choices) {
            if (choice != null && choice.longValue() == selectedId) {
                return choice;
            }
        }
        if (choices == null || choices.isEmpty()) {
            return 0L;
        }
        return choices.get(0);
    }

    private static String formatWorldChoice(long id, String name) {
        return "#" + id + " | " + (name == null || name.isBlank() ? "Quelle " + id : name);
    }

    private void applyWorldLocationLabels(List<Long> choiceIds, List<String> choiceLabels) {
        List<Long> safeChoiceIds = choiceIds == null ? List.of() : List.copyOf(choiceIds);
        List<String> safeChoiceLabels = choiceLabels == null ? List.of() : List.copyOf(choiceLabels);
        worldLocationChoice.setConverter(new StringConverter<>() {
            @Override
            public String toString(Long value) {
                return labelForLocationId(safeChoiceIds, safeChoiceLabels, value);
            }

            @Override
            public Long fromString(String value) {
                return 0L;
            }
        });
    }

    private static String labelForLocationId(List<Long> choiceIds, List<String> choiceLabels, @Nullable Long value) {
        if (value == null || value <= 0L) {
            return "(Alle Locations)";
        }
        for (int index = 0; index < choiceIds.size() && index < choiceLabels.size(); index++) {
            if (value.equals(choiceIds.get(index))) {
                return choiceLabels.get(index);
            }
        }
        return formatWorldChoice(value, "Location #" + value);
    }

    private void configureWorldSourceControls() {
        worldFactionButton.getStyleClass().addAll(STYLE_COMPACT, STYLE_FILTER_TRIGGER);
        VBox content = new VBox(2, worldFactionClearButton(), CatalogControlsChrome.scroll(worldFactionOptions));
        content.getStyleClass().add("filter-dropdown");
        worldFactionMenu.getItems().setAll(new CustomMenuItem(content, false));
        worldFactionMenu.setOnHidden(event -> {
            updateWorldFactionTrigger();
            publishSnapshot();
        });
        worldFactionButton.setOnAction(event -> {
            if (worldFactionMenu.isShowing()) {
                worldFactionMenu.hide();
            } else {
                worldFactionMenu.show(worldFactionButton, Side.BOTTOM, 0.0, 2.0);
            }
        });
        worldLocationChoice.getStyleClass().add(STYLE_COMPACT);
        worldLocationChoice.valueProperty().addListener(worldLocationListener);
    }

    private Button worldFactionClearButton() {
        Button clearButton = new Button("(Alle Fraktionen)");
        clearButton.getStyleClass().addAll(STYLE_FLAT, STYLE_COMPACT);
        clearButton.setOnAction(event -> {
            for (Node node : worldFactionOptions.getChildren()) {
                ((CheckBox) node).setSelected(false);
            }
            updateWorldFactionTrigger();
            publishSnapshot();
        });
        return clearButton;
    }

    private void clearWorldSources() {
        runWithoutWorldLocationListener(() -> {
            for (Node node : worldFactionOptions.getChildren()) {
                ((CheckBox) node).setSelected(false);
            }
            if (worldLocationChoice.getItems().isEmpty()) {
                worldLocationChoice.setValue(null);
            } else {
                worldLocationChoice.getSelectionModel().selectFirst();
            }
            updateWorldFactionTrigger();
        });
    }

    private void runWithoutWorldLocationListener(Runnable action) {
        worldLocationChoice.valueProperty().removeListener(worldLocationListener);
        try {
            action.run();
        } finally {
            worldLocationChoice.valueProperty().addListener(worldLocationListener);
        }
    }

    private void publishWorldLocationChoice(
            ObservableValue<? extends Long> observable,
            Long before,
            Long after
    ) {
        publishSnapshot();
    }

    private static final class CatalogControlsSearchControls extends HBox {
    
        private final TextField searchField;
        private final CatalogControlsChallengeRatingControls challengeRating;
        private final Runnable publishSnapshot;
        private final ChangeListener<String> searchTextListener;
    
        CatalogControlsSearchControls(
                TextField searchField,
                CatalogControlsChallengeRatingControls challengeRating,
                Runnable publishSnapshot
        ) {
            super(6);
            this.searchField = searchField;
            this.challengeRating = challengeRating;
            this.publishSnapshot = publishSnapshot;
            searchTextListener = (obs, oldValue, newValue) -> publishSnapshot.run();
            configureSearch();
        }
    
        Node minimumChallengeRatingNode() {
            return challengeRating.minimumNode();
        }
    
        Node maximumChallengeRatingNode() {
            return challengeRating.maximumNode();
        }
    
        void apply(List<String> challengeRatings, CatalogControlsContentModel.CreatureFilters filters) {
            setSearchText(filters.nameQuery());
            challengeRating.apply(challengeRatings, filters.challengeRatingMin(), filters.challengeRatingMax());
        }
    
        void clearQuery() {
            setSearchText("");
        }
    
        void clearChallengeRating() {
            challengeRating.clear();
        }
    
        private void configureSearch() {
            searchField.setPromptText("Monster suchen...");
            setHgrow(searchField, Priority.ALWAYS);
            getChildren().setAll(searchField);
            searchField.textProperty().addListener(searchTextListener);
        }

        private void setSearchText(String value) {
            searchField.textProperty().removeListener(searchTextListener);
            try {
                searchField.setText(value);
            } finally {
                searchField.textProperty().addListener(searchTextListener);
            }
        }
    }

    private static final class CatalogControlsChipControls {
    
        private static final String SEARCH_KEY = "search";
        private static final String CHALLENGE_RATING_KEY = "cr";
        private static final String ENCOUNTER_TABLE_PREFIX = "encounter-table:";
        private final FlowPane chips = new FlowPane(4, 2);
        private final CatalogControlsSearchControls searchControls;
        private final CatalogControlsFilterPickers filterPickers;
        private final CatalogControlsEncounterTablePicker encounterTablePicker;
        private final Runnable clearWorldSources;
        private final Runnable publishSnapshot;
    
        CatalogControlsChipControls(
                CatalogControlsSearchControls searchControls,
                CatalogControlsFilterPickers filterPickers,
                CatalogControlsEncounterTablePicker encounterTablePicker,
                Runnable clearWorldSources,
                Runnable publishSnapshot
        ) {
            this.searchControls = searchControls;
            this.filterPickers = filterPickers;
            this.encounterTablePicker = encounterTablePicker;
            this.clearWorldSources = clearWorldSources;
            this.publishSnapshot = publishSnapshot;
        }
    
        Node node() {
            return chips;
        }
    
        Button clearButton() {
            Button button = new Button("Leeren");
            button.getStyleClass().addAll(STYLE_COMPACT, STYLE_FLAT);
            button.setOnAction(event -> {
                searchControls.clearQuery();
                searchControls.clearChallengeRating();
                filterPickers.clear();
                encounterTablePicker.clearAll();
                clearWorldSources.run();
                publishSnapshot.run();
            });
            return button;
        }
    
        void apply(List<CatalogControlsContentModel.FilterChip> filterChips) {
            chips.getChildren().clear();
            for (CatalogControlsContentModel.FilterChip chip : filterChips == null
                    ? List.<CatalogControlsContentModel.FilterChip>of()
                    : filterChips) {
                HBox chipBox = new HBox(2);
                chipBox.getStyleClass().addAll("chip", chip.styleClass());
                Button remove = new Button("×");
                remove.getStyleClass().addAll(STYLE_FLAT, STYLE_COMPACT, "chip-remove-btn");
                remove.setAccessibleText("Entfernen: " + chip.label());
                remove.setOnAction(event -> clearChip(chip.key()));
                chipBox.getChildren().setAll(new Label(chip.label()), remove);
                chips.getChildren().add(chipBox);
            }
        }
    
        private void clearChip(String key) {
            if (SEARCH_KEY.equals(key)) {
                searchControls.clearQuery();
                publishSnapshot.run();
                return;
            }
            if (CHALLENGE_RATING_KEY.equals(key)) {
                searchControls.clearChallengeRating();
                publishSnapshot.run();
                return;
            }
            if (clearPrefixedChip(key)) {
                publishSnapshot.run();
            }
        }
    
        private boolean clearPrefixedChip(String key) {
            if (key == null) {
                return false;
            }
            if (filterPickers.clearPrefixedChip(key)) {
                return true;
            }
            if (key.startsWith(ENCOUNTER_TABLE_PREFIX)) {
                encounterTablePicker.clearSelectedTable(key.substring(ENCOUNTER_TABLE_PREFIX.length()));
                return true;
            }
            return false;
        }
    }

    private static final class CatalogControlsFilterPickers {
    
        private static final String SIZE_PREFIX = "size:";
        private static final String TYPE_PREFIX = "type:";
        private static final String SUBTYPE_PREFIX = "subtype:";
        private static final String BIOME_PREFIX = "biome:";
        private static final String ALIGNMENT_PREFIX = "alignment:";
    
        private final CatalogControlsMultiSelectFilter size;
        private final CatalogControlsMultiSelectFilter type;
        private final CatalogControlsMultiSelectFilter subtype;
        private final CatalogControlsMultiSelectFilter biome;
        private final CatalogControlsMultiSelectFilter alignment;
    
        CatalogControlsFilterPickers(
                CatalogControlsMultiSelectFilter size,
                CatalogControlsMultiSelectFilter type,
                CatalogControlsMultiSelectFilter subtype,
                CatalogControlsMultiSelectFilter biome,
                CatalogControlsMultiSelectFilter alignment
        ) {
            this.size = size;
            this.type = type;
            this.subtype = subtype;
            this.biome = biome;
            this.alignment = alignment;
        }
    
        void apply(
                CatalogControlsContentModel.FilterOptionsProjection filterOptions,
                CatalogControlsContentModel.CreatureFilters filters,
                CatalogControlsContentModel.ControlsProjection projection
        ) {
            size.apply("Größe", filterOptions.sizes(), filters.sizes(), projection.sizeDropdownState());
            type.apply("Typ", filterOptions.types(), filters.types(), projection.typeDropdownState());
            subtype.apply("Unterart", filterOptions.subtypes(), filters.subtypes(), projection.subtypeDropdownState());
            biome.apply("Umgebung", filterOptions.biomes(), filters.biomes(), projection.biomeDropdownState());
            alignment.apply("Gesinnung", filterOptions.alignments(), filters.alignments(), projection.alignmentDropdownState());
        }
    
        void clear() {
            size.clearAll(SIZE_LABEL);
            type.clearAll(TYPE_LABEL);
            subtype.clearAll(SUBTYPE_LABEL);
            biome.clearAll(BIOME_LABEL);
            alignment.clearAll(ALIGNMENT_LABEL);
        }
    
        boolean clearPrefixedChip(String key) {
            if (key == null) {
                return false;
            }
            if (key.startsWith(SIZE_PREFIX)) {
                size.clearSelectedValue(SIZE_LABEL, key.substring(SIZE_PREFIX.length()));
                return true;
            }
            if (key.startsWith(TYPE_PREFIX)) {
                type.clearSelectedValue(TYPE_LABEL, key.substring(TYPE_PREFIX.length()));
                return true;
            }
            if (key.startsWith(SUBTYPE_PREFIX)) {
                subtype.clearSelectedValue(SUBTYPE_LABEL, key.substring(SUBTYPE_PREFIX.length()));
                return true;
            }
            if (key.startsWith(BIOME_PREFIX)) {
                biome.clearSelectedValue(BIOME_LABEL, key.substring(BIOME_PREFIX.length()));
                return true;
            }
            if (key.startsWith(ALIGNMENT_PREFIX)) {
                alignment.clearSelectedValue(ALIGNMENT_LABEL, key.substring(ALIGNMENT_PREFIX.length()));
                return true;
            }
            return false;
        }
    }

    private static final class CatalogControlsMultiSelectFilter {
    
        private static final String CLOSED_SUFFIX = " ▾";
    
        private final Button button;
        private final ContextMenu menu;
        private final TextField search;
        private final VBox options;
        private final Runnable publishSnapshot;
    
        CatalogControlsMultiSelectFilter(
                Button button,
                ContextMenu menu,
                TextField search,
                VBox options,
                String label,
                Runnable publishSnapshot
        ) {
            this.button = button;
            this.menu = menu;
            this.search = search;
            this.options = options;
            this.publishSnapshot = publishSnapshot == null ? () -> { } : publishSnapshot;
            configure(label);
        }
    
        void apply(
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
                checkBox.setOnAction(event -> {
                    updateTrigger(label);
                    publishSnapshot.run();
                });
                options.getChildren().add(checkBox);
            }
            search.setText(dropdownState == null ? "" : dropdownState.searchQuery());
            CatalogControlsTextValues.applyOptionFilter(options, search.getText());
            updateTrigger(label);
            applyOpenState(dropdownState != null && dropdownState.open());
        }
    
        void clearAll(String label) {
            for (Node node : options.getChildren()) {
                ((CheckBox) node).setSelected(false);
            }
            updateTrigger(label);
        }
    
        void clearSelectedValue(String label, String value) {
            for (Node node : options.getChildren()) {
                CheckBox checkBox = (CheckBox) node;
                if (value.equals(checkBox.getUserData())) {
                    checkBox.setSelected(false);
                }
            }
            updateTrigger(label);
        }
    
        private void configure(String label) {
            button.getStyleClass().addAll(STYLE_COMPACT, STYLE_FILTER_TRIGGER);
            search.setPromptText(label + " suchen...");
            search.textProperty().addListener((obs, oldValue, newValue) -> {
                CatalogControlsTextValues.applyOptionFilter(options, newValue);
                publishSnapshot.run();
            });
            VBox content = new VBox(4, search, CatalogControlsChrome.scroll(options));
            content.getStyleClass().add("filter-dropdown");
            menu.getItems().setAll(new CustomMenuItem(content, false));
            menu.setOnHidden(event -> {
                updateTrigger(label);
                publishSnapshot.run();
            });
            button.setOnAction(event -> {
                if (menu.isShowing()) {
                    menu.hide();
                } else {
                    menu.show(button, Side.BOTTOM, 0.0, 2.0);
                }
                updateTrigger(label);
                publishSnapshot.run();
            });
        }

        private void applyOpenState(boolean open) {
            if (open) {
                if (!menu.isShowing()) {
                    menu.show(button, Side.BOTTOM, 0.0, 2.0);
                }
            } else if (menu.isShowing()) {
                menu.hide();
            }
        }
    
        private void updateTrigger(String label) {
            int selectedCount = 0;
            for (Node node : options.getChildren()) {
                if (((CheckBox) node).isSelected()) {
                    selectedCount++;
                }
            }
            button.getStyleClass().remove(STYLE_FILTER_TRIGGER_ACTIVE);
            if (selectedCount > 0) {
                button.setText(label + " (" + selectedCount + ")" + CLOSED_SUFFIX);
                button.getStyleClass().add(STYLE_FILTER_TRIGGER_ACTIVE);
            } else {
                button.setText(label + CLOSED_SUFFIX);
            }
            button.setAccessibleText(menu.isShowing() ? label + " geöffnet - Escape zum Schließen" : button.getText());
        }
    }

    private static final class CatalogControlsEncounterTablePicker {
    
        private static final String CLOSED_SUFFIX = " ▾";
        private static final String DEFAULT_TABLE_TRIGGER = "Tabelle ▾";
        private static final String DEFAULT_TABLE_TOOLTIP = "Mehrere Encounter-Tabellen können kombiniert werden.";
        private static final String LOOT_CONFLICT_TOOLTIP =
                "Mehrere ausgewählte Tabellen verweisen auf unterschiedliche Loot-Tabellen. "
                        + "Kampfstart bleibt blockiert, bis höchstens eine verknüpfte Loot-Tabelle aktiv ist.";
        private static final Object LOOT_TABLE_ID_KEY = new Object();
        private static final int SINGLE_SELECTION_COUNT = 1;
    
        private final Button button;
        private final Tooltip tooltip;
        private final ContextMenu menu;
        private final VBox options;
        private final Runnable publishSnapshot;
    
        CatalogControlsEncounterTablePicker(
                Button button,
                Tooltip tooltip,
                ContextMenu menu,
                VBox options,
                Runnable publishSnapshot
        ) {
            this.button = button;
            this.tooltip = tooltip;
            this.menu = menu;
            this.options = options;
            this.publishSnapshot = publishSnapshot;
            configure();
        }
    
        void apply(
                List<CatalogControlsContentModel.EncounterTableOption> tables,
                List<Long> selectedTableIds,
                boolean open
        ) {
            options.getChildren().clear();
            for (CatalogControlsContentModel.EncounterTableOption table : tables == null
                    ? List.<CatalogControlsContentModel.EncounterTableOption>of()
                    : tables) {
                CheckBox checkBox = new CheckBox(table.name());
                checkBox.setUserData(table.tableId());
                if (table.linkedLootTableId() != null) {
                    checkBox.getProperties().put(LOOT_TABLE_ID_KEY, table.linkedLootTableId());
                }
                checkBox.setSelected(selectedTableIds != null && selectedTableIds.contains(table.tableId()));
                checkBox.setOnAction(event -> {
                    updateTrigger();
                    publishSnapshot.run();
                });
                options.getChildren().add(checkBox);
            }
            updateTrigger();
            applyOpenState(open);
        }
    
        void clearSelectedTable(String rawTableId) {
            for (Node node : options.getChildren()) {
                CheckBox checkBox = (CheckBox) node;
                Object tableId = checkBox.getUserData();
                if (rawTableId.equals(String.valueOf(tableId))) {
                    checkBox.setSelected(false);
                }
            }
            updateTrigger();
        }

        void clearAll() {
            for (Node node : options.getChildren()) {
                ((CheckBox) node).setSelected(false);
            }
            updateTrigger();
        }
    
        private void configure() {
            button.getStyleClass().addAll(STYLE_COMPACT, STYLE_FILTER_TRIGGER);
            button.setTooltip(tooltip);
            VBox content = new VBox(2, clearButton(), CatalogControlsChrome.scroll(options));
            content.getStyleClass().add("filter-dropdown");
            menu.getItems().setAll(new CustomMenuItem(content, false));
            menu.setOnHidden(event -> {
                updateTrigger();
                publishSnapshot.run();
            });
            button.setOnAction(event -> {
                if (menu.isShowing()) {
                    menu.hide();
                } else {
                    menu.show(button, Side.BOTTOM, 0.0, 2.0);
                }
                updateTrigger();
                publishSnapshot.run();
            });
        }
    
        private Button clearButton() {
            Button clearButton = new Button("(Alle Monster)");
            clearButton.getStyleClass().addAll(STYLE_FLAT, STYLE_COMPACT);
            clearButton.setOnAction(event -> {
                for (Node node : options.getChildren()) {
                    ((CheckBox) node).setSelected(false);
                }
                updateTrigger();
                publishSnapshot.run();
            });
            return clearButton;
        }
    
        private void applyOpenState(boolean open) {
            if (open) {
                if (!menu.isShowing()) {
                    menu.show(button, Side.BOTTOM, 0.0, 2.0);
                }
            } else if (menu.isShowing()) {
                menu.hide();
            }
        }
    
        private void updateTrigger() {
            int selectedCount = 0;
            String singleName = "";
            List<Object> lootIds = new ArrayList<>();
            for (Node node : options.getChildren()) {
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
            button.getStyleClass().remove(STYLE_FILTER_TRIGGER_ACTIVE);
            if (selectedCount == 0) {
                button.setText(DEFAULT_TABLE_TRIGGER);
                tooltip.setText(DEFAULT_TABLE_TOOLTIP);
                return;
            }
            button.getStyleClass().add(STYLE_FILTER_TRIGGER_ACTIVE);
            if (selectedCount == SINGLE_SELECTION_COUNT) {
                button.setText(singleName + CLOSED_SUFFIX);
                tooltip.setText(DEFAULT_TABLE_TOOLTIP);
                return;
            }
            if (lootIds.size() > SINGLE_SELECTION_COUNT) {
                button.setText("Tabellen (" + selectedCount + ", Loot-Konflikt)" + CLOSED_SUFFIX);
                tooltip.setText(LOOT_CONFLICT_TOOLTIP);
                return;
            }
            button.setText("Tabellen (" + selectedCount + ")" + CLOSED_SUFFIX);
            tooltip.setText(DEFAULT_TABLE_TOOLTIP);
        }
    }

    private static final class CatalogControlsTuningControl {
    
        private static final String STYLE_ACTIVE = "active";
    
        private final Label label;
        private final ToggleButton autoButton;
        private final Label valueLabel;
        private final Slider slider;
        private final Runnable publishSnapshot;
    
        CatalogControlsTuningControl(
                String title,
                ToggleButton autoButton,
                Label valueLabel,
                Slider slider,
                boolean snapToTicks,
                Runnable publishSnapshot
        ) {
            label = new Label(title);
            this.autoButton = autoButton;
            this.valueLabel = valueLabel;
            this.slider = slider;
            this.publishSnapshot = publishSnapshot;
            configure(title, snapToTicks);
        }
    
        Node node() {
            label.getStyleClass().add("text-muted");
            valueLabel.getStyleClass().add("text-secondary");
            HBox box = new HBox(4, label, autoButton, valueLabel, slider);
            HBox.setHgrow(slider, Priority.ALWAYS);
            HBox.setHgrow(box, Priority.ALWAYS);
            return box;
        }
    
        void apply(CatalogControlsContentModel.SliderProjection projection) {
            if (projection == null) {
                return;
            }
            autoButton.setSelected(projection.auto());
            slider.setValue(projection.value());
            updateVisual();
        }
    
        private void configure(String title, boolean snapToTicks) {
            autoButton.getStyleClass().addAll(STYLE_COMPACT, "auto-dice-btn", STYLE_ACTIVE);
            autoButton.setAccessibleText(title + " automatisch bestimmen");
            autoButton.setSelected(true);
            autoButton.setOnAction(event -> {
                updateVisual();
                publishSnapshot.run();
            });
            slider.setAccessibleText(title + " Wert");
            slider.setShowTickLabels(true);
            slider.setShowTickMarks(true);
            slider.setSnapToTicks(snapToTicks);
            slider.setMajorTickUnit(1.0);
            slider.setMinorTickCount(0);
            slider.valueProperty().addListener((obs, oldValue, newValue) -> {
                updateVisual();
                publishSnapshot.run();
            });
            HBox.setHgrow(slider, Priority.ALWAYS);
            updateVisual();
        }
    
        private void updateVisual() {
            boolean auto = autoButton.isSelected();
            slider.setDisable(auto);
            autoButton.getStyleClass().remove(STYLE_ACTIVE);
            if (auto) {
                autoButton.getStyleClass().add(STYLE_ACTIVE);
            }
            valueLabel.setText(auto ? "" : String.valueOf((int) Math.round(slider.getValue())));
        }
    }

    private static final class CatalogControlsTuningControls {
    
        private final CatalogControlsTuningControl difficulty;
        private final CatalogControlsTuningControl balance;
        private final CatalogControlsTuningControl amount;
        private final CatalogControlsTuningControl diversity;
    
        CatalogControlsTuningControls(
                CatalogControlsTuningControl difficulty,
                CatalogControlsTuningControl balance,
                CatalogControlsTuningControl amount,
                CatalogControlsTuningControl diversity
        ) {
            this.difficulty = difficulty;
            this.balance = balance;
            this.amount = amount;
            this.diversity = diversity;
        }
    
        Node node() {
            return new HBox(8, difficulty.node(), balance.node(), amount.node(), diversity.node());
        }
    
        void apply(CatalogControlsContentModel.ControlsState controls) {
            difficulty.apply(controls.difficulty());
            balance.apply(controls.balance());
            amount.apply(controls.amount());
            diversity.apply(controls.diversity());
        }
    }

    private static final class CatalogControlsChallengeRatingControls {
    
        private final ComboBox<String> crMinimum;
        private final ComboBox<String> crMaximum;
        private final Runnable publishSnapshot;
    
        CatalogControlsChallengeRatingControls(
                ComboBox<String> crMinimum,
                ComboBox<String> crMaximum,
                Runnable publishSnapshot
        ) {
            this.crMinimum = crMinimum;
            this.crMaximum = crMaximum;
            this.publishSnapshot = publishSnapshot;
            configure();
        }
    
        Node minimumNode() {
            return crMinimum;
        }
    
        Node maximumNode() {
            return crMaximum;
        }
    
        void apply(List<String> values, String minimum, String maximum) {
            runWithoutActionHandlers(() -> {
                List<String> safeValues = values == null || values.isEmpty() ? List.of("0", "30") : List.copyOf(values);
                crMinimum.getItems().setAll(safeValues);
                crMaximum.getItems().setAll(safeValues);
                selectCrValue(crMinimum, minimum, true);
                selectCrValue(crMaximum, maximum, false);
                ensureOrder();
            });
        }
    
        void clear() {
            runWithoutActionHandlers(() -> {
                selectCrValue(crMinimum, "", true);
                selectCrValue(crMaximum, "", false);
            });
        }
    
        private void configure() {
            crMinimum.setAccessibleText("Minimaler CR");
            crMaximum.setAccessibleText("Maximaler CR");
            crMinimum.setOnAction(this::publishMinimumAction);
            crMaximum.setOnAction(this::publishMaximumAction);
        }

        private void runWithoutActionHandlers(Runnable action) {
            crMinimum.setOnAction(null);
            crMaximum.setOnAction(null);
            try {
                action.run();
            } finally {
                crMinimum.setOnAction(this::publishMinimumAction);
                crMaximum.setOnAction(this::publishMaximumAction);
            }
        }

        private void publishMinimumAction(ActionEvent event) {
            ensureOrder();
            publishSnapshot.run();
        }

        private void publishMaximumAction(ActionEvent event) {
            ensureOrder();
            publishSnapshot.run();
        }
    
        private void selectCrValue(ComboBox<String> comboBox, String value, boolean first) {
            if (value != null && !value.isBlank() && comboBox.getItems().contains(value)) {
                comboBox.getSelectionModel().select(value);
                return;
            }
            comboBox.getSelectionModel().select(first ? 0 : Math.max(comboBox.getItems().size() - 1, 0));
        }
    
        private void ensureOrder() {
            int minimumIndex = crMinimum.getSelectionModel().getSelectedIndex();
            int maximumIndex = crMaximum.getSelectionModel().getSelectedIndex();
            if (minimumIndex > maximumIndex && minimumIndex >= 0) {
                crMaximum.getSelectionModel().select(minimumIndex);
            }
        }
    }

    private static final class CatalogControlsChrome {
    
        static Node section(String title, Node content) {
            Label header = new Label(title);
            header.getStyleClass().addAll("section-header", "text-muted");
            return new VBox(0, header, content);
        }
    
        static Node padded(Node content) {
            return new VBox(content);
        }
    
        static Node surface(Node... children) {
            VBox surface = new VBox(children);
            surface.getStyleClass().add("surface-root");
            return surface;
        }
    
        static Node flow(double horizontalGap, double verticalGap, Node... children) {
            return new FlowPane(horizontalGap, verticalGap, children);
        }
    
        static Node separator() {
            Region region = new Region();
            region.getStyleClass().add("control-separator");
            return region;
        }
    
        static Node scroll(Node content) {
            ScrollPane scrollPane = new ScrollPane(content);
            scrollPane.setFitToWidth(true);
            scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            return scrollPane;
        }
    }

    private static final class CatalogControlsTextValues {
    
        static void applyOptionFilter(VBox options, @Nullable String query) {
            String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
            for (Node node : options.getChildren()) {
                CheckBox checkBox = (CheckBox) node;
                boolean visible = normalizedQuery.isEmpty()
                        || checkBox.getText().toLowerCase(Locale.ROOT).contains(normalizedQuery);
                checkBox.setVisible(visible);
                checkBox.setManaged(visible);
            }
        }
    }


}
