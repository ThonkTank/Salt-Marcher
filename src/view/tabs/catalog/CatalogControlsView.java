package src.view.tabs.catalog;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.animation.PauseTransition;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.FXCollections;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.util.Duration;
import org.jspecify.annotations.Nullable;

public final class CatalogControlsView extends VBox {

    private final ToggleGroup contentGroup = new ToggleGroup();
    private final FlowPane contentRow = new FlowPane(4, 4);
    private final TextField searchField = new TextField();
    private final CrRangeSelector crRange = new CrRangeSelector(this::fireFilterChanged);
    private final SearchableFilterButton sizeFilter = new SearchableFilterButton("Größe", this::fireFilterChanged);
    private final SearchableFilterButton typeFilter = new SearchableFilterButton("Typ", this::fireFilterChanged);
    private final SearchableFilterButton subtypeFilter = new SearchableFilterButton("Unterart", this::fireFilterChanged);
    private final SearchableFilterButton biomeFilter = new SearchableFilterButton("Umgebung", this::fireFilterChanged);
    private final SearchableFilterButton alignmentFilter = new SearchableFilterButton("Gesinnung", this::fireFilterChanged);
    private final FlowPane filterRow = new FlowPane(4, 4);
    private final FlowPane chipsPane = new FlowPane(4, 2);
    private final ComboBox<SortSelection> sortCombo = new ComboBox<>();
    private final Label countLabel = new Label("0 Monster gefunden");
    private final Label pageLabel = new Label("Seite 1 / 1");
    private final Button previousButton = new Button("◀ Zurück");
    private final Button nextButton = new Button("Weiter ▶");
    private final PauseTransition debounce = new PauseTransition(Duration.millis(300));

    private @Nullable Consumer<String> contentSelectionHandler;
    private @Nullable Consumer<CreatureFilterState> filterChangedHandler;
    private @Nullable Consumer<String> sortChangedHandler;
    private @Nullable Runnable previousPageHandler;
    private @Nullable Runnable nextPageHandler;
    private boolean suppressFilterEvents;

    public CatalogControlsView() {
        getStyleClass().add("surface-root");
        setSpacing(10);
        setPadding(new Insets(8));

        Label title = new Label("Catalog");
        title.getStyleClass().add("panel-title");

        searchField.setPromptText("Monster suchen...");
        searchField.setMaxWidth(Double.MAX_VALUE);
        debounce.setOnFinished(event -> fireFilterChanged());
        searchField.textProperty().addListener((obs, oldValue, newValue) -> debounce.playFromStart());

        HBox searchRow = new HBox(6, searchField);
        HBox.setHgrow(searchField, Priority.ALWAYS);

        Button clearButton = new Button("Leeren");
        clearButton.getStyleClass().addAll("compact", "flat");
        clearButton.setOnAction(event -> clearFilters());
        filterRow.getChildren().addAll(
                crRange,
                sizeFilter,
                typeFilter,
                subtypeFilter,
                biomeFilter,
                alignmentFilter,
                clearButton);
        filterRow.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.prefWrapLengthProperty().bind(widthProperty().subtract(16));
        chipsPane.setMinHeight(24);

        sortCombo.setMaxWidth(Double.MAX_VALUE);
        sortCombo.setOnAction(event -> {
            SortSelection selection = sortCombo.getValue();
            if (selection != null && sortChangedHandler != null) {
                sortChangedHandler.accept(selection.key());
            }
        });

        HBox pagination = new HBox(8, previousButton, pageLabel, nextButton);
        pagination.setAlignment(Pos.CENTER_LEFT);
        previousButton.getStyleClass().add("compact");
        nextButton.getStyleClass().add("compact");
        previousButton.setOnAction(event -> {
            if (previousPageHandler != null) {
                previousPageHandler.run();
            }
        });
        nextButton.setOnAction(event -> {
            if (nextPageHandler != null) {
                nextPageHandler.run();
            }
        });

        Label sortLabel = new Label("Sortierung");
        sortLabel.getStyleClass().add("text-muted");
        countLabel.getStyleClass().add("text-secondary");
        pageLabel.getStyleClass().add("text-secondary");

        getChildren().addAll(
                title,
                contentRow,
                searchRow,
                filterRow,
                chipsPane,
                sortLabel,
                sortCombo,
                countLabel,
                pagination);
    }

    public void setContents(List<ContentItem> contents) {
        contentRow.getChildren().clear();
        for (ContentItem content : contents == null ? List.<ContentItem>of() : contents) {
            ToggleButton button = new ToggleButton(content.label());
            button.getStyleClass().addAll("compact", "filter-trigger");
            button.setUserData(content.key());
            button.setToggleGroup(contentGroup);
            button.setDisable(!content.enabled());
            button.setOnAction(event -> {
                if (contentSelectionHandler != null) {
                    contentSelectionHandler.accept(String.valueOf(button.getUserData()));
                }
            });
            contentRow.getChildren().add(button);
        }
    }

    public void selectContent(String key) {
        for (ToggleButton button : contentButtons()) {
            if (Objects.equals(button.getUserData(), key)) {
                button.setSelected(true);
                return;
            }
        }
    }

    public void setCreatureFilterData(CreatureFilterData data) {
        CreatureFilterData safeData = data == null ? CreatureFilterData.empty() : data;
        suppressFilterEvents = true;
        try {
            crRange.setValues(safeData.challengeRatings());
            sizeFilter.setOptions(safeData.sizes());
            typeFilter.setOptions(safeData.types());
            subtypeFilter.setOptions(safeData.subtypes());
            biomeFilter.setOptions(safeData.biomes());
            alignmentFilter.setOptions(safeData.alignments());
        } finally {
            suppressFilterEvents = false;
        }
    }

    public void setSortOptions(List<SortSelection> selections) {
        sortCombo.setItems(FXCollections.observableArrayList(selections == null ? List.of() : selections));
    }

    public void selectSort(String key) {
        for (SortSelection selection : sortCombo.getItems()) {
            if (selection.key().equals(key)) {
                sortCombo.getSelectionModel().select(selection);
                return;
            }
        }
    }

    public StringProperty countTextProperty() {
        return countLabel.textProperty();
    }

    public StringProperty pageTextProperty() {
        return pageLabel.textProperty();
    }

    public BooleanProperty previousDisableProperty() {
        return previousButton.disableProperty();
    }

    public BooleanProperty nextDisableProperty() {
        return nextButton.disableProperty();
    }

    public void setChips(List<FilterChipView> chips) {
        chipsPane.getChildren().clear();
        for (FilterChipView chip : chips == null ? List.<FilterChipView>of() : chips) {
            HBox chipNode = new HBox(2);
            chipNode.getStyleClass().addAll("chip", chip.styleClass());
            Label label = new Label(chip.label());
            Button remove = new Button("×");
            remove.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
            remove.setAccessibleText("Entfernen: " + chip.label());
            remove.setOnAction(event -> clearChip(chip.key()));
            chipNode.getChildren().addAll(label, remove);
            chipsPane.getChildren().add(chipNode);
        }
    }

    public void setOnContentSelected(Consumer<String> handler) {
        contentSelectionHandler = handler;
    }

    public void setOnCreatureFiltersChanged(Consumer<CreatureFilterState> handler) {
        filterChangedHandler = handler;
    }

    public void setOnSortChanged(Consumer<String> handler) {
        sortChangedHandler = handler;
    }

    public void setOnPreviousPage(Runnable handler) {
        previousPageHandler = handler;
    }

    public void setOnNextPage(Runnable handler) {
        nextPageHandler = handler;
    }

    private void clearFilters() {
        suppressFilterEvents = true;
        try {
            searchField.setText("");
            crRange.reset();
            sizeFilter.clearSelection();
            typeFilter.clearSelection();
            subtypeFilter.clearSelection();
            biomeFilter.clearSelection();
            alignmentFilter.clearSelection();
        } finally {
            suppressFilterEvents = false;
        }
        fireFilterChanged();
    }

    private void clearChip(String key) {
        if ("search".equals(key)) {
            searchField.setText("");
        } else if ("cr".equals(key)) {
            crRange.reset();
        } else if (key.startsWith("size:")) {
            sizeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("type:")) {
            typeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("subtype:")) {
            subtypeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("biome:")) {
            biomeFilter.removeValue(valuePart(key));
        } else if (key.startsWith("alignment:")) {
            alignmentFilter.removeValue(valuePart(key));
        }
        fireFilterChanged();
    }

    private void fireFilterChanged() {
        if (suppressFilterEvents || filterChangedHandler == null) {
            return;
        }
        filterChangedHandler.accept(buildFilterState());
    }

    private CreatureFilterState buildFilterState() {
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

    private List<ToggleButton> contentButtons() {
        return contentRow.getChildren().stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .toList();
    }

    private static String valuePart(String key) {
        int separator = key.indexOf(':');
        return separator < 0 ? key : key.substring(separator + 1);
    }

    private static @Nullable String normalized(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record ContentItem(String key, String label, boolean enabled) {
    }

    public record SortSelection(String key, String label) {
        @Override
        public String toString() {
            return label;
        }
    }

    public record CreatureFilterData(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<String> challengeRatings
    ) {
        public CreatureFilterData {
            sizes = copyOf(sizes);
            types = copyOf(types);
            subtypes = copyOf(subtypes);
            biomes = copyOf(biomes);
            alignments = copyOf(alignments);
            challengeRatings = copyOf(challengeRatings);
        }

        static CreatureFilterData empty() {
            return new CreatureFilterData(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record CreatureFilterState(
            @Nullable String nameQuery,
            @Nullable String challengeRatingMin,
            @Nullable String challengeRatingMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        public CreatureFilterState {
            sizes = copyOf(sizes);
            types = copyOf(types);
            subtypes = copyOf(subtypes);
            biomes = copyOf(biomes);
            alignments = copyOf(alignments);
        }
    }

    public record FilterChipView(String key, String label, String styleClass) {
    }

    private static List<String> copyOf(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static final class CrRangeSelector extends HBox {

        private final ComboBox<String> minimum = new ComboBox<>();
        private final ComboBox<String> maximum = new ComboBox<>();
        private final Runnable onChange;
        private boolean updating;

        CrRangeSelector(Runnable onChange) {
            this.onChange = onChange;
            setSpacing(2);
            Label crLabel = new Label("CR");
            crLabel.getStyleClass().addAll("text-muted", "bold");
            minimum.setAccessibleText("Minimaler CR");
            maximum.setAccessibleText("Maximaler CR");
            minimum.setPrefWidth(65);
            maximum.setPrefWidth(65);
            Label dash = new Label("-");
            dash.getStyleClass().add("text-muted");
            minimum.setOnAction(event -> onSelectionChanged());
            maximum.setOnAction(event -> onSelectionChanged());
            getChildren().addAll(crLabel, minimum, dash, maximum);
        }

        void setValues(List<String> values) {
            List<String> safeValues = values == null || values.isEmpty() ? List.of("0", "30") : List.copyOf(values);
            updating = true;
            try {
                minimum.setItems(FXCollections.observableArrayList(safeValues));
                maximum.setItems(FXCollections.observableArrayList(safeValues));
                minimum.getSelectionModel().selectFirst();
                maximum.getSelectionModel().selectLast();
            } finally {
                updating = false;
            }
        }

        @Nullable String minimumFilterValue() {
            int index = minimum.getSelectionModel().getSelectedIndex();
            return index > 0 ? minimum.getValue() : null;
        }

        @Nullable String maximumFilterValue() {
            int index = maximum.getSelectionModel().getSelectedIndex();
            int last = maximum.getItems().size() - 1;
            return index >= 0 && index < last ? maximum.getValue() : null;
        }

        void reset() {
            updating = true;
            try {
                minimum.getSelectionModel().selectFirst();
                maximum.getSelectionModel().selectLast();
            } finally {
                updating = false;
            }
        }

        private void onSelectionChanged() {
            if (updating) {
                return;
            }
            int minIndex = minimum.getSelectionModel().getSelectedIndex();
            int maxIndex = maximum.getSelectionModel().getSelectedIndex();
            if (minIndex > maxIndex && minIndex >= 0) {
                updating = true;
                try {
                    maximum.getSelectionModel().select(minIndex);
                } finally {
                    updating = false;
                }
            }
            if (onChange != null) {
                onChange.run();
            }
        }
    }

    private static final class SearchableFilterButton extends Button {

        private static final int SEARCH_FIELD_THRESHOLD = 6;

        private final String label;
        private final Popup popup = new Popup();
        private final VBox checkboxList = new VBox(2);
        private final List<CheckBox> checkboxes = new ArrayList<>();
        private final Runnable onChange;

        SearchableFilterButton(String label, Runnable onChange) {
            this.label = label;
            this.onChange = onChange;
            getStyleClass().addAll("compact", "filter-trigger");
            setText(label + " ▾");
            setAccessibleText(label + " geschlossen");
            setOnAction(event -> togglePopup());
            popup.setAutoHide(true);
        }

        void setOptions(List<String> options) {
            checkboxes.clear();
            checkboxList.getChildren().clear();
            VBox popupContent = new VBox(4);
            popupContent.getStyleClass().add("filter-dropdown");
            popupContent.setPadding(new Insets(8));
            List<String> safeOptions = options == null ? List.of() : List.copyOf(options);
            if (safeOptions.size() > SEARCH_FIELD_THRESHOLD) {
                TextField search = new TextField();
                search.setPromptText(label + " suchen...");
                search.textProperty().addListener((obs, oldValue, newValue) -> filterCheckboxes(newValue));
                popupContent.getChildren().add(search);
            }
            for (String option : safeOptions) {
                CheckBox checkbox = new CheckBox(option);
                checkbox.setOnAction(event -> {
                    updateTriggerText();
                    if (onChange != null) {
                        onChange.run();
                    }
                });
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
            popup.getContent().setAll(popupContent);
            popup.addEventFilter(KeyEvent.KEY_PRESSED, this::handlePopupKey);
            updateTriggerText();
        }

        List<String> selectedValues() {
            return checkboxes.stream()
                    .filter(CheckBox::isSelected)
                    .map(CheckBox::getText)
                    .toList();
        }

        void removeValue(String value) {
            for (CheckBox checkbox : checkboxes) {
                if (checkbox.getText().equals(value)) {
                    checkbox.setSelected(false);
                    updateTriggerText();
                    return;
                }
            }
        }

        void clearSelection() {
            for (CheckBox checkbox : checkboxes) {
                checkbox.setSelected(false);
            }
            updateTriggerText();
        }

        private void togglePopup() {
            if (popup.isShowing()) {
                popup.hide();
                setAccessibleText(label + " geschlossen");
                return;
            }
            Bounds bounds = localToScreen(getBoundsInLocal());
            if (bounds != null) {
                popup.show(this, bounds.getMinX(), bounds.getMaxY() + 2);
                setAccessibleText(label + " geöffnet - Escape zum Schließen");
            }
        }

        private void handlePopupKey(KeyEvent event) {
            if (event.getCode() == KeyCode.ESCAPE) {
                popup.hide();
                requestFocus();
                event.consume();
            }
        }

        private void filterCheckboxes(@Nullable String query) {
            String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
            for (CheckBox checkbox : checkboxes) {
                boolean visible = normalized.isEmpty()
                        || checkbox.getText().toLowerCase(Locale.ROOT).contains(normalized);
                checkbox.setVisible(visible);
                checkbox.setManaged(visible);
            }
        }

        private void updateTriggerText() {
            long count = checkboxes.stream().filter(CheckBox::isSelected).count();
            getStyleClass().remove("filter-trigger-active");
            if (count > 0) {
                setText(label + " (" + count + ") ▾");
                getStyleClass().add("filter-trigger-active");
            } else {
                setText(label + " ▾");
            }
            if (!popup.isShowing()) {
                setAccessibleText(getText());
            }
        }
    }
}
