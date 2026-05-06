package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import javafx.animation.PauseTransition;
import javafx.collections.FXCollections;
import javafx.collections.ListChangeListener;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
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
import javafx.util.StringConverter;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class CatalogControlsView extends VBox {

    private static final String FILTER_SECTION_TITLE = "FILTER";
    private static final String ENCOUNTER_SECTION_TITLE = "ENCOUNTER";
    private static final String STYLE_SECTION_HEADER = "section-header";
    private static final String STYLE_TEXT_MUTED = "text-muted";

    private final CatalogContributionModel presentationModel;
    private final EncounterTablePicker encounterTablePicker = new EncounterTablePicker(this::publishSnapshot);
    private final FilterStripSection filterStrip = new FilterStripSection(encounterTablePicker, this::publishSnapshot);
    private final FilterChipsStrip chipsView = new FilterChipsStrip(this::clearChip);
    private final EncounterTuningSection tuningView = new EncounterTuningSection(this::publishSnapshot);

    private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    private int suppressedInputDepth;

    public CatalogControlsView(CatalogContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");

        setSpacing(0);
        setPadding(new Insets(0));

        VBox filterRegion = new VBox(filterStrip, chipsView);
        filterRegion.getStyleClass().add("surface-root");
        filterRegion.setPadding(new Insets(6, 8, 6, 8));

        VBox filterSection = new VBox(0, sectionHeader(FILTER_SECTION_TITLE), paddedSection(filterRegion));
        VBox encounterSection = new VBox(0, sectionHeader(ENCOUNTER_SECTION_TITLE), tuningView);
        getChildren().setAll(filterSection, controlSeparator(), encounterSection);
        setMaxHeight(Double.MAX_VALUE);

        bindModel();
    }

    void onViewInputEvent(Consumer<CatalogControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void bindModel() {
        runWithSuppressedInput(() -> {
            filterStrip.setFilterOptions(presentationModel.filterOptionsProperty().get());
            filterStrip.applyFilters(presentationModel.creatureFiltersProperty().get());
            applyDropdownStates();
            encounterTablePicker.setEncounterTables(presentationModel.encounterTableOptionsProperty());
            CatalogContributionModel.ControlsState controlsState = presentationModel.controlsStateProperty().get();
            encounterTablePicker.setSelectedEncounterTableIds(controlsState.encounterTableIds());
            encounterTablePicker.setPopupOpen(presentationModel.encounterTableDropdownStateProperty().get().open());
            tuningView.applyControlsState(controlsState);
            chipsView.setChips(presentationModel.chipsProperty());
        });

        presentationModel.filterOptionsProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> filterStrip.setFilterOptions(newValue)));
        presentationModel.creatureFiltersProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> filterStrip.applyFilters(newValue)));
        presentationModel.controlsStateProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> {
                    encounterTablePicker.setSelectedEncounterTableIds(newValue.encounterTableIds());
                    tuningView.applyControlsState(newValue);
                }));
        presentationModel.sizeDropdownStateProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> filterStrip.setSizeDropdownState(newValue)));
        presentationModel.typeDropdownStateProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> filterStrip.setTypeDropdownState(newValue)));
        presentationModel.subtypeDropdownStateProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> filterStrip.setSubtypeDropdownState(newValue)));
        presentationModel.biomeDropdownStateProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> filterStrip.setBiomeDropdownState(newValue)));
        presentationModel.alignmentDropdownStateProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> filterStrip.setAlignmentDropdownState(newValue)));
        presentationModel.encounterTableDropdownStateProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> encounterTablePicker.setPopupOpen(newValue.open())));
        presentationModel.encounterTableOptionsProperty().addListener(
                (ListChangeListener<CatalogContributionModel.EncounterTableOption>) change ->
                        runWithSuppressedInput(() ->
                                encounterTablePicker.setEncounterTables(presentationModel.encounterTableOptionsProperty())));
        presentationModel.chipsProperty().addListener(
                (ListChangeListener<CatalogContributionModel.FilterChip>) change ->
                        runWithSuppressedInput(() -> chipsView.setChips(presentationModel.chipsProperty())));
    }

    private void applyDropdownStates() {
        filterStrip.setSizeDropdownState(presentationModel.sizeDropdownStateProperty().get());
        filterStrip.setTypeDropdownState(presentationModel.typeDropdownStateProperty().get());
        filterStrip.setSubtypeDropdownState(presentationModel.subtypeDropdownStateProperty().get());
        filterStrip.setBiomeDropdownState(presentationModel.biomeDropdownStateProperty().get());
        filterStrip.setAlignmentDropdownState(presentationModel.alignmentDropdownStateProperty().get());
    }

    private void clearChip(String key) {
        if (filterStrip.clearFilterChip(key) || encounterTablePicker.clearEncounterTableChip(key)) {
            publishSnapshot();
        }
    }

    private void publishSnapshot() {
        if (inputSuppressed()) {
            return;
        }
        CatalogContributionModel.CreatureFilters filters = filterStrip.buildFilterState();
        CatalogContributionModel.FilterDropdownState sizeState = filterStrip.sizeDropdownState();
        CatalogContributionModel.FilterDropdownState typeState = filterStrip.typeDropdownState();
        CatalogContributionModel.FilterDropdownState subtypeState = filterStrip.subtypeDropdownState();
        CatalogContributionModel.FilterDropdownState biomeState = filterStrip.biomeDropdownState();
        CatalogContributionModel.FilterDropdownState alignmentState = filterStrip.alignmentDropdownState();

        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                filters.nameQuery(),
                filters.challengeRatingMin(),
                filters.challengeRatingMax(),
                filters.sizes(),
                filters.types(),
                filters.subtypes(),
                filters.biomes(),
                filters.alignments(),
                sizeState.open(),
                sizeState.searchQuery(),
                typeState.open(),
                typeState.searchQuery(),
                subtypeState.open(),
                subtypeState.searchQuery(),
                biomeState.open(),
                biomeState.searchQuery(),
                alignmentState.open(),
                alignmentState.searchQuery(),
                encounterTablePicker.popupOpen(),
                tuningView.difficultyAuto(),
                tuningView.difficultyValue(),
                tuningView.balanceAuto(),
                tuningView.balanceValue(),
                tuningView.amountAuto(),
                tuningView.amountValue(),
                tuningView.diversityAuto(),
                tuningView.diversityValue(),
                encounterTablePicker.selectedEncounterTableIds()));
    }

    private void runWithSuppressedInput(Runnable action) {
        suppressedInputDepth++;
        try {
            action.run();
        } finally {
            suppressedInputDepth--;
        }
    }

    private boolean inputSuppressed() {
        return suppressedInputDepth > 0;
    }

    private static Label sectionHeader(String text) {
        Label header = new Label(text);
        header.getStyleClass().addAll(STYLE_SECTION_HEADER, STYLE_TEXT_MUTED);
        return header;
    }

    private static VBox paddedSection(VBox content) {
        VBox wrapper = new VBox(content);
        wrapper.setPadding(new Insets(0, 4, 0, 4));
        return wrapper;
    }

    private static Region controlSeparator() {
        Region separator = new Region();
        separator.getStyleClass().add("control-separator");
        return separator;
    }

    private static final class FilterChipsStrip extends FlowPane {

        private static final String REMOVE_SYMBOL = "×";
        private static final String STYLE_CHIP = "chip";
        private static final String STYLE_FLAT = "flat";
        private static final String STYLE_COMPACT = "compact";
        private static final String STYLE_REMOVE_BUTTON = "chip-remove-btn";
        private static final String REMOVE_TEXT_PREFIX = "Entfernen: ";

        private final Consumer<String> removeChipAction;

        FilterChipsStrip(Consumer<String> removeChipAction) {
            super(4, 2);
            this.removeChipAction = removeChipAction;
            prefWrapLengthProperty().bind(widthProperty().subtract(16));
            setMinHeight(24);
        }

        void setChips(List<CatalogContributionModel.FilterChip> chips) {
            getChildren().clear();
            List<CatalogContributionModel.FilterChip> safeChips = chips == null ? List.of() : List.copyOf(chips);
            for (CatalogContributionModel.FilterChip chip : safeChips) {
                getChildren().add(chipNode(chip));
            }
        }

        private HBox chipNode(CatalogContributionModel.FilterChip chip) {
            HBox chipNode = new HBox(2);
            chipNode.getStyleClass().addAll(STYLE_CHIP, chip.styleClass());

            Label label = new Label(chip.label());
            Button remove = new Button(REMOVE_SYMBOL);
            remove.getStyleClass().addAll(STYLE_FLAT, STYLE_COMPACT, STYLE_REMOVE_BUTTON);
            remove.setAccessibleText(REMOVE_TEXT_PREFIX + chip.label());
            remove.setOnAction(event -> removeChipAction.accept(chip.key()));

            chipNode.getChildren().addAll(label, remove);
            return chipNode;
        }
    }

    private static final class EncounterTablePicker extends Button {

        private static final String DEFAULT_TRIGGER_TEXT = "Tabelle ▾";
        private static final String EMPTY_LABEL = "Keine Encounter-Tabellen gefunden";
        private static final String CLEAR_ALL_LABEL = "(Alle Monster)";
        private static final String MULTI_TABLE_LABEL_PREFIX = "Tabellen (";
        private static final String MULTI_TABLE_LABEL_SUFFIX = ") ▾";
        private static final String LOOT_CONFLICT_SUFFIX = ", Loot-Konflikt) ▾";
        private static final String SELECTED_SUFFIX = " ▾";
        private static final String STYLE_COMPACT = "compact";
        private static final String STYLE_TRIGGER = "filter-trigger";
        private static final String STYLE_ACTIVE = "filter-trigger-active";
        private static final String STYLE_DROPDOWN = "filter-dropdown";
        private static final String STYLE_SECONDARY_TEXT = "text-secondary";
        private static final String STYLE_FLAT = "flat";
        private static final String CHIP_PREFIX = "encounter-table:";
        private static final String DEFAULT_TOOLTIP = "Mehrere Encounter-Tabellen können kombiniert werden.";
        private static final String LOOT_CONFLICT_TOOLTIP =
                "Mehrere ausgewählte Tabellen verweisen auf unterschiedliche Loot-Tabellen. "
                        + "Kampfstart bleibt blockiert, bis höchstens eine verknüpfte Loot-Tabelle aktiv ist.";

        private final Runnable onInteraction;
        private final Tooltip tableTooltip = new Tooltip(DEFAULT_TOOLTIP);
        private final AnchoredPopupView popup = new AnchoredPopupView();
        private final VBox popupContent = new VBox(2);
        private final Map<Long, CheckBox> checkboxesByTableId = new LinkedHashMap<>();

        private List<CatalogContributionModel.EncounterTableOption> encounterTables = List.of();
        private List<Long> selectedEncounterTableIds = List.of();

        EncounterTablePicker(Runnable onInteraction) {
            this.onInteraction = onInteraction;
            getStyleClass().addAll(STYLE_COMPACT, STYLE_TRIGGER);
            setTooltip(tableTooltip);
            setOnAction(event -> togglePopup());
            popupContent.getStyleClass().add(STYLE_DROPDOWN);
            popupContent.setPadding(new Insets(8));
            popup.setContent(popupContent);
            updateTriggerState();
        }

        void setEncounterTables(List<CatalogContributionModel.EncounterTableOption> tables) {
            encounterTables = tables == null ? List.of() : List.copyOf(tables);
            selectedEncounterTableIds = availableEncounterTableIds(selectedEncounterTableIds);
            updateTriggerState();
            refreshOpenPopup();
        }

        void setSelectedEncounterTableIds(List<Long> tableIds) {
            selectedEncounterTableIds = availableEncounterTableIds(tableIds);
            updateTriggerState();
            refreshOpenPopup();
        }

        void setPopupOpen(boolean open) {
            if (open == popup.isShowing()) {
                return;
            }
            if (open) {
                renderPopup();
                popup.showBelow(this);
                return;
            }
            popup.hide();
        }

        boolean popupOpen() {
            return popup.isShowing();
        }

        boolean clearEncounterTableChip(String key) {
            if (!key.startsWith(CHIP_PREFIX)) {
                return false;
            }
            Long tableId = parseTableId(key.substring(CHIP_PREFIX.length()));
            if (tableId == null || !selectedEncounterTableIds.contains(tableId)) {
                return false;
            }
            selectWithoutPublishing(tableId, false);
            return true;
        }

        List<Long> selectedEncounterTableIds() {
            return List.copyOf(selectedEncounterTableIds);
        }

        private void togglePopup() {
            if (popup.isShowing()) {
                popup.hide();
            } else {
                renderPopup();
                popup.showBelow(this);
            }
            onInteraction.run();
        }

        private void refreshOpenPopup() {
            if (popup.isShowing()) {
                renderPopup();
            }
        }

        private void renderPopup() {
            popupContent.getChildren().clear();
            checkboxesByTableId.clear();
            popupContent.getChildren().add(clearAllButton());
            if (encounterTables.isEmpty()) {
                popupContent.getChildren().add(emptyStateLabel());
                return;
            }
            for (CatalogContributionModel.EncounterTableOption table : encounterTables) {
                popupContent.getChildren().add(tableCheckbox(table));
            }
        }

        private Button clearAllButton() {
            Button clearAll = new Button(CLEAR_ALL_LABEL);
            clearAll.setMaxWidth(Double.MAX_VALUE);
            clearAll.getStyleClass().addAll(STYLE_FLAT, STYLE_COMPACT);
            clearAll.setOnAction(event -> {
                selectedEncounterTableIds = List.of();
                updateTriggerState();
                renderPopup();
                onInteraction.run();
            });
            return clearAll;
        }

        private Label emptyStateLabel() {
            Label empty = new Label(EMPTY_LABEL);
            empty.getStyleClass().add(STYLE_SECONDARY_TEXT);
            return empty;
        }

        private CheckBox tableCheckbox(CatalogContributionModel.EncounterTableOption table) {
            CheckBox checkbox = new CheckBox(table.name());
            checkbox.setMaxWidth(Double.MAX_VALUE);
            checkbox.setSelected(selectedEncounterTableIds.contains(table.tableId()));
            checkbox.setOnAction(event -> updateSelection(table.tableId(), checkbox.isSelected()));
            checkboxesByTableId.put(table.tableId(), checkbox);
            return checkbox;
        }

        private void updateSelection(long tableId, boolean selected) {
            selectWithoutPublishing(tableId, selected);
            onInteraction.run();
        }

        private void selectWithoutPublishing(long tableId, boolean selected) {
            LinkedHashSet<Long> tableIds = new LinkedHashSet<>(selectedEncounterTableIds);
            if (selected) {
                tableIds.add(tableId);
            } else {
                tableIds.remove(tableId);
            }
            selectedEncounterTableIds = List.copyOf(tableIds);
            syncRenderedCheckbox(tableId, selected);
            updateTriggerState();
        }

        private void syncRenderedCheckbox(long tableId, boolean selected) {
            CheckBox checkbox = checkboxesByTableId.get(tableId);
            if (checkbox != null) {
                checkbox.setSelected(selected);
            }
        }

        private void updateTriggerState() {
            getStyleClass().remove(STYLE_ACTIVE);
            boolean lootConflict = hasLinkedLootConflict();
            List<CatalogContributionModel.EncounterTableOption> selectedTables = selectedEncounterTables();
            setText(triggerLabel(selectedTables, lootConflict));
            if (!selectedTables.isEmpty()) {
                getStyleClass().add(STYLE_ACTIVE);
            }
            tableTooltip.setText(lootConflict ? LOOT_CONFLICT_TOOLTIP : DEFAULT_TOOLTIP);
        }

        private String triggerLabel(List<CatalogContributionModel.EncounterTableOption> selectedTables, boolean lootConflict) {
            int selectedCount = selectedTables.size();
            if (selectedCount == 0) {
                return DEFAULT_TRIGGER_TEXT;
            }
            if (selectedCount == 1) {
                return selectedTables.get(0).name() + SELECTED_SUFFIX;
            }
            if (lootConflict) {
                return MULTI_TABLE_LABEL_PREFIX + selectedCount + LOOT_CONFLICT_SUFFIX;
            }
            return MULTI_TABLE_LABEL_PREFIX + selectedCount + MULTI_TABLE_LABEL_SUFFIX;
        }

        private List<CatalogContributionModel.EncounterTableOption> selectedEncounterTables() {
            if (selectedEncounterTableIds.isEmpty()) {
                return List.of();
            }
            Set<Long> selectedIds = new LinkedHashSet<>(selectedEncounterTableIds);
            return encounterTables.stream()
                    .filter(table -> selectedIds.contains(table.tableId()))
                    .toList();
        }

        private List<Long> availableEncounterTableIds(List<Long> tableIds) {
            if (tableIds == null || tableIds.isEmpty()) {
                return List.of();
            }
            Set<Long> availableIds = encounterTables.stream()
                    .map(CatalogContributionModel.EncounterTableOption::tableId)
                    .collect(LinkedHashSet::new, Set::add, Set::addAll);
            return tableIds.stream()
                    .filter(Objects::nonNull)
                    .filter(availableIds::contains)
                    .distinct()
                    .toList();
        }

        private boolean hasLinkedLootConflict() {
            long distinctLinkedLootTables = selectedEncounterTables().stream()
                    .map(CatalogContributionModel.EncounterTableOption::linkedLootTableId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .count();
            return distinctLinkedLootTables > 1;
        }

        private static @Nullable Long parseTableId(String text) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
    }

    private static final class EncounterTuningSection extends VBox {

        private static final double DEFAULT_DIFFICULTY_SLIDER_VALUE = 2.0;
        private static final double DEFAULT_BALANCE_SLIDER_VALUE = 3.0;
        private static final double DEFAULT_AMOUNT_SLIDER_VALUE = 3.0;
        private static final double DEFAULT_DIVERSITY_SLIDER_VALUE = 3.0;
        private static final double MIN_ENDPOINT_VALUE = 1.0;
        private static final double MAX_DIVERSITY_ENDPOINT_VALUE = 4.0;
        private static final double MAX_BALANCE_ENDPOINT_VALUE = 5.0;
        private static final String STYLE_TEXT_MUTED = "text-muted";
        private static final String STYLE_TEXT_SECONDARY = "text-secondary";
        private static final String STYLE_COMPACT = "compact";
        private static final String STYLE_ACTIVE = "active";
        private static final String DIFFICULTY_SLIDER_STYLE = "difficulty-slider";
        private static final String MAX_DIVERSITY_LABEL = "4";

        private final TuningControl difficultyControl;
        private final TuningControl balanceControl;
        private final TuningControl amountControl;
        private final TuningControl diversityControl;

        EncounterTuningSection(Runnable onInteraction) {
            difficultyControl = new TuningControl(
                    "Schwierigkeit",
                    1.0,
                    4.0,
                    DEFAULT_DIFFICULTY_SLIDER_VALUE,
                    true,
                    "Schwierigkeitsbereich des Encounters",
                    new DifficultyTickLabelFormatter(),
                    1.0,
                    onInteraction);
            balanceControl = new TuningControl(
                    "Balance",
                    1.0,
                    5.0,
                    DEFAULT_BALANCE_SLIDER_VALUE,
                    true,
                    "1: CR-Extreme bevorzugen, 5: CR-Durchschnitt bevorzugen",
                    new EndpointTickLabelFormatter("Extreme", "Durchschnitt"),
                    null,
                    onInteraction);
            amountControl = new TuningControl(
                    "Menge",
                    1.0,
                    5.0,
                    DEFAULT_AMOUNT_SLIDER_VALUE,
                    false,
                    "1: Bosse bevorzugen, 5: Minions bevorzugen",
                    new EndpointTickLabelFormatter("Boss", "Minions"),
                    1.0,
                    onInteraction);
            diversityControl = new TuningControl(
                    "Diversität",
                    1.0,
                    4.0,
                    DEFAULT_DIVERSITY_SLIDER_VALUE,
                    true,
                    "1: ein Statblock, 4: vier unterschiedliche Statblocks",
                    new EndpointTickLabelFormatter("1", MAX_DIVERSITY_LABEL),
                    null,
                    onInteraction);

            difficultyControl.addSliderStyleClass(DIFFICULTY_SLIDER_STYLE);

            HBox controlRow = new HBox(8, difficultyControl, balanceControl, amountControl, diversityControl);
            HBox.setHgrow(difficultyControl, Priority.ALWAYS);
            HBox.setHgrow(balanceControl, Priority.ALWAYS);
            HBox.setHgrow(amountControl, Priority.ALWAYS);
            HBox.setHgrow(diversityControl, Priority.ALWAYS);

            setMaxWidth(Double.MAX_VALUE);
            setPadding(new Insets(0, 4, 0, 4));
            getChildren().add(controlRow);
        }

        void applyControlsState(CatalogContributionModel.ControlsState state) {
            CatalogContributionModel.ControlsState safeState =
                    state == null ? CatalogContributionModel.ControlsState.empty() : state;
            difficultyControl.applyProjection(safeState.difficulty());
            balanceControl.applyProjection(safeState.balance());
            amountControl.applyProjection(safeState.amount());
            diversityControl.applyProjection(safeState.diversity());
        }

        boolean difficultyAuto() {
            return difficultyControl.isAuto();
        }

        double difficultyValue() {
            return difficultyControl.rawValue();
        }

        boolean balanceAuto() {
            return balanceControl.isAuto();
        }

        double balanceValue() {
            return balanceControl.rawValue();
        }

        boolean amountAuto() {
            return amountControl.isAuto();
        }

        double amountValue() {
            return amountControl.rawValue();
        }

        boolean diversityAuto() {
            return diversityControl.isAuto();
        }

        double diversityValue() {
            return diversityControl.rawValue();
        }

        private static String difficultyTickLabel(int value) {
            return switch (Math.max(1, Math.min(4, value))) {
                case 1 -> "Easy";
                case 3 -> "Hard";
                case 4 -> "Deadly";
                default -> "Medium";
            };
        }

        private static final class TuningControl extends HBox {

            private final Map<Integer, String> previewLabels = new LinkedHashMap<>();
            private final Slider slider;
            private final Button autoButton;
            private final Label valueLabel;
            private final Runnable onInteraction;
            private boolean autoMode = true;
            private int internalUpdateDepth;

            TuningControl(
                    String title,
                    double min,
                    double max,
                    double defaultValue,
                    boolean snapToTicks,
                    String tooltip,
                    StringConverter<Double> labelFormatter,
                    @Nullable Double majorTickUnitOverride,
                    Runnable onInteraction
            ) {
                setSpacing(4);
                setAlignment(Pos.CENTER_LEFT);
                this.onInteraction = onInteraction;

                Label titleLabel = new Label(title);
                titleLabel.getStyleClass().add(STYLE_TEXT_MUTED);
                titleLabel.setMinWidth(Region.USE_PREF_SIZE);

                autoButton = new Button("⚅");
                autoButton.getStyleClass().addAll(STYLE_COMPACT, "auto-dice-btn", STYLE_ACTIVE);
                autoButton.setMinWidth(Region.USE_PREF_SIZE);
                autoButton.setAccessibleText(title + " automatisch bestimmen");

                valueLabel = new Label();
                valueLabel.getStyleClass().add(STYLE_TEXT_SECONDARY);
                valueLabel.setMinWidth(56);
                valueLabel.setPrefWidth(56);

                slider = new Slider(min, max, defaultValue);
                slider.setShowTickLabels(true);
                slider.setShowTickMarks(true);
                configureSliderTicks(snapToTicks, majorTickUnitOverride, max, min);
                if (labelFormatter != null) {
                    slider.setLabelFormatter(labelFormatter);
                }
                slider.setDisable(true);
                slider.setAccessibleRoleDescription(title);
                slider.setAccessibleText(tooltip);
                HBox.setHgrow(slider, Priority.ALWAYS);

                autoButton.setOnAction(event -> toggleAutoMode());
                slider.valueProperty().addListener((obs, oldValue, newValue) -> {
                    updateValueLabel();
                    fireChangedIfInteractive();
                });
                updateAutoButtonState();
                updateValueLabel();

                getChildren().addAll(titleLabel, autoButton, valueLabel, slider);
            }

            boolean isAuto() {
                return autoMode;
            }

            double rawValue() {
                return slider.getValue();
            }

            void applyProjection(CatalogContributionModel.SliderProjection projection) {
                CatalogContributionModel.SliderProjection safeProjection = projection == null
                        ? new CatalogContributionModel.SliderProjection(true, slider.getValue(), List.of())
                        : projection;
                runInternalUpdate(() -> {
                    replacePreviewLabels(safeProjection.labels());
                    autoMode = safeProjection.auto();
                    slider.setValue(safeProjection.value());
                    slider.setDisable(autoMode);
                    updateAutoButtonState();
                    updateValueLabel();
                });
            }

            void addSliderStyleClass(String styleClass) {
                if (styleClass != null && !styleClass.isBlank() && !slider.getStyleClass().contains(styleClass)) {
                    slider.getStyleClass().add(styleClass);
                }
            }

            private void configureSliderTicks(
                    boolean snapToTicks,
                    @Nullable Double majorTickUnitOverride,
                    double max,
                    double min
            ) {
                if (snapToTicks) {
                    slider.setSnapToTicks(true);
                    slider.setMajorTickUnit(1);
                    slider.setMinorTickCount(0);
                    return;
                }
                slider.setMajorTickUnit(majorTickUnitOverride != null ? majorTickUnitOverride : (max - min) / 3);
            }

            private void toggleAutoMode() {
                autoMode = !autoMode;
                slider.setDisable(autoMode);
                updateAutoButtonState();
                updateValueLabel();
                fireChangedIfInteractive();
            }

            private void updateValueLabel() {
                if (autoMode) {
                    valueLabel.setText("");
                    return;
                }
                String label = previewLabels.get((int) Math.round(slider.getValue()));
                valueLabel.setText(label == null ? "" : label);
            }

            private void updateAutoButtonState() {
                autoButton.getStyleClass().remove(STYLE_ACTIVE);
                if (autoMode) {
                    autoButton.getStyleClass().add(STYLE_ACTIVE);
                }
            }

            private void fireChangedIfInteractive() {
                if (!isInternalUpdate() && onInteraction != null) {
                    onInteraction.run();
                }
            }

            private void runInternalUpdate(Runnable action) {
                internalUpdateDepth++;
                try {
                    action.run();
                } finally {
                    internalUpdateDepth--;
                }
            }

            private boolean isInternalUpdate() {
                return internalUpdateDepth > 0;
            }

            private void replacePreviewLabels(List<CatalogContributionModel.PreviewLabel> labels) {
                previewLabels.clear();
                if (labels == null) {
                    return;
                }
                for (CatalogContributionModel.PreviewLabel label : labels) {
                    if (label == null || label.label().isBlank()) {
                        continue;
                    }
                    previewLabels.put((int) Math.round(label.value()), label.label());
                }
            }
        }

        private static final class DifficultyTickLabelFormatter extends StringConverter<Double> {
            @Override
            public String toString(Double value) {
                return difficultyTickLabel(value == null ? 2 : (int) Math.round(value));
            }

            @Override
            public Double fromString(String value) {
                return 0.0;
            }
        }

        private static final class EndpointTickLabelFormatter extends StringConverter<Double> {

            private final String minimumLabel;
            private final String maximumLabel;

            EndpointTickLabelFormatter(String minimumLabel, String maximumLabel) {
                this.minimumLabel = minimumLabel;
                this.maximumLabel = maximumLabel;
            }

            @Override
            public String toString(Double value) {
                if (value == null) {
                    return "";
                }
                if (value <= MIN_ENDPOINT_VALUE) {
                    return minimumLabel;
                }
                if (MAX_DIVERSITY_LABEL.equals(maximumLabel) && value >= MAX_DIVERSITY_ENDPOINT_VALUE) {
                    return maximumLabel;
                }
                if (value >= MAX_BALANCE_ENDPOINT_VALUE) {
                    return maximumLabel;
                }
                return "";
            }

            @Override
            public Double fromString(String value) {
                return 0.0;
            }
        }
    }

    private static final class FilterStripSection extends VBox {

        private static final String STYLE_COMPACT = "compact";
        private static final String STYLE_TEXT_MUTED = "text-muted";
        private static final String STYLE_BOLD = "bold";
        private static final String SEARCH_PROMPT = "Monster suchen...";
        private static final String CLEAR_LABEL = "Leeren";
        private static final String CR_LABEL = "CR";
        private static final String CR_MIN_ACCESSIBLE = "Minimaler CR";
        private static final String CR_MAX_ACCESSIBLE = "Maximaler CR";
        private static final String DEFAULT_CHALLENGE_RATING_MIN = "0";
        private static final String DEFAULT_CHALLENGE_RATING_MAX = "30";
        private static final String SEARCH_KEY = "search";
        private static final String CHALLENGE_RATING_KEY = "cr";
        private static final String SIZE_PREFIX = "size:";
        private static final String TYPE_PREFIX = "type:";
        private static final String SUBTYPE_PREFIX = "subtype:";
        private static final String BIOME_PREFIX = "biome:";
        private static final String ALIGNMENT_PREFIX = "alignment:";

        private final Runnable onInteraction;
        private final PauseTransition debounce = new PauseTransition(Duration.millis(300));
        private final TextField searchField = new TextField();
        private final CrRangeSelector crRange = new CrRangeSelector(this::emitInteraction);
        private final SearchableFilterButton sizeFilter = new SearchableFilterButton("Größe", this::emitInteraction);
        private final SearchableFilterButton typeFilter = new SearchableFilterButton("Typ", this::emitInteraction);
        private final SearchableFilterButton subtypeFilter = new SearchableFilterButton("Unterart", this::emitInteraction);
        private final SearchableFilterButton biomeFilter = new SearchableFilterButton("Umgebung", this::emitInteraction);
        private final SearchableFilterButton alignmentFilter = new SearchableFilterButton("Gesinnung", this::emitInteraction);

        FilterStripSection(EncounterTablePicker additionalFilterControl, Runnable onInteraction) {
            this.onInteraction = onInteraction;
            setSpacing(4);

            searchField.setPromptText(SEARCH_PROMPT);
            searchField.setMaxWidth(Double.MAX_VALUE);
            debounce.setOnFinished(event -> emitInteraction());
            searchField.textProperty().addListener((obs, oldValue, newValue) -> debounce.playFromStart());

            HBox searchRow = new HBox(6, searchField);
            HBox.setHgrow(searchField, Priority.ALWAYS);

            Button clearButton = new Button(CLEAR_LABEL);
            clearButton.getStyleClass().addAll(STYLE_COMPACT, "flat");
            clearButton.setOnAction(event -> {
                clearAllFilters();
                emitInteraction();
            });

            FlowPane filterRow = new FlowPane(4, 4);
            filterRow.getChildren().addAll(
                    crRange,
                    sizeFilter,
                    typeFilter,
                    subtypeFilter,
                    biomeFilter,
                    alignmentFilter,
                    additionalFilterControl,
                    clearButton);
            filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));

            getChildren().addAll(searchRow, filterRow);
        }

        void setFilterOptions(CatalogContributionModel.FilterOptionsProjection options) {
            CatalogContributionModel.FilterOptionsProjection safeOptions =
                    options == null ? CatalogContributionModel.FilterOptionsProjection.empty() : options;
            crRange.setValues(safeOptions.challengeRatings());
            sizeFilter.setOptions(safeOptions.sizes());
            typeFilter.setOptions(safeOptions.types());
            subtypeFilter.setOptions(safeOptions.subtypes());
            biomeFilter.setOptions(safeOptions.biomes());
            alignmentFilter.setOptions(safeOptions.alignments());
        }

        void applyFilters(CatalogContributionModel.CreatureFilters filters) {
            CatalogContributionModel.CreatureFilters safeFilters =
                    filters == null ? CatalogContributionModel.CreatureFilters.empty() : filters;
            searchField.setText(safeFilters.nameQuery());
            crRange.setSelection(safeFilters.challengeRatingMin(), safeFilters.challengeRatingMax());
            sizeFilter.setSelectedValues(safeFilters.sizes());
            typeFilter.setSelectedValues(safeFilters.types());
            subtypeFilter.setSelectedValues(safeFilters.subtypes());
            biomeFilter.setSelectedValues(safeFilters.biomes());
            alignmentFilter.setSelectedValues(safeFilters.alignments());
        }

        void setSizeDropdownState(CatalogContributionModel.FilterDropdownState state) {
            sizeFilter.setDropdownState(state);
        }

        void setTypeDropdownState(CatalogContributionModel.FilterDropdownState state) {
            typeFilter.setDropdownState(state);
        }

        void setSubtypeDropdownState(CatalogContributionModel.FilterDropdownState state) {
            subtypeFilter.setDropdownState(state);
        }

        void setBiomeDropdownState(CatalogContributionModel.FilterDropdownState state) {
            biomeFilter.setDropdownState(state);
        }

        void setAlignmentDropdownState(CatalogContributionModel.FilterDropdownState state) {
            alignmentFilter.setDropdownState(state);
        }

        CatalogContributionModel.CreatureFilters buildFilterState() {
            return new CatalogContributionModel.CreatureFilters(
                    normalized(searchField.getText()),
                    crRange.minimumFilterValue(),
                    crRange.maximumFilterValue(),
                    sizeFilter.selectedValues(),
                    typeFilter.selectedValues(),
                    subtypeFilter.selectedValues(),
                    biomeFilter.selectedValues(),
                    alignmentFilter.selectedValues());
        }

        CatalogContributionModel.FilterDropdownState sizeDropdownState() {
            return sizeFilter.dropdownState();
        }

        CatalogContributionModel.FilterDropdownState typeDropdownState() {
            return typeFilter.dropdownState();
        }

        CatalogContributionModel.FilterDropdownState subtypeDropdownState() {
            return subtypeFilter.dropdownState();
        }

        CatalogContributionModel.FilterDropdownState biomeDropdownState() {
            return biomeFilter.dropdownState();
        }

        CatalogContributionModel.FilterDropdownState alignmentDropdownState() {
            return alignmentFilter.dropdownState();
        }

        boolean clearFilterChip(String key) {
            if (SEARCH_KEY.equals(key)) {
                searchField.setText("");
                return true;
            }
            if (CHALLENGE_RATING_KEY.equals(key)) {
                crRange.reset();
                return true;
            }
            if (clearSelectorChip(sizeFilter, key, SIZE_PREFIX)) {
                return true;
            }
            if (clearSelectorChip(typeFilter, key, TYPE_PREFIX)) {
                return true;
            }
            if (clearSelectorChip(subtypeFilter, key, SUBTYPE_PREFIX)) {
                return true;
            }
            if (clearSelectorChip(biomeFilter, key, BIOME_PREFIX)) {
                return true;
            }
            return clearSelectorChip(alignmentFilter, key, ALIGNMENT_PREFIX);
        }

        private boolean clearSelectorChip(SearchableFilterButton filter, String key, String prefix) {
            if (!key.startsWith(prefix)) {
                return false;
            }
            filter.removeValue(valuePart(key));
            return true;
        }

        private void clearAllFilters() {
            searchField.setText("");
            crRange.reset();
            sizeFilter.clearSelection();
            typeFilter.clearSelection();
            subtypeFilter.clearSelection();
            biomeFilter.clearSelection();
            alignmentFilter.clearSelection();
        }

        private void emitInteraction() {
            if (onInteraction != null) {
                onInteraction.run();
            }
        }

        private static String valuePart(String key) {
            int separator = key.indexOf(':');
            return separator < 0 ? key : key.substring(separator + 1);
        }

        private static String normalized(@Nullable String value) {
            if (value == null) {
                return "";
            }
            String trimmed = value.trim();
            return trimmed.isEmpty() ? "" : trimmed;
        }

        private static final class CrRangeSelector extends HBox {

            private final ComboBox<String> minimum = new ComboBox<>();
            private final ComboBox<String> maximum = new ComboBox<>();
            private final Runnable onInteraction;
            private int internalUpdateDepth;

            CrRangeSelector(Runnable onInteraction) {
                this.onInteraction = onInteraction;
                setSpacing(2);

                Label crLabel = new Label(CR_LABEL);
                crLabel.getStyleClass().addAll(STYLE_TEXT_MUTED, STYLE_BOLD);
                crLabel.setMinWidth(20);

                minimum.setAccessibleText(CR_MIN_ACCESSIBLE);
                maximum.setAccessibleText(CR_MAX_ACCESSIBLE);
                minimum.setPrefWidth(65);
                maximum.setPrefWidth(65);

                Label dash = new Label("-");
                dash.getStyleClass().add(STYLE_TEXT_MUTED);

                minimum.setOnAction(event -> onSelectionChanged());
                maximum.setOnAction(event -> onSelectionChanged());
                getChildren().addAll(crLabel, minimum, dash, maximum);
            }

            void setValues(List<String> values) {
                List<String> safeValues = values == null || values.isEmpty()
                        ? List.of(DEFAULT_CHALLENGE_RATING_MIN, DEFAULT_CHALLENGE_RATING_MAX)
                        : List.copyOf(values);
                runInternalUpdate(() -> {
                    minimum.setItems(FXCollections.observableArrayList(safeValues));
                    maximum.setItems(FXCollections.observableArrayList(safeValues));
                    minimum.getSelectionModel().selectFirst();
                    maximum.getSelectionModel().selectLast();
                });
            }

            void setSelection(String minimumValue, String maximumValue) {
                runInternalUpdate(() -> {
                    selectOrFallback(minimum, minimumValue, true);
                    selectOrFallback(maximum, maximumValue, false);
                    enforceRangeOrder();
                });
            }

            String minimumFilterValue() {
                int index = minimum.getSelectionModel().getSelectedIndex();
                return index > 0 ? valueOrEmpty(minimum) : "";
            }

            String maximumFilterValue() {
                int index = maximum.getSelectionModel().getSelectedIndex();
                int lastIndex = maximum.getItems().size() - 1;
                return index >= 0 && index < lastIndex ? valueOrEmpty(maximum) : "";
            }

            void reset() {
                runInternalUpdate(() -> {
                    minimum.getSelectionModel().selectFirst();
                    maximum.getSelectionModel().selectLast();
                });
            }

            private void selectOrFallback(ComboBox<String> comboBox, String value, boolean first) {
                if (value == null || value.isBlank()) {
                    if (first) {
                        comboBox.getSelectionModel().selectFirst();
                    } else {
                        comboBox.getSelectionModel().selectLast();
                    }
                    return;
                }
                int index = comboBox.getItems().indexOf(value);
                if (index >= 0) {
                    comboBox.getSelectionModel().select(index);
                    return;
                }
                if (first) {
                    comboBox.getSelectionModel().selectFirst();
                } else {
                    comboBox.getSelectionModel().selectLast();
                }
            }

            private void onSelectionChanged() {
                if (isInternalUpdate()) {
                    return;
                }
                enforceRangeOrder();
                if (onInteraction != null) {
                    onInteraction.run();
                }
            }

            private void enforceRangeOrder() {
                int minimumIndex = minimum.getSelectionModel().getSelectedIndex();
                int maximumIndex = maximum.getSelectionModel().getSelectedIndex();
                if (minimumIndex > maximumIndex && minimumIndex >= 0) {
                    maximum.getSelectionModel().select(minimumIndex);
                }
            }

            private void runInternalUpdate(Runnable action) {
                internalUpdateDepth++;
                try {
                    action.run();
                } finally {
                    internalUpdateDepth--;
                }
            }

            private boolean isInternalUpdate() {
                return internalUpdateDepth > 0;
            }

            private String valueOrEmpty(ComboBox<String> comboBox) {
                String value = comboBox.getValue();
                return value == null ? "" : value;
            }
        }

        private static final class SearchableFilterButton extends Button {

            private static final String STYLE_DROPDOWN = "filter-dropdown";
            private static final String STYLE_TRIGGER = "filter-trigger";
            private static final String STYLE_ACTIVE = "filter-trigger-active";
            private static final String STYLE_COMPACT = "compact";
            private static final String STYLE_TEXT_FIELD = "text-field";
            private static final int SEARCH_FIELD_THRESHOLD = 6;

            private final String label;
            private final AnchoredPopupView popup = new AnchoredPopupView();
            private final VBox popupContent = new VBox(4);
            private final VBox checkboxList = new VBox(2);
            private final List<CheckBox> checkboxes = new ArrayList<>();
            private final Runnable onInteraction;
            private final Set<String> selectedValues = new LinkedHashSet<>();
            private final TextField searchField = new TextField();

            private List<String> options = List.of();
            private int internalUpdateDepth;

            SearchableFilterButton(String label, Runnable onInteraction) {
                this.label = label;
                this.onInteraction = onInteraction;
                getStyleClass().addAll(STYLE_COMPACT, STYLE_TRIGGER);
                setText(label + " ▾");
                setAccessibleText(label + " geschlossen");
                setOnAction(event -> togglePopup());

                popupContent.getStyleClass().add(STYLE_DROPDOWN);
                popupContent.setPadding(new Insets(8));
                popup.setContent(popupContent);

                searchField.setPromptText(label + " suchen...");
                searchField.getStyleClass().add(STYLE_TEXT_FIELD);
                searchField.textProperty().addListener((obs, oldValue, newValue) -> {
                    filterCheckboxes(newValue);
                    fireInteractionIfInteractive();
                });
            }

            void setOptions(List<String> options) {
                this.options = options == null ? List.of() : List.copyOf(options);
                selectedValues.retainAll(this.options);
                rebuildPopup();
                updateTriggerText();
            }

            void setSelectedValues(List<String> values) {
                selectedValues.clear();
                if (values != null) {
                    selectedValues.addAll(values);
                }
                syncCheckboxSelection();
                updateTriggerText();
            }

            void setDropdownState(CatalogContributionModel.FilterDropdownState state) {
                CatalogContributionModel.FilterDropdownState safeState =
                        state == null ? CatalogContributionModel.FilterDropdownState.closed() : state;
                runInternalUpdate(() -> {
                    searchField.setText(safeState.searchQuery());
                    filterCheckboxes(safeState.searchQuery());
                    if (safeState.open()) {
                        if (!popup.isShowing()) {
                            popup.showBelow(this);
                        }
                    } else if (popup.isShowing()) {
                        popup.hide();
                    }
                    updateAccessibleText();
                });
            }

            List<String> selectedValues() {
                return List.copyOf(selectedValues);
            }

            CatalogContributionModel.FilterDropdownState dropdownState() {
                return new CatalogContributionModel.FilterDropdownState(popup.isShowing(), searchField.getText());
            }

            void removeValue(String value) {
                if (selectedValues.remove(value)) {
                    syncCheckboxSelection();
                    updateTriggerText();
                }
            }

            void clearSelection() {
                if (!selectedValues.isEmpty()) {
                    selectedValues.clear();
                    syncCheckboxSelection();
                }
                updateTriggerText();
            }

            private void rebuildPopup() {
                popupContent.getChildren().clear();
                checkboxes.clear();
                checkboxList.getChildren().clear();

                if (options.size() > SEARCH_FIELD_THRESHOLD) {
                    popupContent.getChildren().add(searchField);
                } else {
                    searchField.setText("");
                }

                for (String option : options) {
                    CheckBox checkbox = new CheckBox(option);
                    checkbox.setSelected(selectedValues.contains(option));
                    checkbox.selectedProperty().addListener((obs, wasSelected, isSelected) ->
                            updateSelection(option, isSelected));
                    checkboxes.add(checkbox);
                    checkboxList.getChildren().add(checkbox);
                }

                ScrollPane scroll = new ScrollPane(checkboxList);
                scroll.setFitToWidth(true);
                scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
                scroll.setMaxHeight(280);
                scroll.setPrefWidth(200);
                scroll.setMinWidth(160);
                popupContent.getChildren().add(scroll);
                filterCheckboxes(searchField.getText());
            }

            private void togglePopup() {
                if (popup.isShowing()) {
                    popup.hide();
                } else {
                    popup.showBelow(this);
                }
                updateAccessibleText();
                fireInteractionIfInteractive();
            }

            private void updateSelection(String value, boolean selected) {
                if (isInternalUpdate()) {
                    return;
                }
                if (selected) {
                    selectedValues.add(value);
                } else {
                    selectedValues.remove(value);
                }
                updateTriggerText();
                fireInteractionIfInteractive();
            }

            private void syncCheckboxSelection() {
                runInternalUpdate(() -> {
                    for (CheckBox checkbox : checkboxes) {
                        checkbox.setSelected(selectedValues.contains(checkbox.getText()));
                    }
                });
            }

            private void filterCheckboxes(@Nullable String query) {
                String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
                for (CheckBox checkbox : checkboxes) {
                    boolean visible = normalizedQuery.isEmpty()
                            || checkbox.getText().toLowerCase(Locale.ROOT).contains(normalizedQuery);
                    checkbox.setVisible(visible);
                    checkbox.setManaged(visible);
                }
            }

            private void updateTriggerText() {
                int count = selectedValues.size();
                getStyleClass().remove(STYLE_ACTIVE);
                if (count > 0) {
                    setText(label + " (" + count + ") ▾");
                    getStyleClass().add(STYLE_ACTIVE);
                } else {
                    setText(label + " ▾");
                }
                updateAccessibleText();
            }

            private void updateAccessibleText() {
                if (popup.isShowing()) {
                    setAccessibleText(label + " geöffnet - Escape zum Schließen");
                } else {
                    setAccessibleText(getText());
                }
            }

            private void fireInteractionIfInteractive() {
                if (!isInternalUpdate() && onInteraction != null) {
                    onInteraction.run();
                }
            }

            private void runInternalUpdate(Runnable action) {
                internalUpdateDepth++;
                try {
                    action.run();
                } finally {
                    internalUpdateDepth--;
                }
            }

            private boolean isInternalUpdate() {
                return internalUpdateDepth > 0;
            }
        }
    }
}
