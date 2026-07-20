package features.catalog.adapter.javafx;

import features.catalog.application.CatalogChoice;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.ListCell;
import javafx.scene.control.ListView;
import javafx.scene.control.MenuButton;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;

/** Virtualized direct-selection picker shared by choice, multi-choice, range and tri-state filters. */
final class CatalogPicker<V> extends MenuButton {

    private static final long TYPE_AHEAD_TIMEOUT_NANOS = 800_000_000L;

    private final String prompt;
    private final boolean multiple;
    private final ObservableList<CatalogChoice<V>> choices = FXCollections.observableArrayList();
    private final ListView<CatalogChoice<V>> list = new ListView<>(choices);
    private final Set<V> selected = new LinkedHashSet<>();
    private final Set<V> pending = new LinkedHashSet<>();
    private Consumer<List<V>> onCommit = ignored -> { };
    private String prefix = "";
    private long lastTypedAt;

    CatalogPicker(String prompt, String accessibleText, boolean multiple) {
        super(Objects.requireNonNullElse(prompt, ""));
        this.prompt = Objects.requireNonNullElse(prompt, "");
        this.multiple = multiple;
        setAccessibleText(accessibleText);
        getStyleClass().addAll("catalog-filter-control", "catalog-picker");
        list.getStyleClass().add("catalog-picker-list");
        list.setFocusTraversable(true);
        list.setCellFactory(ignored -> new ChoiceCell());
        list.setOnMouseClicked(event -> {
            if (event.getButton() == MouseButton.PRIMARY && list.getSelectionModel().getSelectedItem() != null) {
                commitHighlighted();
                event.consume();
            }
        });
        list.addEventFilter(KeyEvent.KEY_PRESSED, this::handlePressed);
        list.addEventFilter(KeyEvent.KEY_TYPED, this::handleTyped);
        CustomMenuItem popupContent = new CustomMenuItem(list, false);
        popupContent.getStyleClass().add("catalog-picker-popup");
        getItems().setAll(popupContent);
        showingProperty().addListener((ignored, before, showing) -> {
            if (showing) {
                pending.clear();
                pending.addAll(selected);
                prefix = "";
                selectCurrentOrFirst();
                list.refresh();
                javafx.application.Platform.runLater(list::requestFocus);
            } else {
                updateFace();
            }
        });
        addEventFilter(KeyEvent.KEY_PRESSED, this::handlePressed);
        addEventFilter(KeyEvent.KEY_TYPED, this::handleTyped);
    }

    void setChoices(List<CatalogChoice<V>> nextChoices) {
        List<CatalogChoice<V>> safe = List.copyOf(nextChoices);
        if (!choices.equals(safe)) {
            choices.setAll(safe);
        }
        boolean effective = choices.stream().anyMatch(choice -> !neutral(choice));
        setManaged(effective);
        setVisible(effective);
        updateFace();
    }

    void setSelection(Collection<V> values) {
        List<V> safe = values == null ? List.of() : List.copyOf(values);
        if (!selected.equals(new LinkedHashSet<>(safe))) {
            selected.clear();
            selected.addAll(safe);
            if (!isShowing()) {
                pending.clear();
                pending.addAll(selected);
            }
            list.refresh();
            updateFace();
        }
    }

    void setOnCommit(Consumer<List<V>> action) {
        onCommit = Objects.requireNonNull(action, "action");
    }

    ListView<CatalogChoice<V>> optionList() {
        return list;
    }

    private void handlePressed(KeyEvent event) {
        if (event.getCode() == KeyCode.ESCAPE && isShowing()) {
            pending.clear();
            pending.addAll(selected);
            hide();
            event.consume();
            return;
        }
        if (event.getCode() == KeyCode.BACK_SPACE && isShowing() && !prefix.isEmpty()) {
            prefix = prefix.substring(0, prefix.length() - 1);
            if (prefix.isEmpty()) {
                updateFace();
            } else {
                selectPrefix(prefix);
                setText(prompt + ": " + prefix);
            }
            event.consume();
            return;
        }
        if (event.getCode() == KeyCode.ENTER) {
            if (isShowing()) {
                commitHighlighted();
            } else {
                showPicker();
            }
            event.consume();
            return;
        }
        if (event.getCode() == KeyCode.DOWN || event.getCode() == KeyCode.UP) {
            if (!isShowing()) {
                showPicker();
            }
            move(event.getCode() == KeyCode.DOWN ? 1 : -1);
            event.consume();
        }
    }

    private void handleTyped(KeyEvent event) {
        String text = event.getCharacter();
        if (text == null || text.isBlank() || event.isControlDown() || event.isMetaDown() || event.isAltDown()) {
            return;
        }
        showPicker();
        long now = System.nanoTime();
        prefix = now - lastTypedAt > TYPE_AHEAD_TIMEOUT_NANOS ? text : prefix + text;
        lastTypedAt = now;
        if (!selectPrefix(prefix)) {
            prefix = text;
            selectPrefix(prefix);
        }
        setText(prompt + ": " + prefix);
        event.consume();
    }

    private boolean selectPrefix(String value) {
        String folded = value.toLowerCase(Locale.ROOT);
        for (int index = 0; index < choices.size(); index++) {
            CatalogChoice<V> choice = choices.get(index);
            if (!neutral(choice) && choice.label().toLowerCase(Locale.ROOT).startsWith(folded)) {
                list.getSelectionModel().select(index);
                list.scrollTo(index);
                return true;
            }
        }
        list.getSelectionModel().clearSelection();
        return false;
    }

    private void showPicker() {
        if (!isShowing() && isManaged() && !choices.isEmpty()) {
            show();
        }
    }

    private void move(int delta) {
        if (choices.isEmpty()) {
            return;
        }
        int current = list.getSelectionModel().getSelectedIndex();
        int next = Math.max(0, Math.min(choices.size() - 1, current + delta));
        list.getSelectionModel().select(next);
        list.scrollTo(next);
    }

    private void selectCurrentOrFirst() {
        int matching = -1;
        for (int index = 0; index < choices.size(); index++) {
            if (selected.contains(choices.get(index).value())) {
                matching = index;
                break;
            }
        }
        if (matching < 0) {
            for (int index = 0; index < choices.size(); index++) {
                if (!neutral(choices.get(index))) {
                    matching = index;
                    break;
                }
            }
        }
        if (matching >= 0) {
            list.getSelectionModel().select(matching);
            list.scrollTo(matching);
        }
    }

    private void commitHighlighted() {
        CatalogChoice<V> choice = list.getSelectionModel().getSelectedItem();
        if (choice == null) {
            hide();
            return;
        }
        if (multiple) {
            if (!pending.remove(choice.value())) {
                pending.add(choice.value());
            }
        } else {
            pending.clear();
            if (!neutral(choice)) {
                pending.add(choice.value());
            }
        }
        selected.clear();
        selected.addAll(pending);
        List<V> committed = List.copyOf(selected);
        updateFace();
        hide();
        onCommit.accept(committed);
    }

    private void updateFace() {
        List<String> labels = new ArrayList<>();
        for (CatalogChoice<V> choice : choices) {
            if (selected.contains(choice.value()) && !neutral(choice)) {
                labels.add(choice.label());
            }
        }
        if (labels.isEmpty()) {
            setText(prompt);
        } else if (multiple && labels.size() > 1) {
            setText(prompt + " (" + labels.size() + ")");
        } else {
            setText(prompt + ": " + labels.getFirst());
        }
    }

    private static boolean neutral(CatalogChoice<?> choice) {
        return "Alle".equalsIgnoreCase(choice.label()) || "Beliebig".equalsIgnoreCase(choice.label());
    }

    private final class ChoiceCell extends ListCell<CatalogChoice<V>> {
        @Override protected void updateItem(CatalogChoice<V> choice, boolean empty) {
            super.updateItem(choice, empty);
            if (empty || choice == null) {
                setText(null);
                setAccessibleText(null);
                return;
            }
            boolean checked = pending.contains(choice.value());
            setText(multiple && checked ? "✓  " + choice.label() : choice.label());
            setAccessibleText(choice.label() + (multiple && checked ? " ausgewählt" : ""));
        }
    }
}
