package clean.creatures.filterpane;

import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.filterpane.input.ComposeFilterpaneInput;
import javafx.animation.PauseTransition;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.util.Duration;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Reusable clean creature filter controls mirroring the legacy creature filter pane.
 */
public final class FilterpaneObject {

    private final ComposeFilterpaneInput.FilterpaneInput filterpane;

    public FilterpaneObject(ComposeFilterpaneInput input) {
        ComposeFilterpaneInput resolvedInput = Objects.requireNonNull(input, "input");
        this.filterpane = new FilterpaneAssembly(resolvedInput).composeFilterpane();
    }

    public ComposeFilterpaneInput.FilterpaneInput composeFilterpane(ComposeFilterpaneInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return filterpane;
    }

    private static final class FilterpaneAssembly {
        private static final int SEARCH_FIELD_THRESHOLD = 6;

        private final ComposeFilterpaneInput input;
        private final TextField searchField = new TextField();
        private final FlowPane filterRow = new FlowPane(4, 4);
        private final FlowPane chipsPane = new FlowPane(4, 2);
        private final ComboBox<String> crMinBox = new ComboBox<>();
        private final ComboBox<String> crMaxBox = new ComboBox<>();
        private final List<String> crValues;
        private final MultiSelectFilter sizeFilter;
        private final MultiSelectFilter typeFilter;
        private final MultiSelectFilter subtypeFilter;
        private final MultiSelectFilter biomeFilter;
        private final MultiSelectFilter alignFilter;
        private boolean updatingCrRange;

        private FilterpaneAssembly(ComposeFilterpaneInput input) {
            this.input = input;
            ComposeCatalogInput.LoadedFilterOptionsInput filterOptions = input.filterOptions();
            this.crValues = filterOptions == null || filterOptions.crValues() == null
                    ? List.of()
                    : List.copyOf(filterOptions.crValues());
            this.sizeFilter = new MultiSelectFilter(
                    "Größe",
                    "chip-size",
                    safeValues(filterOptions == null ? null : filterOptions.sizes())
            );
            this.typeFilter = new MultiSelectFilter(
                    "Typ",
                    "chip-type",
                    safeValues(filterOptions == null ? null : filterOptions.types())
            );
            this.subtypeFilter = new MultiSelectFilter(
                    "Unterart",
                    "chip-subtype",
                    safeValues(filterOptions == null ? null : filterOptions.subtypes())
            );
            this.biomeFilter = new MultiSelectFilter(
                    "Umgebung",
                    "chip-biome",
                    safeValues(filterOptions == null ? null : filterOptions.biomes())
            );
            this.alignFilter = new MultiSelectFilter(
                    "Gesinnung",
                    "chip-align",
                    safeValues(filterOptions == null ? null : filterOptions.alignments())
            );
        }

        private ComposeFilterpaneInput.FilterpaneInput composeFilterpane() {
            configureSearchField();
            configureCrRange();
            VBox controlsContent = createControlsContent();
            rebuildChips();
            return new ComposeFilterpaneInput.FilterpaneInput(controlsContent);
        }

        private void configureSearchField() {
            searchField.setPromptText("Monster suchen...");
            searchField.setMaxWidth(Double.MAX_VALUE);
            PauseTransition debounce = new PauseTransition(Duration.millis(300));
            debounce.setOnFinished(event -> fireChange());
            searchField.textProperty().addListener((observable, oldValue, newValue) -> debounce.playFromStart());
        }

        private void configureCrRange() {
            crMinBox.setItems(FXCollections.observableArrayList(crValues));
            crMaxBox.setItems(FXCollections.observableArrayList(crValues));
            crMinBox.setPrefWidth(65);
            crMaxBox.setPrefWidth(65);
            crMinBox.setAccessibleText("Minimaler CR");
            crMaxBox.setAccessibleText("Maximaler CR");
            resetCrRange();
            crMinBox.setOnAction(event -> onCrSelectionChanged());
            crMaxBox.setOnAction(event -> onCrSelectionChanged());
        }

        private VBox createControlsContent() {
            Button clearButton = new Button("Leeren");
            clearButton.getStyleClass().addAll("compact", "flat");
            clearButton.setOnAction(event -> clearAll());

            HBox searchRow = new HBox(6, searchField);
            HBox.setHgrow(searchField, Priority.ALWAYS);

            filterRow.getChildren().setAll(
                    createCrRangeControl(),
                    sizeFilter.trigger(),
                    typeFilter.trigger(),
                    subtypeFilter.trigger(),
                    biomeFilter.trigger(),
                    alignFilter.trigger(),
                    clearButton
            );

            chipsPane.setMinHeight(24);
            filterRow.prefWrapLengthProperty().bind(searchField.widthProperty());
            chipsPane.prefWrapLengthProperty().bind(searchField.widthProperty());

            VBox container = new VBox(4, searchRow, filterRow, chipsPane);
            container.getStyleClass().add("filter-pane");
            container.setPadding(new Insets(6, 8, 6, 8));
            return container;
        }

        private HBox createCrRangeControl() {
            Label crLabel = new Label("CR");
            crLabel.getStyleClass().addAll("text-muted", "bold");
            crLabel.setMinWidth(20);

            Label dash = new Label("-");
            dash.getStyleClass().add("text-muted");

            return new HBox(2, crLabel, crMinBox, dash, crMaxBox);
        }

        private void onCrSelectionChanged() {
            if (updatingCrRange || crValues.isEmpty()) {
                return;
            }
            int minIndex = crMinBox.getSelectionModel().getSelectedIndex();
            int maxIndex = crMaxBox.getSelectionModel().getSelectedIndex();
            if (minIndex > maxIndex) {
                withSuppressedCrCallback(() -> crMaxBox.getSelectionModel().select(minIndex));
            }
            fireChange();
        }

        private void withSuppressedCrCallback(Runnable action) {
            updatingCrRange = true;
            try {
                action.run();
            } finally {
                updatingCrRange = false;
            }
        }

        private void resetCrRange() {
            withSuppressedCrCallback(() -> {
                if (crValues.isEmpty()) {
                    crMinBox.getSelectionModel().clearSelection();
                    crMaxBox.getSelectionModel().clearSelection();
                    return;
                }
                crMinBox.getSelectionModel().selectFirst();
                crMaxBox.getSelectionModel().selectLast();
            });
        }

        private String selectedCrMin() {
            if (crValues.isEmpty()) {
                return null;
            }
            int index = crMinBox.getSelectionModel().getSelectedIndex();
            return index > 0 ? crMinBox.getValue() : null;
        }

        private String selectedCrMax() {
            if (crValues.isEmpty()) {
                return null;
            }
            int index = crMaxBox.getSelectionModel().getSelectedIndex();
            return index >= 0 && index < crValues.size() - 1 ? crMaxBox.getValue() : null;
        }

        private String fallbackCrMin() {
            return crValues.isEmpty() ? "0" : crValues.getFirst();
        }

        private String fallbackCrMax() {
            return crValues.isEmpty() ? "30" : crValues.getLast();
        }

        private void clearAll() {
            searchField.clear();
            resetCrRange();
            sizeFilter.clearSelection();
            typeFilter.clearSelection();
            subtypeFilter.clearSelection();
            biomeFilter.clearSelection();
            alignFilter.clearSelection();
            fireChange();
        }

        private void fireChange() {
            rebuildChips();
            if (input.onCriteriaChanged() != null) {
                input.onCriteriaChanged().accept(buildCriteria());
            }
        }

        private ComposeCatalogInput.CriteriaInput buildCriteria() {
            String nameQuery = searchField.getText() == null ? null : searchField.getText().trim();
            if (nameQuery != null && nameQuery.isBlank()) {
                nameQuery = null;
            }
            return new ComposeCatalogInput.CriteriaInput(
                    nameQuery,
                    selectedCrMin(),
                    selectedCrMax(),
                    sizeFilter.selectedValues(),
                    typeFilter.selectedValues(),
                    subtypeFilter.selectedValues(),
                    biomeFilter.selectedValues(),
                    alignFilter.selectedValues()
            );
        }

        private void rebuildChips() {
            ComposeCatalogInput.CriteriaInput criteria = buildCriteria();
            chipsPane.getChildren().clear();
            if (criteria.crMin() != null || criteria.crMax() != null) {
                String label = "CR: " + (criteria.crMin() == null ? fallbackCrMin() : criteria.crMin())
                        + "-" + (criteria.crMax() == null ? fallbackCrMax() : criteria.crMax());
                chipsPane.getChildren().add(createChip(label, "chip-cr", () -> {
                    resetCrRange();
                    fireChange();
                }));
            }
            addFilterChips(sizeFilter);
            addFilterChips(typeFilter);
            addFilterChips(subtypeFilter);
            addFilterChips(biomeFilter);
            addFilterChips(alignFilter);
            if (input.externalChipSource() != null) {
                List<Node> extraChips = input.externalChipSource().get();
                if (extraChips != null && !extraChips.isEmpty()) {
                    chipsPane.getChildren().addAll(extraChips);
                }
            }
        }

        private void addFilterChips(MultiSelectFilter filter) {
            for (String value : filter.selectedValues()) {
                chipsPane.getChildren().add(createChip(value, filter.chipStyleClass(), () -> {
                    filter.removeValue(value);
                    fireChange();
                }));
            }
        }

        private HBox createChip(String text, String styleClass, Runnable onRemove) {
            HBox chip = new HBox(2);
            chip.getStyleClass().addAll("chip", styleClass);
            Label label = new Label(text);
            Button removeButton = new Button("×");
            removeButton.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
            removeButton.setAccessibleText("Entfernen: " + text);
            removeButton.setOnAction(event -> onRemove.run());
            chip.getChildren().addAll(label, removeButton);
            return chip;
        }

        private static void updateTriggerState(Button trigger, boolean active) {
            if (active) {
                if (!trigger.getStyleClass().contains("filter-trigger-active")) {
                    trigger.getStyleClass().add("filter-trigger-active");
                }
            } else {
                trigger.getStyleClass().remove("filter-trigger-active");
            }
        }

        private static List<String> safeValues(List<String> values) {
            if (values == null || values.isEmpty()) {
                return List.of();
            }
            return values.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .distinct()
                    .toList();
        }

        private final class MultiSelectFilter {
            private final String title;
            private final String chipStyleClass;
            private final Set<String> selectedValues = new LinkedHashSet<>();
            private final Button trigger = new Button();
            private final Popup popup = new Popup();
            private final List<CheckBox> checkBoxes = new ArrayList<>();

            private MultiSelectFilter(String title, String chipStyleClass, List<String> values) {
                this.title = title;
                this.chipStyleClass = chipStyleClass;

                trigger.getStyleClass().addAll("compact", "filter-trigger");
                trigger.setOnAction(event -> togglePopup());

                VBox popupContent = new VBox(4);
                popupContent.getStyleClass().add("filter-dropdown");

                if (values.size() > SEARCH_FIELD_THRESHOLD) {
                    TextField popupSearchField = new TextField();
                    popupSearchField.setPromptText(title + " suchen...");
                    popupSearchField.getStyleClass().add("quick-search-field");
                    popupSearchField.textProperty().addListener((observable, oldValue, newValue) ->
                            filterCheckboxes(newValue));
                    popupContent.getChildren().add(popupSearchField);
                    popup.setOnShown(event -> Platform.runLater(popupSearchField::requestFocus));
                }

                VBox checkboxList = new VBox(2);
                for (String value : values) {
                    CheckBox checkBox = new CheckBox(value);
                    checkBox.setOnAction(event -> {
                        if (checkBox.isSelected()) {
                            selectedValues.add(value);
                        } else {
                            selectedValues.remove(value);
                        }
                        refreshState();
                        fireChange();
                    });
                    checkBoxes.add(checkBox);
                    checkboxList.getChildren().add(checkBox);
                }

                ScrollPane scrollPane = new ScrollPane(checkboxList);
                scrollPane.setFitToWidth(true);
                scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
                scrollPane.setMaxHeight(280);
                scrollPane.setPrefWidth(200);
                scrollPane.setMinWidth(160);

                popupContent.getChildren().add(scrollPane);

                popup.setAutoHide(true);
                popup.getContent().add(popupContent);
                popup.addEventFilter(KeyEvent.KEY_PRESSED, event -> {
                    if (event.getCode() == KeyCode.ESCAPE) {
                        popup.hide();
                        trigger.requestFocus();
                        event.consume();
                    }
                });

                refreshState();
            }

            private void togglePopup() {
                if (popup.isShowing()) {
                    popup.hide();
                    return;
                }
                Bounds bounds = trigger.localToScreen(trigger.getBoundsInLocal());
                if (bounds != null) {
                    popup.show(trigger, bounds.getMinX(), bounds.getMaxY() + 2);
                }
            }

            private void filterCheckboxes(String query) {
                String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
                for (CheckBox checkBox : checkBoxes) {
                    boolean visible = normalizedQuery.isEmpty()
                            || checkBox.getText().toLowerCase().contains(normalizedQuery);
                    checkBox.setVisible(visible);
                    checkBox.setManaged(visible);
                }
            }

            private Button trigger() {
                return trigger;
            }

            private String chipStyleClass() {
                return chipStyleClass;
            }

            private List<String> selectedValues() {
                return List.copyOf(selectedValues);
            }

            private void clearSelection() {
                selectedValues.clear();
                for (CheckBox checkBox : checkBoxes) {
                    checkBox.setSelected(false);
                }
                refreshState();
            }

            private void removeValue(String value) {
                selectedValues.remove(value);
                for (CheckBox checkBox : checkBoxes) {
                    if (value.equals(checkBox.getText())) {
                        checkBox.setSelected(false);
                        break;
                    }
                }
                refreshState();
            }

            private void refreshState() {
                int count = selectedValues.size();
                trigger.setText(count > 0 ? title + " (" + count + ") ▼" : title + " ▼");
                updateTriggerState(trigger, count > 0);
            }
        }
    }
}
