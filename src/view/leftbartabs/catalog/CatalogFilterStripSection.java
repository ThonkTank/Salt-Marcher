package src.view.leftbartabs.catalog;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import javafx.animation.PauseTransition;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class CatalogFilterStripSection extends VBox {

    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TEXT_MUTED = "text-muted";
    private static final String STYLE_BOLD = "bold";
    private static final String STYLE_DROPDOWN = "filter-dropdown";
    private static final String STYLE_TRIGGER = "filter-trigger";
    private static final String STYLE_ACTIVE = "filter-trigger-active";
    private static final String STYLE_TEXT_FIELD = "text-field";
    private static final String SEARCH_PROMPT = "Monster suchen...";
    private static final String CLEAR_LABEL = "Leeren";
    private static final String CR_LABEL = "CR";
    private static final String CR_MIN_ACCESSIBLE = "Minimaler CR";
    private static final String CR_MAX_ACCESSIBLE = "Maximaler CR";
    private static final String DEFAULT_CHALLENGE_RATING_MIN = "0";
    private static final String DEFAULT_CHALLENGE_RATING_MAX = "30";
    private static final int SEARCH_FIELD_THRESHOLD = 6;
    private static final String SEARCH_KEY = "search";
    private static final String CHALLENGE_RATING_KEY = "cr";
    private static final String SIZE_PREFIX = "size:";
    private static final String TYPE_PREFIX = "type:";
    private static final String SUBTYPE_PREFIX = "subtype:";
    private static final String BIOME_PREFIX = "biome:";
    private static final String ALIGNMENT_PREFIX = "alignment:";

    private final Runnable onFilterChanged;
    private final PauseTransition debounce = new PauseTransition(Duration.millis(300));

    private final TextField searchField = new TextField();
    private final CrRangeSelector crRange = new CrRangeSelector(this::emitFilterChanged);
    private final SearchableFilterButton sizeFilter = new SearchableFilterButton("Größe", this::emitFilterChanged);
    private final SearchableFilterButton typeFilter = new SearchableFilterButton("Typ", this::emitFilterChanged);
    private final SearchableFilterButton subtypeFilter = new SearchableFilterButton("Unterart", this::emitFilterChanged);
    private final SearchableFilterButton biomeFilter = new SearchableFilterButton("Umgebung", this::emitFilterChanged);
    private final SearchableFilterButton alignmentFilter = new SearchableFilterButton("Gesinnung", this::emitFilterChanged);

    CatalogFilterStripSection(Node additionalFilterControl, Runnable onFilterChanged) {
        this.onFilterChanged = onFilterChanged;
        setSpacing(4);

        searchField.setPromptText(SEARCH_PROMPT);
        searchField.setMaxWidth(Double.MAX_VALUE);
        debounce.setOnFinished(event -> emitFilterChanged());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> debounce.playFromStart());

        HBox searchRow = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);

        Button clearButton = new Button(CLEAR_LABEL);
        clearButton.getStyleClass().addAll(STYLE_COMPACT, "flat");
        clearButton.setOnAction(event -> {
            clearAllFilters();
            emitFilterChanged();
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

    void setCreatureFilterData(CreatureFilterData data) {
        CreatureFilterData safeData = data == null ? CreatureFilterData.empty() : data;
        crRange.setValues(safeData.challengeRatings());
        sizeFilter.setOptions(safeData.sizes());
        typeFilter.setOptions(safeData.types());
        subtypeFilter.setOptions(safeData.subtypes());
        biomeFilter.setOptions(safeData.biomes());
        alignmentFilter.setOptions(safeData.alignments());
    }

    void applyEncounterBuilderFilters(List<String> types, List<String> subtypes, List<String> biomes) {
        typeFilter.setSelectedValues(types);
        subtypeFilter.setSelectedValues(subtypes);
        biomeFilter.setSelectedValues(biomes);
    }

    CreatureFilterState buildFilterState() {
        return new CreatureFilterState(
                normalized(searchField.getText()),
                crRange.minimumFilterValue(),
                crRange.maximumFilterValue(),
                sizeFilter.selectedValues(),
                typeFilter.selectedValues(),
                subtypeFilter.selectedValues(),
                biomeFilter.selectedValues(),
                alignmentFilter.selectedValues());
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

    private void emitFilterChanged() {
        if (onFilterChanged != null) {
            onFilterChanged.run();
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

    static final class CreatureFilterData {

        private static final int SIZES_INDEX = 0;
        private static final int TYPES_INDEX = 1;
        private static final int SUBTYPES_INDEX = 2;
        private static final int BIOMES_INDEX = 3;
        private static final int ALIGNMENTS_INDEX = 4;
        private static final int CHALLENGE_RATINGS_INDEX = 5;

        private final List<List<String>> values;

        CreatureFilterData(
                List<String> sizes,
                List<String> types,
                List<String> subtypes,
                List<String> biomes,
                List<String> alignments,
                List<String> challengeRatings
        ) {
            values = List.of(
                    copyOf(sizes),
                    copyOf(types),
                    copyOf(subtypes),
                    copyOf(biomes),
                    copyOf(alignments),
                    copyOf(challengeRatings));
        }

        List<String> sizes() {
            return values.get(SIZES_INDEX);
        }

        List<String> types() {
            return values.get(TYPES_INDEX);
        }

        List<String> subtypes() {
            return values.get(SUBTYPES_INDEX);
        }

        List<String> biomes() {
            return values.get(BIOMES_INDEX);
        }

        List<String> alignments() {
            return values.get(ALIGNMENTS_INDEX);
        }

        List<String> challengeRatings() {
            return values.get(CHALLENGE_RATINGS_INDEX);
        }

        static CreatureFilterData empty() {
            return new CreatureFilterData(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    record CreatureFilterState(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        CreatureFilterState {
            nameQuery = nameQuery == null ? "" : nameQuery;
            challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin;
            challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax;
            sizes = copyOf(sizes);
            types = copyOf(types);
            subtypes = copyOf(subtypes);
            biomes = copyOf(biomes);
            alignments = copyOf(alignments);
        }

        @Override
        public List<String> sizes() {
            return copyOf(sizes);
        }

        @Override
        public List<String> types() {
            return copyOf(types);
        }

        @Override
        public List<String> subtypes() {
            return copyOf(subtypes);
        }

        @Override
        public List<String> biomes() {
            return copyOf(biomes);
        }

        @Override
        public List<String> alignments() {
            return copyOf(alignments);
        }

        static CreatureFilterState empty() {
            return new CreatureFilterState("", "", "", List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    private static List<String> copyOf(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static final class CrRangeSelector extends HBox {

        private final ComboBox<String> minimum = new ComboBox<>();
        private final ComboBox<String> maximum = new ComboBox<>();
        private final Runnable onChange;
        private int internalUpdateDepth;

        CrRangeSelector(Runnable onChange) {
            this.onChange = onChange;
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

        private void onSelectionChanged() {
            if (isInternalUpdate()) {
                return;
            }

            int minimumIndex = minimum.getSelectionModel().getSelectedIndex();
            int maximumIndex = maximum.getSelectionModel().getSelectedIndex();
            if (minimumIndex > maximumIndex && minimumIndex >= 0) {
                runInternalUpdate(() -> maximum.getSelectionModel().select(minimumIndex));
            }
            if (onChange != null) {
                onChange.run();
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

        private final String label;
        private final AnchoredPopupView popup = new AnchoredPopupView();
        private final VBox checkboxList = new VBox(2);
        private final Set<String> selectedValues = new LinkedHashSet<>();
        private final Runnable onChange;
        private final List<CheckBox> checkboxes = new java.util.ArrayList<>();

        private int internalUpdateDepth;

        SearchableFilterButton(String label, Runnable onChange) {
            this.label = label;
            this.onChange = onChange;
            getStyleClass().addAll(STYLE_COMPACT, STYLE_TRIGGER);
            setText(label + " ▾");
            setAccessibleText(label + " geschlossen");
            setOnAction(event -> togglePopup());
        }

        void setOptions(List<String> options) {
            checkboxes.clear();
            checkboxList.getChildren().clear();

            VBox popupContent = new VBox(4);
            popupContent.getStyleClass().add(STYLE_DROPDOWN);
            popupContent.setPadding(new Insets(8));

            List<String> safeOptions = options == null ? List.of() : List.copyOf(options);
            selectedValues.retainAll(safeOptions);
            maybeAddSearchField(popupContent, safeOptions);

            for (String option : safeOptions) {
                addOptionCheckbox(option);
            }

            ScrollPane scroll = new ScrollPane(checkboxList);
            scroll.setFitToWidth(true);
            scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
            scroll.setMaxHeight(280);
            scroll.setPrefWidth(200);
            scroll.setMinWidth(160);
            popupContent.getChildren().add(scroll);
            popup.setContent(popupContent);
            updateTriggerText();
        }

        List<String> selectedValues() {
            return List.copyOf(selectedValues);
        }

        void removeValue(String value) {
            if (selectedValues.remove(value)) {
                syncCheckboxSelection();
                updateTriggerText();
            }
        }

        void setSelectedValues(List<String> values) {
            selectedValues.clear();
            if (values != null) {
                selectedValues.addAll(values);
            }
            syncCheckboxSelection();
            updateTriggerText();
        }

        void clearSelection() {
            if (!selectedValues.isEmpty()) {
                selectedValues.clear();
                syncCheckboxSelection();
            }
            updateTriggerText();
        }

        private void addOptionCheckbox(String option) {
            CheckBox checkbox = new CheckBox(option);
            checkbox.setSelected(selectedValues.contains(option));
            checkbox.selectedProperty().addListener((obs, wasSelected, isSelected) ->
                    updateSelection(option, isSelected));
            checkboxes.add(checkbox);
            checkboxList.getChildren().add(checkbox);
        }

        private void maybeAddSearchField(VBox popupContent, List<String> options) {
            if (options.size() <= SEARCH_FIELD_THRESHOLD) {
                return;
            }
            TextField search = new TextField();
            search.setPromptText(label + " suchen...");
            search.getStyleClass().add(STYLE_TEXT_FIELD);
            search.textProperty().addListener((obs, oldValue, newValue) -> filterCheckboxes(newValue));
            popupContent.getChildren().add(search);
        }

        private void togglePopup() {
            if (popup.isShowing()) {
                popup.hide();
                setAccessibleText(label + " geschlossen");
                return;
            }
            popup.showBelow(this);
            setAccessibleText(label + " geöffnet - Escape zum Schließen");
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
            if (onChange != null) {
                onChange.run();
            }
        }

        private void syncCheckboxSelection() {
            runInternalUpdate(() -> {
                for (CheckBox checkbox : checkboxes) {
                    checkbox.setSelected(selectedValues.contains(checkbox.getText()));
                }
            });
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
            if (!popup.isShowing()) {
                setAccessibleText(getText());
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
