package clean.creatures.filterpane;

import clean.creatures.catalog.input.ComposeCatalogInput;
import clean.creatures.filterpane.input.ComposeFilterpaneInput;
import javafx.animation.PauseTransition;
import javafx.collections.FXCollections;
import javafx.geometry.Insets;
import javafx.geometry.Side;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Reusable clean creature filter controls mirroring the legacy creature filter pane.
 */
@SuppressWarnings("unused")
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
        private final ComposeFilterpaneInput input;
        private final TextField searchField = new TextField();
        private final FlowPane filterRow = new FlowPane(4, 4);
        private final FlowPane chipsPane = new FlowPane(4, 2);
        private final Button crTrigger = new Button("CR");
        private final List<String> crValues;
        private final MultiSelectFilter sizeFilter;
        private final MultiSelectFilter typeFilter;
        private final MultiSelectFilter subtypeFilter;
        private final MultiSelectFilter biomeFilter;
        private final MultiSelectFilter alignFilter;
        private String crMin;
        private String crMax;

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
            configureCrTrigger();
            VBox controlsContent = createControlsContent();
            rebuildChips();
            return new ComposeFilterpaneInput.FilterpaneInput(controlsContent);
        }

        private void configureSearchField() {
            searchField.setPromptText("Monster suchen...");
            PauseTransition debounce = new PauseTransition(Duration.millis(300));
            debounce.setOnFinished(event -> fireChange());
            searchField.textProperty().addListener((observable, oldValue, newValue) -> debounce.playFromStart());
        }

        private void configureCrTrigger() {
            crTrigger.getStyleClass().add("filter-trigger");
            crTrigger.setOnAction(event -> showCrMenu());
            refreshCrTriggerState();
        }

        private VBox createControlsContent() {
            Button clearButton = new Button("Leeren");
            clearButton.getStyleClass().addAll("button", "compact", "flat");
            clearButton.setOnAction(event -> clearAll());

            HBox searchRow = new HBox(6, searchField);
            HBox.setHgrow(searchField, Priority.ALWAYS);

            filterRow.getChildren().setAll(
                    crTrigger,
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

        private void showCrMenu() {
            ContextMenu menu = new ContextMenu();
            menu.setAutoHide(true);

            ComboBox<String> minBox = new ComboBox<>(FXCollections.observableArrayList(crValues));
            ComboBox<String> maxBox = new ComboBox<>(FXCollections.observableArrayList(crValues));
            minBox.setMaxWidth(Double.MAX_VALUE);
            maxBox.setMaxWidth(Double.MAX_VALUE);

            if (!crValues.isEmpty()) {
                minBox.getSelectionModel().select(crMin == null ? 0 : crValues.indexOf(crMin));
                maxBox.getSelectionModel().select(crMax == null ? crValues.size() - 1 : crValues.indexOf(crMax));
            }

            Button applyButton = new Button("Anwenden");
            applyButton.getStyleClass().addAll("button", "compact", "accent");
            applyButton.setOnAction(event -> {
                updateCrBounds(minBox.getValue(), maxBox.getValue());
                menu.hide();
                fireChange();
            });

            Button clearButton = new Button("Leeren");
            clearButton.getStyleClass().addAll("button", "compact", "flat");
            clearButton.setOnAction(event -> {
                crMin = null;
                crMax = null;
                menu.hide();
                fireChange();
            });

            VBox popup = new VBox(
                    8,
                    createFilterLabel("Minimum"),
                    minBox,
                    createFilterLabel("Maximum"),
                    maxBox,
                    new HBox(6, applyButton, clearButton)
            );
            popup.getStyleClass().add("filter-dropdown");

            CustomMenuItem content = new CustomMenuItem(popup, false);
            menu.getItems().setAll(content);
            menu.show(crTrigger, Side.BOTTOM, 0, 0);
        }

        private void updateCrBounds(String selectedMin, String selectedMax) {
            if (crValues.isEmpty()) {
                crMin = null;
                crMax = null;
                refreshCrTriggerState();
                return;
            }

            int minIndex = selectedMin == null ? 0 : Math.max(0, crValues.indexOf(selectedMin));
            int maxIndex = selectedMax == null ? crValues.size() - 1 : Math.max(0, crValues.indexOf(selectedMax));
            if (minIndex > maxIndex) {
                int swap = minIndex;
                minIndex = maxIndex;
                maxIndex = swap;
            }

            crMin = minIndex <= 0 ? null : crValues.get(minIndex);
            crMax = maxIndex >= crValues.size() - 1 ? null : crValues.get(maxIndex);
            refreshCrTriggerState();
        }

        private void refreshCrTriggerState() {
            crTrigger.setText(buildCrTriggerText());
            updateTriggerState(crTrigger, crMin != null || crMax != null);
        }

        private String buildCrTriggerText() {
            if (crMin == null && crMax == null) {
                return "CR";
            }
            String min = crMin == null ? fallbackCrMin() : crMin;
            String max = crMax == null ? fallbackCrMax() : crMax;
            return "CR: " + min + "-" + max;
        }

        private String fallbackCrMin() {
            return crValues.isEmpty() ? "0" : crValues.getFirst();
        }

        private String fallbackCrMax() {
            return crValues.isEmpty() ? "30" : crValues.getLast();
        }

        private void clearAll() {
            searchField.clear();
            crMin = null;
            crMax = null;
            refreshCrTriggerState();
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
                    crMin,
                    crMax,
                    sizeFilter.selectedValues(),
                    typeFilter.selectedValues(),
                    subtypeFilter.selectedValues(),
                    biomeFilter.selectedValues(),
                    alignFilter.selectedValues()
            );
        }

        private void rebuildChips() {
            chipsPane.getChildren().clear();
            if (crMin != null || crMax != null) {
                String label = "CR: " + (crMin == null ? fallbackCrMin() : crMin)
                        + "-" + (crMax == null ? fallbackCrMax() : crMax);
                chipsPane.getChildren().add(createChip(label, "chip-cr", () -> {
                    crMin = null;
                    crMax = null;
                    refreshCrTriggerState();
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
            removeButton.getStyleClass().addAll("button", "flat", "compact", "chip-remove-btn");
            removeButton.setAccessibleText("Entfernen: " + text);
            removeButton.setOnAction(event -> onRemove.run());
            chip.getChildren().addAll(label, removeButton);
            return chip;
        }

        private static Label createFilterLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-secondary");
            return label;
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
            private final List<String> values;
            private final Set<String> selectedValues = new LinkedHashSet<>();
            private final Button trigger = new Button();

            private MultiSelectFilter(String title, String chipStyleClass, List<String> values) {
                this.title = title;
                this.chipStyleClass = chipStyleClass;
                this.values = values;
                this.trigger.setText(title);
                this.trigger.getStyleClass().add("filter-trigger");
                this.trigger.setOnAction(event -> showMenu());
            }

            private void showMenu() {
                ContextMenu menu = new ContextMenu();
                menu.setAutoHide(true);

                TextField popupSearchField = new TextField();
                popupSearchField.setPromptText("Suchen...");

                VBox options = new VBox(4);
                ScrollPane scrollPane = new ScrollPane(options);
                scrollPane.setFitToWidth(true);
                scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
                scrollPane.setPrefViewportHeight(180);

                Runnable rebuildOptions = () -> populateOptions(options, popupSearchField.getText());
                popupSearchField.textProperty().addListener((observable, oldValue, newValue) -> rebuildOptions.run());
                rebuildOptions.run();

                Button clearButton = new Button("Leeren");
                clearButton.getStyleClass().addAll("button", "compact", "flat");
                clearButton.setOnAction(event -> {
                    clearSelection();
                    menu.hide();
                    fireChange();
                });

                VBox popup = new VBox(8, popupSearchField, scrollPane, clearButton);
                popup.getStyleClass().add("filter-dropdown");
                popup.setPrefWidth(220);

                CustomMenuItem content = new CustomMenuItem(popup, false);
                menu.getItems().setAll(content);
                menu.show(trigger, Side.BOTTOM, 0, 0);
            }

            private void populateOptions(VBox container, String query) {
                container.getChildren().clear();
                String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
                List<String> visibleValues = values.stream()
                        .filter(value -> normalizedQuery.isEmpty() || value.toLowerCase().contains(normalizedQuery))
                        .toList();
                if (visibleValues.isEmpty()) {
                    Label empty = new Label("Keine Optionen");
                    empty.getStyleClass().add("text-muted");
                    container.getChildren().add(empty);
                    return;
                }

                for (String value : visibleValues) {
                    CheckBox checkBox = new CheckBox(value);
                    checkBox.setSelected(selectedValues.contains(value));
                    checkBox.selectedProperty().addListener((observable, oldValue, newValue) -> {
                        if (newValue) {
                            selectedValues.add(value);
                        } else {
                            selectedValues.remove(value);
                        }
                        refreshState();
                        fireChange();
                    });
                    container.getChildren().add(checkBox);
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
                refreshState();
            }

            private void removeValue(String value) {
                selectedValues.remove(value);
                refreshState();
            }

            private void refreshState() {
                updateTriggerState(trigger, !selectedValues.isEmpty());
                trigger.setText(title);
            }
        }
    }
}
