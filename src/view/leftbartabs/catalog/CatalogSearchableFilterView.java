package src.view.leftbartabs.catalog;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import javafx.geometry.Insets;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class CatalogSearchableFilterView extends javafx.scene.control.Button {

    private static final int SEARCH_FIELD_THRESHOLD = 6;
    private static final String CLOSED_SUFFIX = " ▾";

    private final String label;
    private final Runnable onInteraction;
    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final PopupContentView popupContent;
    private final Set<String> selectedValues = new LinkedHashSet<>();

    private List<String> options = List.of();
    private int internalUpdateDepth;

    CatalogSearchableFilterView(String label, Runnable onInteraction) {
        this.label = label;
        this.onInteraction = onInteraction;
        popupContent = new PopupContentView(
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
        popup.setContent(popupContent);
    }

    void applyProjection(Projection projection) {
        Projection safeProjection = projection == null ? Projection.empty() : projection;
        runSilently(() -> {
            options = safeProjection.options();
            selectedValues.clear();
            selectedValues.addAll(safeProjection.selectedValues());
            popupContent.render(options, selectedValues, safeProjection.dropdownState().searchQuery());
            if (safeProjection.dropdownState().open()) {
                if (!popup.isShowing()) {
                    popup.showBelow(this);
                }
            } else if (popup.isShowing()) {
                popup.hide();
            }
            updateTriggerText();
        });
    }

    Snapshot snapshot() {
        return new Snapshot(
                List.copyOf(selectedValues),
                new CatalogContributionModel.FilterDropdownState(popup.isShowing(), popupContent.query()));
    }

    void removeValue(String value) {
        if (selectedValues.remove(value)) {
            runSilently(() -> {
                if (popup.isShowing()) {
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
                if (popup.isShowing()) {
                    popupContent.render(options, selectedValues, popupContent.query());
                }
                updateTriggerText();
            });
        }
    }

    record Projection(
            List<String> options,
            List<String> selectedValues,
            CatalogContributionModel.FilterDropdownState dropdownState
    ) {
        Projection {
            options = options == null ? List.of() : List.copyOf(options);
            selectedValues = selectedValues == null ? List.of() : List.copyOf(selectedValues);
            dropdownState = dropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : dropdownState;
        }

        static Projection empty() {
            return new Projection(List.of(), List.of(), CatalogContributionModel.FilterDropdownState.closed());
        }
    }

    record Snapshot(List<String> selectedValues, CatalogContributionModel.FilterDropdownState dropdownState) {
        Snapshot {
            selectedValues = selectedValues == null ? List.of() : List.copyOf(selectedValues);
            dropdownState = dropdownState == null ? CatalogContributionModel.FilterDropdownState.closed() : dropdownState;
        }
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
        } else {
            popupContent.render(options, selectedValues, popupContent.query());
            popup.showBelow(this);
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
        setAccessibleText(popup.isShowing() ? label + " geöffnet - Escape zum Schließen" : getText());
    }

    private void runSilently(Runnable action) {
        internalUpdateDepth++;
        try {
            action.run();
        } finally {
            internalUpdateDepth--;
        }
    }

    private static final class PopupContentView extends VBox {

        private final SearchField searchField;
        private final OptionListView optionList = new OptionListView();
        private final OptionScrollPane optionScrollPane = new OptionScrollPane(optionList);
        private final BooleanSupplier inputSuppressed;
        private final Runnable queryChangedAction;
        private final BiConsumer<String, Boolean> selectionAction;
        private int internalUpdateDepth;

        PopupContentView(
                String label,
                BooleanSupplier inputSuppressed,
                Runnable queryChangedAction,
                BiConsumer<String, Boolean> selectionAction
        ) {
            super(4);
            this.inputSuppressed = inputSuppressed;
            this.queryChangedAction = queryChangedAction;
            this.selectionAction = selectionAction;
            searchField = new SearchField(label);
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

    private static final class SearchField extends TextField {

        SearchField(String label) {
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
