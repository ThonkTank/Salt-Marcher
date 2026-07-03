package src.view.slotcontent.controls.searchfilter;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.FlowPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class SearchFilterControlsView extends VBox {

    private static final String PROGRAMMATIC_UPDATE_KEY = "searchFilterProgrammaticUpdate";
    private static final int FILTER_GROUP_INDEX = 0;
    private static final int FILTER_OPTION_INDEX = 1;
    private static final int FILTER_TOKEN_LENGTH = 2;

    private final TextField searchField = new TextField();
    private final FlowPane filters = new FlowPane(6, 4);
    private final FlowPane chips = new FlowPane(4, 3);
    private Consumer<SearchFilterControlsViewInputEvent> eventSink = event -> { };

    public SearchFilterControlsView() {
        super(8);
        getStyleClass().add("search-filter-controls");
        searchField.getStyleClass().add("search-filter-field");
        searchField.textProperty().addListener((ignored, before, after) -> publishIfInteractive());
        HBox searchRow = new HBox(6, searchField, clearButton());
        searchRow.getStyleClass().add("search-filter-search-row");
        searchRow.setAlignment(Pos.CENTER_LEFT);
        HBox.setHgrow(searchField, Priority.ALWAYS);
        getChildren().setAll(searchRow, filters, chips);
    }

    public void bind(SearchFilterControlsContentModel contentModel) {
        SearchFilterControlsContentModel safeModel = Objects.requireNonNull(contentModel, "contentModel");
        safeModel.projectionProperty().addListener((ignored, before, after) -> render(after));
        render(safeModel.projectionProperty().get());
    }

    public void onViewInputEvent(Consumer<SearchFilterControlsViewInputEvent> sink) {
        eventSink = sink == null ? event -> { } : sink;
    }

    private Button clearButton() {
        Button button = new Button("Leeren");
        button.getStyleClass().addAll("compact", "flat", "search-filter-clear");
        button.setAccessibleText("Suche und Filter leeren");
        button.setOnAction(event -> clearAll());
        return button;
    }

    private void render(SearchFilterControlsContentModel.Projection projection) {
        runProgrammaticUpdate(() -> {
            searchField.setPromptText(projection.searchPrompt());
            renderFilters(projection.groups());
            renderChips(projection.chips());
            searchField.setText(projection.searchQuery());
        });
    }

    private void renderFilters(List<SearchFilterControlsContentModel.FilterGroup> groups) {
        filters.getChildren().clear();
        for (SearchFilterControlsContentModel.FilterGroup group : groups) {
            if (group.options().isEmpty()) {
                continue;
            }
            filters.getChildren().add(new Label(group.label()));
            for (SearchFilterControlsContentModel.FilterOption option : group.options()) {
                CheckBox checkBox = new CheckBox(option.label());
                checkBox.getStyleClass().add("search-filter-option");
                checkBox.setUserData(new String[] {group.key(), option.key()});
                checkBox.setSelected(option.selected());
                checkBox.selectedProperty().addListener((ignored, before, after) -> publishIfInteractive());
                filters.getChildren().add(checkBox);
            }
        }
    }

    private void renderChips(List<SearchFilterControlsContentModel.FilterChip> filterChips) {
        chips.getChildren().clear();
        for (SearchFilterControlsContentModel.FilterChip chip : filterChips) {
            HBox chipBox = new HBox(2);
            chipBox.getStyleClass().addAll("chip", "chip-type");
            Button remove = new Button("x");
            remove.getStyleClass().addAll("compact", "flat", "chip-remove-btn");
            remove.setAccessibleText("Filter entfernen: " + chip.label());
            remove.setOnAction(event -> clearChip(chip));
            chipBox.getChildren().setAll(new Label(chip.label()), remove);
            chips.getChildren().add(chipBox);
        }
    }

    private void clearAll() {
        runProgrammaticUpdate(() -> {
            searchField.setText("");
            for (Node node : filters.getChildren()) {
                if (node instanceof CheckBox checkBox) {
                    checkBox.setSelected(false);
                }
            }
        });
        publishIfInteractive();
    }

    private void clearChip(SearchFilterControlsContentModel.FilterChip chip) {
        runProgrammaticUpdate(() -> {
            for (Node node : filters.getChildren()) {
                if (node instanceof CheckBox checkBox && chipMatches(chip, checkBox)) {
                    checkBox.setSelected(false);
                }
            }
        });
        publishIfInteractive();
    }

    private void publishIfInteractive() {
        if (Boolean.TRUE.equals(getProperties().get(PROGRAMMATIC_UPDATE_KEY))) {
            return;
        }
        List<SearchFilterControlsViewInputEvent.SelectedFilter> selected = new java.util.ArrayList<>();
        for (Node node : filters.getChildren()) {
            if (node instanceof CheckBox checkBox && checkBox.isSelected()) {
                selected.add(selectedFilter(checkBox));
            }
        }
        eventSink.accept(new SearchFilterControlsViewInputEvent(searchField.getText(), selected));
    }

    private void runProgrammaticUpdate(Runnable update) {
        getProperties().put(PROGRAMMATIC_UPDATE_KEY, Boolean.TRUE);
        try {
            update.run();
        } finally {
            getProperties().remove(PROGRAMMATIC_UPDATE_KEY);
        }
    }

    private static boolean chipMatches(
            SearchFilterControlsContentModel.FilterChip chip,
            CheckBox checkBox
    ) {
        String[] tokenValues = filterTokenValues(checkBox);
        return chip.groupKey().equals(tokenValues[FILTER_GROUP_INDEX])
                && chip.optionKey().equals(tokenValues[FILTER_OPTION_INDEX]);
    }

    private static SearchFilterControlsViewInputEvent.SelectedFilter selectedFilter(CheckBox checkBox) {
        String[] tokenValues = filterTokenValues(checkBox);
        return new SearchFilterControlsViewInputEvent.SelectedFilter(
                tokenValues[FILTER_GROUP_INDEX],
                tokenValues[FILTER_OPTION_INDEX]);
    }

    private static String[] filterTokenValues(CheckBox checkBox) {
        if (checkBox.getUserData() instanceof String[] tokenValues
                && tokenValues.length == FILTER_TOKEN_LENGTH) {
            return tokenValues;
        }
        throw new IllegalStateException("Search filter option missing filter token.");
    }
}
