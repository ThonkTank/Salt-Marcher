package src.view.leftbartabs.catalog;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import javafx.animation.PauseTransition;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
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
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

public final class CatalogControlsView extends VBox {

    private static final String FILTER_SECTION_TITLE = "FILTER";
    private static final String ENCOUNTER_SECTION_TITLE = "ENCOUNTER";
    private static final String STYLE_SECTION_HEADER = "section-header";
    private static final String STYLE_TEXT_MUTED = "text-muted";

    private final CatalogControlsContentModel contentModel;
    private final CatalogEncounterTablePickerView encounterTablePicker;
    private final CatalogFilterStripView filterStrip;
    private final CatalogFilterChipsView chipsView;
    private final CatalogEncounterTuningView tuningView;

    private Consumer<CatalogControlsViewInputEvent> viewInputEventHandler = ignored -> { };
    private int suppressedInputDepth;

    public CatalogControlsView(CatalogControlsContentModel contentModel) {
        this.contentModel = Objects.requireNonNull(contentModel, "contentModel");
        encounterTablePicker = new CatalogEncounterTablePickerView(this::publishSnapshot);
        filterStrip = new CatalogFilterStripView(encounterTablePicker, this::publishSnapshot);
        chipsView = new CatalogFilterChipsView(this::clearChip);
        tuningView = new CatalogEncounterTuningView(this::publishSnapshot);

        setSpacing(0);
        setPadding(new Insets(0));
        setMaxHeight(Double.MAX_VALUE);
        getChildren().setAll(
                new SectionView(
                        FILTER_SECTION_TITLE,
                        new PaddedSection(new SurfaceSection(filterStrip, chipsView))),
                new ControlSeparator(),
                new SectionView(ENCOUNTER_SECTION_TITLE, tuningView));

        bindModel();
    }

    void onViewInputEvent(Consumer<CatalogControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void bindModel() {
        runWithSuppressedInput(() -> applyProjection(contentModel.projectionProperty().get()));
        contentModel.projectionProperty().addListener((obs, oldValue, newValue) ->
                runWithSuppressedInput(() -> applyProjection(newValue)));
    }

    private void applyProjection(CatalogContributionModel.ControlsProjection projection) {
        CatalogContributionModel.ControlsProjection safeProjection = projection == null
                ? CatalogContributionModel.ControlsProjection.initial()
                : projection;
        filterStrip.applyProjection(new CatalogFilterStripView.FilterStripProjection(
                safeProjection.filterOptions(),
                safeProjection.creatureFilters(),
                safeProjection.sizeDropdownState(),
                safeProjection.typeDropdownState(),
                safeProjection.subtypeDropdownState(),
                safeProjection.biomeDropdownState(),
                safeProjection.alignmentDropdownState()));
        CatalogContributionModel.ControlsState controlsState = safeProjection.controlsState();
        encounterTablePicker.applyProjection(new CatalogEncounterTablePickerView.EncounterTableProjection(
                safeProjection.encounterTableOptions(),
                controlsState.encounterTableIds(),
                safeProjection.encounterTableDropdownState().open()));
        tuningView.applyProjection(controlsState);
        chipsView.setChips(safeProjection.chips());
    }

    private void clearChip(String key) {
        if (filterStrip.clearChip(key) || encounterTablePicker.clearChip(key)) {
            publishSnapshot();
        }
    }

    private void publishSnapshot() {
        if (suppressedInputDepth > 0) {
            return;
        }

        CatalogFilterStripView.FilterStripSnapshot filterSnapshot = filterStrip.snapshot();
        CatalogEncounterTablePickerView.EncounterTableSnapshot encounterTables = encounterTablePicker.snapshot();
        CatalogEncounterTuningView.TuningSnapshot tuningSnapshot = tuningView.snapshot();
        CatalogContributionModel.CreatureFilters filters = filterSnapshot.filters();

        viewInputEventHandler.accept(new CatalogControlsViewInputEvent(
                filters.nameQuery(),
                filters.challengeRatingMin(),
                filters.challengeRatingMax(),
                filters.sizes(),
                filters.types(),
                filters.subtypes(),
                filters.biomes(),
                filters.alignments(),
                filterSnapshot.sizeDropdownState().open(),
                filterSnapshot.sizeDropdownState().searchQuery(),
                filterSnapshot.typeDropdownState().open(),
                filterSnapshot.typeDropdownState().searchQuery(),
                filterSnapshot.subtypeDropdownState().open(),
                filterSnapshot.subtypeDropdownState().searchQuery(),
                filterSnapshot.biomeDropdownState().open(),
                filterSnapshot.biomeDropdownState().searchQuery(),
                filterSnapshot.alignmentDropdownState().open(),
                filterSnapshot.alignmentDropdownState().searchQuery(),
                encounterTables.popupOpen(),
                tuningSnapshot.difficultyAuto(),
                tuningSnapshot.difficultyValue(),
                tuningSnapshot.balanceAuto(),
                tuningSnapshot.balanceValue(),
                tuningSnapshot.amountAuto(),
                tuningSnapshot.amountValue(),
                tuningSnapshot.diversityAuto(),
                tuningSnapshot.diversityValue(),
                encounterTables.selectedEncounterTableIds()));
    }

    private void runWithSuppressedInput(Runnable action) {
        suppressedInputDepth++;
        try {
            action.run();
        } finally {
            suppressedInputDepth--;
        }
    }

    private static final class SectionView extends VBox {

        SectionView(String title, Node content) {
            super(0, new SectionHeader(title), content);
        }
    }

    private static final class SectionHeader extends Label {

        SectionHeader(String text) {
            super(text);
            getStyleClass().addAll(STYLE_SECTION_HEADER, STYLE_TEXT_MUTED);
        }
    }

    private static final class PaddedSection extends VBox {

        PaddedSection(Node content) {
            super(content);
            setPadding(new Insets(0, 4, 0, 4));
        }
    }

    private static final class SurfaceSection extends VBox {

        SurfaceSection(Node... children) {
            super(children);
            getStyleClass().add("surface-root");
            setPadding(new Insets(6, 8, 6, 8));
        }
    }

    private static final class ControlSeparator extends Region {

        ControlSeparator() {
            getStyleClass().add("control-separator");
        }
    }
}

final class CatalogFilterStripView extends VBox {

    private static final String CLEAR_LABEL = "Leeren";
    private static final String SEARCH_KEY = "search";
    private static final String CHALLENGE_RATING_KEY = "cr";
    private static final String SIZE_PREFIX = "size:";
    private static final String TYPE_PREFIX = "type:";
    private static final String SUBTYPE_PREFIX = "subtype:";
    private static final String BIOME_PREFIX = "biome:";
    private static final String ALIGNMENT_PREFIX = "alignment:";

    private final Runnable onInteraction;
    private final PauseTransition debounce = new PauseTransition(Duration.millis(300));
    private final TextField searchField = new CatalogSearchField();
    private final CatalogCrRangeView crRange = new CatalogCrRangeView(this::emitInteraction);
    private final CatalogSearchableFilterView sizeFilter = new CatalogSearchableFilterView("Größe", this::emitInteraction);
    private final CatalogSearchableFilterView typeFilter = new CatalogSearchableFilterView("Typ", this::emitInteraction);
    private final CatalogSearchableFilterView subtypeFilter = new CatalogSearchableFilterView("Unterart", this::emitInteraction);
    private final CatalogSearchableFilterView biomeFilter = new CatalogSearchableFilterView("Umgebung", this::emitInteraction);
    private final CatalogSearchableFilterView alignmentFilter = new CatalogSearchableFilterView("Gesinnung", this::emitInteraction);

    private int internalUpdateDepth;

    CatalogFilterStripView(CatalogEncounterTablePickerView encounterTablePicker, Runnable onInteraction) {
        this.onInteraction = onInteraction;
        setSpacing(4);
        debounce.setOnFinished(event -> emitInteraction());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> {
            if (internalUpdateDepth == 0) {
                debounce.playFromStart();
            }
        });
        getChildren().setAll(
                new SearchRow(searchField),
                new FilterRow(
                        crRange,
                        sizeFilter,
                        typeFilter,
                        subtypeFilter,
                        biomeFilter,
                        alignmentFilter,
                        encounterTablePicker,
                        new ClearButton(this::clearAndPublish)));
    }

    void applyProjection(FilterStripProjection projection) {
        FilterStripProjection safeProjection = projection == null ? FilterStripProjection.empty() : projection;
        runSilently(() -> {
            CatalogContributionModel.FilterOptionsProjection filterOptions = safeProjection.filterOptions();
            CatalogContributionModel.CreatureFilters creatureFilters = safeProjection.creatureFilters();
            searchField.setText(creatureFilters.nameQuery());
            crRange.setValues(filterOptions.challengeRatings());
            crRange.applySelection(creatureFilters.challengeRatingMin(), creatureFilters.challengeRatingMax());
            sizeFilter.applyProjection(new CatalogSearchableFilterView.SearchableFilterProjection(
                    filterOptions.sizes(),
                    creatureFilters.sizes(),
                    safeProjection.sizeDropdownState()));
            typeFilter.applyProjection(new CatalogSearchableFilterView.SearchableFilterProjection(
                    filterOptions.types(),
                    creatureFilters.types(),
                    safeProjection.typeDropdownState()));
            subtypeFilter.applyProjection(new CatalogSearchableFilterView.SearchableFilterProjection(
                    filterOptions.subtypes(),
                    creatureFilters.subtypes(),
                    safeProjection.subtypeDropdownState()));
            biomeFilter.applyProjection(new CatalogSearchableFilterView.SearchableFilterProjection(
                    filterOptions.biomes(),
                    creatureFilters.biomes(),
                    safeProjection.biomeDropdownState()));
            alignmentFilter.applyProjection(new CatalogSearchableFilterView.SearchableFilterProjection(
                    filterOptions.alignments(),
                    creatureFilters.alignments(),
                    safeProjection.alignmentDropdownState()));
        });
    }

    FilterStripSnapshot snapshot() {
        CatalogCrRangeView.Selection crSelection = crRange.snapshot();
        return new FilterStripSnapshot(
                new CatalogContributionModel.CreatureFilters(
                        normalized(searchField.getText()),
                        crSelection.minimumValue(),
                        crSelection.maximumValue(),
                        sizeFilter.snapshot().selectedValues(),
                        typeFilter.snapshot().selectedValues(),
                        subtypeFilter.snapshot().selectedValues(),
                        biomeFilter.snapshot().selectedValues(),
                        alignmentFilter.snapshot().selectedValues()),
                sizeFilter.snapshot().dropdownState(),
                typeFilter.snapshot().dropdownState(),
                subtypeFilter.snapshot().dropdownState(),
                biomeFilter.snapshot().dropdownState(),
                alignmentFilter.snapshot().dropdownState());
    }

    boolean clearChip(String key) {
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
        if (!key.startsWith(ALIGNMENT_PREFIX)) {
            return false;
        }
        alignmentFilter.removeValue(valuePart(key));
        return true;
    }

    record FilterStripProjection(
            CatalogContributionModel.FilterOptionsProjection filterOptions,
            CatalogContributionModel.CreatureFilters creatureFilters,
            CatalogContributionModel.FilterDropdownState sizeDropdownState,
            CatalogContributionModel.FilterDropdownState typeDropdownState,
            CatalogContributionModel.FilterDropdownState subtypeDropdownState,
            CatalogContributionModel.FilterDropdownState biomeDropdownState,
            CatalogContributionModel.FilterDropdownState alignmentDropdownState
    ) {
        FilterStripProjection {
            filterOptions = filterOptions == null ? CatalogContributionModel.FilterOptionsProjection.empty() : filterOptions;
            creatureFilters = creatureFilters == null ? CatalogContributionModel.CreatureFilters.empty() : creatureFilters;
            sizeDropdownState = sizeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : sizeDropdownState;
            typeDropdownState = typeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : typeDropdownState;
            subtypeDropdownState = subtypeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : subtypeDropdownState;
            biomeDropdownState = biomeDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : biomeDropdownState;
            alignmentDropdownState = alignmentDropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : alignmentDropdownState;
        }

        static FilterStripProjection empty() {
            return new FilterStripProjection(
                    CatalogContributionModel.FilterOptionsProjection.empty(),
                    CatalogContributionModel.CreatureFilters.empty(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed(),
                    CatalogContributionModel.FilterDropdownState.closed());
        }
    }

    record FilterStripSnapshot(
            CatalogContributionModel.CreatureFilters filters,
            CatalogContributionModel.FilterDropdownState sizeDropdownState,
            CatalogContributionModel.FilterDropdownState typeDropdownState,
            CatalogContributionModel.FilterDropdownState subtypeDropdownState,
            CatalogContributionModel.FilterDropdownState biomeDropdownState,
            CatalogContributionModel.FilterDropdownState alignmentDropdownState
    ) {
    }

    private void clearAndPublish() {
        runSilently(() -> {
            searchField.setText("");
            crRange.reset();
            sizeFilter.clearSelection();
            typeFilter.clearSelection();
            subtypeFilter.clearSelection();
            biomeFilter.clearSelection();
            alignmentFilter.clearSelection();
        });
        emitInteraction();
    }

    private boolean clearSelectorChip(CatalogSearchableFilterView filter, String key, String prefix) {
        if (!key.startsWith(prefix)) {
            return false;
        }
        filter.removeValue(valuePart(key));
        return true;
    }

    private void emitInteraction() {
        if (internalUpdateDepth == 0 && onInteraction != null) {
            onInteraction.run();
        }
    }

    private void runSilently(Runnable action) {
        internalUpdateDepth++;
        try {
            action.run();
        } finally {
            internalUpdateDepth--;
        }
    }

    private static String normalized(@Nullable String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? "" : trimmed;
    }

    private static String valuePart(String key) {
        int separator = key.indexOf(':');
        return separator < 0 ? key : key.substring(separator + 1);
    }

    private static final class CatalogSearchField extends TextField {

        CatalogSearchField() {
            setPromptText("Monster suchen...");
            setMaxWidth(Double.MAX_VALUE);
        }
    }

    private static final class SearchRow extends HBox {

        SearchRow(TextField searchField) {
            super(6, searchField);
            setHgrow(searchField, Priority.ALWAYS);
        }
    }

    private static final class FilterRow extends FlowPane {

        FilterRow(javafx.scene.Node... children) {
            super(4, 4, children);
            prefWrapLengthProperty().bind(widthProperty().subtract(16));
        }
    }

    private static final class ClearButton extends Button {

        ClearButton(Runnable action) {
            super(CLEAR_LABEL);
            getStyleClass().addAll("compact", "flat");
            setOnAction(event -> action.run());
        }
    }
}

final class CatalogFilterChipsView extends FlowPane {

    private final Consumer<String> removeChipAction;

    CatalogFilterChipsView(Consumer<String> removeChipAction) {
        super(4, 2);
        this.removeChipAction = removeChipAction;
        prefWrapLengthProperty().bind(widthProperty().subtract(16));
        setMinHeight(24);
    }

    void setChips(List<CatalogContributionModel.FilterChip> chips) {
        getChildren().clear();
        List<CatalogContributionModel.FilterChip> safeChips = chips == null ? List.of() : List.copyOf(chips);
        for (CatalogContributionModel.FilterChip chip : safeChips) {
            getChildren().add(new ChipView(chip, removeChipAction));
        }
    }

    private static final class ChipView extends HBox {

        ChipView(CatalogContributionModel.FilterChip chip, Consumer<String> removeChipAction) {
            super(2);
            getStyleClass().addAll("chip", chip.styleClass());
            getChildren().setAll(new Label(chip.label()), new RemoveChipButton(chip, removeChipAction));
        }
    }

    private static final class RemoveChipButton extends Button {

        RemoveChipButton(CatalogContributionModel.FilterChip chip, Consumer<String> removeChipAction) {
            super("×");
            getStyleClass().addAll("flat", "compact", "chip-remove-btn");
            setAccessibleText("Entfernen: " + chip.label());
            setOnAction(event -> removeChipAction.accept(chip.key()));
        }
    }
}

final class CatalogCrRangeView extends HBox {

    private static final String CHALLENGE_RATING_LABEL = "CR";
    private static final String DEFAULT_MINIMUM = "0";
    private static final String DEFAULT_MAXIMUM = "30";

    private final EndpointSelector minimum = new EndpointSelector("Minimaler CR");
    private final EndpointSelector maximum = new EndpointSelector("Maximaler CR");
    private final Runnable onInteraction;

    CatalogCrRangeView(Runnable onInteraction) {
        super(2);
        this.onInteraction = onInteraction;
        minimum.setOnAction(event -> publishSelection());
        maximum.setOnAction(event -> publishSelection());
        getChildren().setAll(new CrLabel(), minimum, new MutedLabel("-"), maximum);
    }

    void setValues(List<String> values) {
        List<String> safeValues = values == null || values.isEmpty()
                ? List.of(DEFAULT_MINIMUM, DEFAULT_MAXIMUM)
                : List.copyOf(values);
        minimum.setValues(safeValues);
        maximum.setValues(safeValues);
        minimum.selectFallback(true);
        maximum.selectFallback(false);
    }

    void applySelection(String minimumValue, String maximumValue) {
        minimum.selectValue(minimumValue, true);
        maximum.selectValue(maximumValue, false);
        maximum.ensureAtLeast(minimum.selectedIndex());
    }

    Selection snapshot() {
        return new Selection(minimum.minimumValue(), maximum.maximumValue());
    }

    void reset() {
        minimum.selectFallback(true);
        maximum.selectFallback(false);
    }

    record Selection(String minimumValue, String maximumValue) {
    }

    private void publishSelection() {
        maximum.ensureAtLeast(minimum.selectedIndex());
        if (onInteraction != null) {
            onInteraction.run();
        }
    }

    private static final class EndpointSelector extends ComboBox<String> {

        EndpointSelector(String accessibleText) {
            setAccessibleText(accessibleText);
            setPrefWidth(65);
        }

        void setValues(List<String> values) {
            setItems(FXCollections.observableArrayList(values));
        }

        void selectValue(String value, boolean first) {
            if (value == null || value.isBlank()) {
                selectFallback(first);
                return;
            }
            int index = getItems().indexOf(value);
            if (index >= 0) {
                getSelectionModel().clearAndSelect(index);
                return;
            }
            selectFallback(first);
        }

        void selectFallback(boolean first) {
            getSelectionModel().clearAndSelect(first ? 0 : Math.max(getItems().size() - 1, 0));
        }

        int selectedIndex() {
            return getSelectionModel().getSelectedIndex();
        }

        void ensureAtLeast(int minimumIndex) {
            if (minimumIndex > selectedIndex() && minimumIndex >= 0) {
                getSelectionModel().select(minimumIndex);
            }
        }

        String minimumValue() {
            return selectedIndex() > 0 ? selectedValue() : "";
        }

        String maximumValue() {
            int lastIndex = getItems().size() - 1;
            return selectedIndex() >= 0 && selectedIndex() < lastIndex ? selectedValue() : "";
        }

        private String selectedValue() {
            String value = getValue();
            return value == null ? "" : value;
        }
    }

    private static final class CrLabel extends Label {

        CrLabel() {
            super(CHALLENGE_RATING_LABEL);
            getStyleClass().addAll("text-muted", "bold");
            setMinWidth(20);
        }
    }
}

final class CatalogEncounterTuningView extends VBox {

    private static final double DEFAULT_DIFFICULTY_SLIDER_VALUE = 2.0;
    private static final double DEFAULT_BALANCE_SLIDER_VALUE = 3.0;
    private static final double DEFAULT_AMOUNT_SLIDER_VALUE = 3.0;
    private static final double DEFAULT_DIVERSITY_SLIDER_VALUE = 3.0;
    private static final double MINIMUM_ENDPOINT_LABEL_VALUE = 1.0;

    private final TuningControl difficultyControl;
    private final TuningControl balanceControl;
    private final TuningControl amountControl;
    private final TuningControl diversityControl;

    CatalogEncounterTuningView(Runnable onInteraction) {
        difficultyControl = new TuningControl(new ControlSpec(
                "Schwierigkeit",
                1.0,
                4.0,
                DEFAULT_DIFFICULTY_SLIDER_VALUE,
                true,
                "Schwierigkeitsbereich des Encounters",
                difficultyFormatter(),
                1.0,
                "difficulty-slider"), onInteraction);
        balanceControl = new TuningControl(new ControlSpec(
                "Balance",
                1.0,
                5.0,
                DEFAULT_BALANCE_SLIDER_VALUE,
                true,
                "1: CR-Extreme bevorzugen, 5: CR-Durchschnitt bevorzugen",
                endpointFormatter("Extreme", "Durchschnitt", 5.0),
                null,
                null), onInteraction);
        amountControl = new TuningControl(new ControlSpec(
                "Menge",
                1.0,
                5.0,
                DEFAULT_AMOUNT_SLIDER_VALUE,
                false,
                "1: Bosse bevorzugen, 5: Minions bevorzugen",
                endpointFormatter("Boss", "Minions", 5.0),
                1.0,
                null), onInteraction);
        diversityControl = new TuningControl(new ControlSpec(
                "Diversität",
                1.0,
                4.0,
                DEFAULT_DIVERSITY_SLIDER_VALUE,
                true,
                "1: ein Statblock, 4: vier unterschiedliche Statblocks",
                endpointFormatter("1", "4", 4.0),
                null,
                null), onInteraction);

        setMaxWidth(Double.MAX_VALUE);
        setPadding(new Insets(0, 4, 0, 4));
        getChildren().setAll(new ControlsRow(difficultyControl, balanceControl, amountControl, diversityControl));
    }

    void applyProjection(CatalogContributionModel.ControlsState state) {
        CatalogContributionModel.ControlsState safeState =
                state == null ? CatalogContributionModel.ControlsState.empty() : state;
        difficultyControl.applyProjection(safeState.difficulty());
        balanceControl.applyProjection(safeState.balance());
        amountControl.applyProjection(safeState.amount());
        diversityControl.applyProjection(safeState.diversity());
    }

    TuningSnapshot snapshot() {
        return new TuningSnapshot(
                difficultyControl.autoMode(),
                difficultyControl.value(),
                balanceControl.autoMode(),
                balanceControl.value(),
                amountControl.autoMode(),
                amountControl.value(),
                diversityControl.autoMode(),
                diversityControl.value());
    }

    record TuningSnapshot(
            boolean difficultyAuto,
            double difficultyValue,
            boolean balanceAuto,
            double balanceValue,
            boolean amountAuto,
            double amountValue,
            boolean diversityAuto,
            double diversityValue
    ) {
    }

    private static StringConverter<Double> difficultyFormatter() {
        return new StringConverter<>() {
            @Override
            public String toString(Double value) {
                int roundedValue = value == null ? 2 : (int) Math.round(value);
                return switch (Math.max(1, Math.min(4, roundedValue))) {
                    case 1 -> "Easy";
                    case 3 -> "Hard";
                    case 4 -> "Deadly";
                    default -> "Medium";
                };
            }

            @Override
            public Double fromString(String value) {
                return 0.0;
            }
        };
    }

    private static StringConverter<Double> endpointFormatter(String minimumLabel, String maximumLabel, double maximumValue) {
        return new StringConverter<>() {
            @Override
            public String toString(Double value) {
                if (value == null) {
                    return "";
                }
                if (value <= MINIMUM_ENDPOINT_LABEL_VALUE) {
                    return minimumLabel;
                }
                if (value >= maximumValue) {
                    return maximumLabel;
                }
                return "";
            }

            @Override
            public Double fromString(String value) {
                return 0.0;
            }
        };
    }

    private static final class ControlsRow extends HBox {

        ControlsRow(TuningControl... controls) {
            super(8, controls);
            for (TuningControl control : controls) {
                setHgrow(control, Priority.ALWAYS);
            }
        }
    }

    private static final class TuningControl extends HBox {

        private final Map<Integer, String> previewLabels = new LinkedHashMap<>();
        private final Slider slider;
        private final AutoButton autoButton;
        private final ValueLabel valueLabel;
        private final Runnable onInteraction;
        private boolean autoMode = true;
        private boolean internalUpdate;

        TuningControl(ControlSpec spec, Runnable onInteraction) {
            super(4);
            setAlignment(Pos.CENTER_LEFT);
            this.onInteraction = onInteraction;

            slider = new TuningSlider(spec);
            slider.setShowTickLabels(true);
            slider.setShowTickMarks(true);
            slider.setSnapToTicks(spec.snapToTicks());
            slider.setMajorTickUnit(spec.majorTickUnitOverride() == null ? 1.0 : spec.majorTickUnitOverride());
            slider.setMinorTickCount(0);
            slider.setLabelFormatter(spec.labelFormatter());
            slider.setDisable(true);
            slider.setAccessibleRoleDescription(spec.title());
            slider.setAccessibleText(spec.tooltip());
            setHgrow(slider, Priority.ALWAYS);

            autoButton = new AutoButton(spec.title());
            valueLabel = new ValueLabel();
            autoButton.setOnAction(event -> {
                autoMode = !autoMode;
                updateVisualState();
                if (!internalUpdate && onInteraction != null) {
                    onInteraction.run();
                }
            });
            slider.valueProperty().addListener((obs, oldValue, newValue) -> {
                updateValueLabel();
                if (!internalUpdate && onInteraction != null) {
                    onInteraction.run();
                }
            });

            getChildren().setAll(new MutedLabel(spec.title()), autoButton, valueLabel, slider);
            updateVisualState();
        }

        void applyProjection(CatalogContributionModel.SliderProjection projection) {
            CatalogContributionModel.SliderProjection safeProjection = projection == null
                    ? new CatalogContributionModel.SliderProjection(true, slider.getValue(), List.of())
                    : projection;
            internalUpdate = true;
            try {
                replacePreviewLabels(safeProjection.labels());
                autoMode = safeProjection.auto();
                slider.setValue(safeProjection.value());
            } finally {
                internalUpdate = false;
            }
            updateVisualState();
        }

        boolean autoMode() {
            return autoMode;
        }

        double value() {
            return slider.getValue();
        }

        private void replacePreviewLabels(List<CatalogContributionModel.PreviewLabel> labels) {
            previewLabels.clear();
            if (labels == null) {
                return;
            }
            for (CatalogContributionModel.PreviewLabel label : labels) {
                if (label != null && !label.label().isBlank()) {
                    previewLabels.put((int) Math.round(label.value()), label.label());
                }
            }
        }

        private void updateVisualState() {
            slider.setDisable(autoMode);
            autoButton.update(autoMode);
            updateValueLabel();
        }

        private void updateValueLabel() {
            if (autoMode) {
                valueLabel.setText("");
                return;
            }
            valueLabel.setText(previewLabels.getOrDefault((int) Math.round(slider.getValue()), ""));
        }
    }

    private record ControlSpec(
            String title,
            double min,
            double max,
            double defaultValue,
            boolean snapToTicks,
            String tooltip,
            StringConverter<Double> labelFormatter,
            @Nullable Double majorTickUnitOverride,
            @Nullable String sliderStyleClass
    ) {
    }

    private static final class TuningSlider extends Slider {

        TuningSlider(ControlSpec spec) {
            super(spec.min(), spec.max(), spec.defaultValue());
            if (spec.sliderStyleClass() != null && !spec.sliderStyleClass().isBlank()) {
                getStyleClass().add(spec.sliderStyleClass());
            }
        }
    }

    private static final class AutoButton extends Button {

        AutoButton(String title) {
            super("⚅");
            getStyleClass().addAll("compact", "auto-dice-btn", "active");
            setMinWidth(USE_PREF_SIZE);
            setAccessibleText(title + " automatisch bestimmen");
        }

        void update(boolean autoMode) {
            getStyleClass().remove("active");
            if (autoMode) {
                getStyleClass().add("active");
            }
        }
    }

    private static final class ValueLabel extends Label {

        ValueLabel() {
            getStyleClass().add("text-secondary");
            setMinWidth(56);
            setPrefWidth(56);
        }
    }
}

final class CatalogEncounterTablePickerView extends Button {

    private static final String DEFAULT_TRIGGER_TEXT = "Tabelle ▾";
    private static final String EMPTY_LABEL = "Keine Encounter-Tabellen gefunden";
    private static final String CLEAR_ALL_LABEL = "(Alle Monster)";
    private static final String DEFAULT_TOOLTIP = "Mehrere Encounter-Tabellen können kombiniert werden.";
    private static final String LOOT_CONFLICT_TOOLTIP =
            "Mehrere ausgewählte Tabellen verweisen auf unterschiedliche Loot-Tabellen. "
                    + "Kampfstart bleibt blockiert, bis höchstens eine verknüpfte Loot-Tabelle aktiv ist.";

    private final Runnable onInteraction;
    private final Tooltip tableTooltip = new Tooltip(DEFAULT_TOOLTIP);
    private final EncounterTablePopupContentView popupContent = new EncounterTablePopupContentView();
    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final AnchoredPopupView popup = new AnchoredPopupView(popupContent, () -> this);
    private final SelectionState selectionState = new SelectionState();

    CatalogEncounterTablePickerView(Runnable onInteraction) {
        this.onInteraction = onInteraction;
        getStyleClass().addAll("compact", "filter-trigger");
        setTooltip(tableTooltip);
        setOnAction(event -> togglePopup());
        popup.bind(popupContentModel);
        updateTriggerState();
    }

    void applyProjection(EncounterTableProjection projection) {
        selectionState.apply(projection);
        renderPopup(selectionState.popupOpen(projection));
        updateTriggerState();
    }

    EncounterTableSnapshot snapshot() {
        return selectionState.snapshot(popupContentModel.isOpen());
    }

    boolean clearChip(String key) {
        if (!selectionState.clearChip(key)) {
            return false;
        }
        renderPopup(popupContentModel.isOpen());
        updateTriggerState();
        return true;
    }

    private void togglePopup() {
        renderPopup(!popupContentModel.isOpen());
        onInteraction.run();
    }

    private void renderPopup(boolean open) {
        if (open) {
            popupContent.render(
                    selectionState.encounterTables(),
                    selectionState.selectedEncounterTableIds(),
                    this::handleSelectionChange,
                    this::handleClearAll);
            if (!popupContentModel.isOpen()) {
                popupContentModel.showBelow(2.0, false);
            }
            return;
        }
        if (popupContentModel.isOpen()) {
            popupContentModel.hide();
        }
    }

    private void updateTriggerState() {
        getStyleClass().remove("filter-trigger-active");
        SelectionSummary summary = selectionState.summary();
        setText(summary.label());
        if (!selectionState.selectedEncounterTableIds().isEmpty()) {
            getStyleClass().add("filter-trigger-active");
        }
        tableTooltip.setText(summary.lootConflict() ? LOOT_CONFLICT_TOOLTIP : DEFAULT_TOOLTIP);
    }

    private void handleSelectionChange(long tableId, boolean selected) {
        selectionState.select(tableId, selected);
        renderPopup(popupContentModel.isOpen());
        updateTriggerState();
        onInteraction.run();
    }

    private void handleClearAll() {
        selectionState.clearAll();
        renderPopup(popupContentModel.isOpen());
        updateTriggerState();
        onInteraction.run();
    }

    record EncounterTableProjection(
            List<CatalogContributionModel.EncounterTableOption> encounterTables,
            List<Long> selectedEncounterTableIds,
            boolean popupOpen
    ) {
        EncounterTableProjection {
            encounterTables = encounterTables == null ? List.of() : List.copyOf(encounterTables);
            selectedEncounterTableIds = selectedEncounterTableIds == null ? List.of() : List.copyOf(selectedEncounterTableIds);
        }
    }

    record EncounterTableSnapshot(boolean popupOpen, List<Long> selectedEncounterTableIds) {
        EncounterTableSnapshot {
            selectedEncounterTableIds = selectedEncounterTableIds == null ? List.of() : List.copyOf(selectedEncounterTableIds);
        }
    }

    private record SelectionSummary(String label, boolean lootConflict) {

        private static final String CHIP_PREFIX = "encounter-table:";
        private static final String MULTI_TABLE_LABEL_PREFIX = "Tabellen (";
        private static final String MULTI_TABLE_LABEL_SUFFIX = ") ▾";
        private static final String LOOT_CONFLICT_SUFFIX = ", Loot-Konflikt) ▾";
        private static final String SELECTED_SUFFIX = " ▾";
        private static final int SINGLE_SELECTION_COUNT = 1;
        private static final long MULTI_LOOT_TABLE_COUNT = 1L;

        static SelectionSummary from(
                List<CatalogContributionModel.EncounterTableOption> encounterTables,
                List<Long> selectedEncounterTableIds
        ) {
            Set<Long> selectedIds = new LinkedHashSet<>(selectedEncounterTableIds);
            List<CatalogContributionModel.EncounterTableOption> selectedTables = encounterTables.stream()
                    .filter(table -> selectedIds.contains(table.tableId()))
                    .toList();
            long distinctLootTables = selectedTables.stream()
                    .map(CatalogContributionModel.EncounterTableOption::linkedLootTableId)
                    .filter(java.util.Objects::nonNull)
                    .distinct()
                    .count();
            if (selectedTables.isEmpty()) {
                return new SelectionSummary(DEFAULT_TRIGGER_TEXT, false);
            }
            if (selectedTables.size() == SINGLE_SELECTION_COUNT) {
                return new SelectionSummary(selectedTables.get(0).name() + SELECTED_SUFFIX, false);
            }
            boolean lootConflict = distinctLootTables > MULTI_LOOT_TABLE_COUNT;
            String label = lootConflict
                    ? MULTI_TABLE_LABEL_PREFIX + selectedTables.size() + LOOT_CONFLICT_SUFFIX
                    : MULTI_TABLE_LABEL_PREFIX + selectedTables.size() + MULTI_TABLE_LABEL_SUFFIX;
            return new SelectionSummary(label, lootConflict);
        }

        static @Nullable Long tableIdFromKey(String key) {
            if (key == null || !key.startsWith(CHIP_PREFIX)) {
                return null;
            }
            try {
                return Long.parseLong(key.substring(CHIP_PREFIX.length()));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
    }

    private static final class SelectionState {

        private List<CatalogContributionModel.EncounterTableOption> encounterTables = List.of();
        private List<Long> selectedEncounterTableIds = List.of();

        void apply(EncounterTableProjection projection) {
            EncounterTableProjection safeProjection = projection == null
                    ? new EncounterTableProjection(List.of(), List.of(), false)
                    : projection;
            encounterTables = safeProjection.encounterTables();
            selectedEncounterTableIds = availableEncounterTableIds(safeProjection.selectedEncounterTableIds());
        }

        boolean clearChip(String key) {
            Long tableId = SelectionSummary.tableIdFromKey(key);
            if (tableId == null || !selectedEncounterTableIds.contains(tableId)) {
                return false;
            }
            select(tableId, false);
            return true;
        }

        void clearAll() {
            selectedEncounterTableIds = List.of();
        }

        void select(long tableId, boolean selected) {
            Set<Long> updatedTableIds = new LinkedHashSet<>(selectedEncounterTableIds);
            if (selected) {
                updatedTableIds.add(tableId);
            } else {
                updatedTableIds.remove(tableId);
            }
            selectedEncounterTableIds = List.copyOf(updatedTableIds);
        }

        EncounterTableSnapshot snapshot(boolean popupOpen) {
            return new EncounterTableSnapshot(popupOpen, selectedEncounterTableIds);
        }

        SelectionSummary summary() {
            return SelectionSummary.from(encounterTables, selectedEncounterTableIds);
        }

        List<CatalogContributionModel.EncounterTableOption> encounterTables() {
            return encounterTables;
        }

        List<Long> selectedEncounterTableIds() {
            return selectedEncounterTableIds;
        }

        boolean popupOpen(EncounterTableProjection projection) {
            return projection != null && projection.popupOpen();
        }

        private List<Long> availableEncounterTableIds(List<Long> tableIds) {
            if (tableIds == null || tableIds.isEmpty()) {
                return List.of();
            }
            Set<Long> availableIds = encounterTables.stream()
                    .map(CatalogContributionModel.EncounterTableOption::tableId)
                    .collect(LinkedHashSet::new, Set::add, Set::addAll);
            return tableIds.stream()
                    .filter(availableIds::contains)
                    .distinct()
                    .toList();
        }
    }

    private static final class EncounterTablePopupContentView extends VBox {

        EncounterTablePopupContentView() {
            super(2);
            getStyleClass().add("filter-dropdown");
            setPadding(new Insets(8));
        }

        void render(
                List<CatalogContributionModel.EncounterTableOption> encounterTables,
                List<Long> selectedEncounterTableIds,
                BiConsumer<Long, Boolean> selectionAction,
                Runnable clearAction
        ) {
            getChildren().clear();
            getChildren().add(new ClearAllButton(clearAction));
            if (encounterTables.isEmpty()) {
                getChildren().add(new SecondaryLabel(EMPTY_LABEL));
                return;
            }
            Set<Long> selectedIds = new LinkedHashSet<>(selectedEncounterTableIds);
            for (CatalogContributionModel.EncounterTableOption table : encounterTables) {
                getChildren().add(new EncounterTableCheckBox(table, selectedIds.contains(table.tableId()), selectionAction));
            }
        }
    }

    private static final class ClearAllButton extends Button {

        ClearAllButton(Runnable clearAction) {
            super(CLEAR_ALL_LABEL);
            setMaxWidth(Double.MAX_VALUE);
            getStyleClass().addAll("flat", "compact");
            setOnAction(event -> clearAction.run());
        }
    }

    private static final class SecondaryLabel extends Label {

        SecondaryLabel(String text) {
            super(text);
            getStyleClass().add("text-secondary");
        }
    }

    private static final class EncounterTableCheckBox extends CheckBox {

        EncounterTableCheckBox(
                CatalogContributionModel.EncounterTableOption table,
                boolean selected,
                BiConsumer<Long, Boolean> selectionAction
        ) {
            super(table.name());
            setMaxWidth(Double.MAX_VALUE);
            setSelected(selected);
            setOnAction(event -> selectionAction.accept(table.tableId(), isSelected()));
        }
    }
}

final class CatalogSearchableFilterView extends Button {

    private static final int SEARCH_FIELD_THRESHOLD = 6;
    private static final String CLOSED_SUFFIX = " ▾";

    private final String label;
    private final Runnable onInteraction;
    private final SearchableFilterPopupContentView popupContent;
    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final AnchoredPopupView popup;
    private final Set<String> selectedValues = new LinkedHashSet<>();

    private List<String> options = List.of();
    private int internalUpdateDepth;

    CatalogSearchableFilterView(String label, Runnable onInteraction) {
        this.label = label;
        this.onInteraction = onInteraction;
        popupContent = new SearchableFilterPopupContentView(
                label,
                () -> internalUpdateDepth > 0,
                () -> {
                    if (onInteraction != null) {
                        onInteraction.run();
                    }
                },
                this::updateSelection);
        getStyleClass().addAll("compact", "filter-trigger");
        setText(label + CLOSED_SUFFIX);
        setAccessibleText(label + " geschlossen");
        setOnAction(event -> togglePopup());
        popup = new AnchoredPopupView(popupContent, () -> this);
        popup.bind(popupContentModel);
        popup.onViewInputEvent(event -> {
            if (event.interaction().isHidden()) {
                updateTriggerText();
                if (onInteraction != null) {
                    onInteraction.run();
                }
            }
        });
    }

    void applyProjection(SearchableFilterProjection projection) {
        SearchableFilterProjection safeProjection = projection == null ? SearchableFilterProjection.empty() : projection;
        runSilently(() -> {
            options = safeProjection.options();
            selectedValues.clear();
            selectedValues.addAll(safeProjection.selectedValues());
            popupContent.render(options, selectedValues, safeProjection.dropdownState().searchQuery());
            if (safeProjection.dropdownState().open()) {
                if (!popupContentModel.isOpen()) {
                    popupContentModel.showBelow(2.0, false);
                }
            } else if (popupContentModel.isOpen()) {
                popupContentModel.hide();
            }
            updateTriggerText();
        });
    }

    SearchableFilterSnapshot snapshot() {
        return new SearchableFilterSnapshot(
                List.copyOf(selectedValues),
                new CatalogContributionModel.FilterDropdownState(popupContentModel.isOpen(), popupContent.query()));
    }

    void removeValue(String value) {
        if (selectedValues.remove(value)) {
            runSilently(() -> {
                if (popupContentModel.isOpen()) {
                    popupContent.render(options, selectedValues, popupContent.query());
                }
                updateTriggerText();
            });
        }
    }

    void clearSelection() {
        if (!selectedValues.isEmpty()) {
            runSilently(() -> {
                selectedValues.clear();
                if (popupContentModel.isOpen()) {
                    popupContent.render(options, selectedValues, popupContent.query());
                }
                updateTriggerText();
            });
        }
    }

    record SearchableFilterProjection(
            List<String> options,
            List<String> selectedValues,
            CatalogContributionModel.FilterDropdownState dropdownState
    ) {
        SearchableFilterProjection {
            options = options == null ? List.of() : List.copyOf(options);
            selectedValues = selectedValues == null ? List.of() : List.copyOf(selectedValues);
            dropdownState = dropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : dropdownState;
        }

        static SearchableFilterProjection empty() {
            return new SearchableFilterProjection(
                    List.of(),
                    List.of(),
                    CatalogContributionModel.FilterDropdownState.closed());
        }
    }

    record SearchableFilterSnapshot(List<String> selectedValues, CatalogContributionModel.FilterDropdownState dropdownState) {
        SearchableFilterSnapshot {
            selectedValues = selectedValues == null ? List.of() : List.copyOf(selectedValues);
            dropdownState = dropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : dropdownState;
        }
    }

    private void togglePopup() {
        if (popupContentModel.isOpen()) {
            popupContentModel.hide();
        } else {
            popupContent.render(options, selectedValues, popupContent.query());
            popupContentModel.showBelow(2.0, false);
        }
        updateTriggerText();
        if (onInteraction != null) {
            onInteraction.run();
        }
    }

    private void updateSelection(String value, boolean selected) {
        if (internalUpdateDepth > 0) {
            return;
        }
        if (selected) {
            selectedValues.add(value);
        } else {
            selectedValues.remove(value);
        }
        updateTriggerText();
        if (onInteraction != null) {
            onInteraction.run();
        }
    }

    private void updateTriggerText() {
        int count = selectedValues.size();
        getStyleClass().remove("filter-trigger-active");
        if (count > 0) {
            setText(label + " (" + count + ")" + CLOSED_SUFFIX);
            getStyleClass().add("filter-trigger-active");
        } else {
            setText(label + CLOSED_SUFFIX);
        }
        setAccessibleText(popupContentModel.isOpen() ? label + " geöffnet - Escape zum Schließen" : getText());
    }

    private void runSilently(Runnable action) {
        internalUpdateDepth++;
        try {
            action.run();
        } finally {
            internalUpdateDepth--;
        }
    }

    private static final class SearchableFilterPopupContentView extends VBox {

        private final PopupSearchField searchField;
        private final OptionListView optionList = new OptionListView();
        private final OptionScrollPane optionScrollPane = new OptionScrollPane(optionList);
        private final BooleanSupplier inputSuppressed;
        private final Runnable queryChangedAction;
        private final BiConsumer<String, Boolean> selectionAction;
        private int internalUpdateDepth;

        SearchableFilterPopupContentView(
                String label,
                BooleanSupplier inputSuppressed,
                Runnable queryChangedAction,
                BiConsumer<String, Boolean> selectionAction
        ) {
            super(4);
            this.inputSuppressed = inputSuppressed;
            this.queryChangedAction = queryChangedAction;
            this.selectionAction = selectionAction;
            searchField = new PopupSearchField(label);
            getStyleClass().add("filter-dropdown");
            setPadding(new Insets(8));
            searchField.textProperty().addListener((obs, oldValue, newValue) -> {
                filterVisibleOptions(newValue);
                if (internalUpdateDepth == 0 && !inputSuppressed.getAsBoolean()) {
                    queryChangedAction.run();
                }
            });
        }

        void render(List<String> options, Set<String> selectedValues, String query) {
            runSilently(() -> {
                getChildren().clear();
                optionList.clearOptions();
                if (options.size() > SEARCH_FIELD_THRESHOLD) {
                    searchField.setText(query == null ? "" : query);
                    getChildren().add(searchField);
                } else {
                    searchField.setText("");
                }
                for (String option : options) {
                    optionList.addOption(new OptionCheckBox(option, selectedValues.contains(option), selectionAction));
                }
                getChildren().add(optionScrollPane);
                optionList.applyFilter(searchField.getText());
            });
        }

        String query() {
            return searchField.getText();
        }

        private void filterVisibleOptions(String query) {
            String normalizedQuery = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
            optionList.applyFilter(normalizedQuery);
        }

        private void runSilently(Runnable action) {
            internalUpdateDepth++;
            try {
                action.run();
            } finally {
                internalUpdateDepth--;
            }
        }
    }

    private static final class OptionListView extends VBox {

        OptionListView() {
            super(2);
        }

        void clearOptions() {
            getChildren().clear();
        }

        void addOption(OptionCheckBox optionCheckBox) {
            getChildren().add(optionCheckBox);
        }

        void applyFilter(String query) {
            String normalizedQuery = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
            for (javafx.scene.Node child : getChildren()) {
                CheckBox checkbox = (CheckBox) child;
                boolean visible = normalizedQuery.isEmpty()
                        || checkbox.getText().toLowerCase(java.util.Locale.ROOT).contains(normalizedQuery);
                checkbox.setVisible(visible);
                checkbox.setManaged(visible);
            }
        }
    }

    private static final class PopupSearchField extends TextField {

        PopupSearchField(String label) {
            setPromptText(label + " suchen...");
            getStyleClass().add("text-field");
        }
    }

    private static final class OptionCheckBox extends CheckBox {

        OptionCheckBox(String option, boolean selected, BiConsumer<String, Boolean> selectionAction) {
            super(option);
            setSelected(selected);
            selectedProperty().addListener((obs, oldValue, newValue) -> selectionAction.accept(option, newValue));
        }
    }

    private static final class OptionScrollPane extends ScrollPane {

        OptionScrollPane(VBox content) {
            super(content);
            setFitToWidth(true);
            setHbarPolicy(ScrollBarPolicy.NEVER);
            setMaxHeight(280);
            setPrefWidth(200);
            setMinWidth(160);
        }
    }
}
