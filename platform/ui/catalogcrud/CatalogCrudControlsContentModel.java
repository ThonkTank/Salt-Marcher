package platform.ui.catalogcrud;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyBooleanProperty;
import javafx.beans.property.ReadOnlyBooleanWrapper;
import javafx.beans.property.ReadOnlyIntegerProperty;
import javafx.beans.property.ReadOnlyIntegerWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import org.jspecify.annotations.Nullable;

public final class CatalogCrudControlsContentModel {

    private static final long NO_REVISION = 0L;
    private static final String DEFAULT_EMPTY_TEXT = "Keine Eintraege verfuegbar.";

    private final ObservableList<String> itemIds = FXCollections.observableArrayList();
    private final List<Item> items = new ArrayList<>();
    private final ReadOnlyStringWrapper selectorAccessibleText = new ReadOnlyStringWrapper("Catalog auswaehlen");
    private final ReadOnlyStringWrapper selectorPromptText = new ReadOnlyStringWrapper("Keine Auswahl");
    private final ReadOnlyStringWrapper selectorPlaceholderText = new ReadOnlyStringWrapper(DEFAULT_EMPTY_TEXT);
    private final ReadOnlyStringWrapper selectorFilterTextValue = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper emptyText = new ReadOnlyStringWrapper(DEFAULT_EMPTY_TEXT);
    private final ReadOnlyStringWrapper statusText = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper draftName = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper draftPrompt = new ReadOnlyStringWrapper("Name");
    private final ReadOnlyStringWrapper submitText = new ReadOnlyStringWrapper("Speichern");
    private final ReadOnlyStringWrapper validationText = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper deleteQuestion = new ReadOnlyStringWrapper("Ausgewaehlten Eintrag loeschen?");
    private final ReadOnlyStringWrapper targetItemId = new ReadOnlyStringWrapper("");
    private final ReadOnlyIntegerWrapper selectedIndex = new ReadOnlyIntegerWrapper(-1);
    private final ReadOnlyBooleanWrapper selectorDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper selectorFilterEnabled = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper openDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper openVisible = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper createDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper renameDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper deleteDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper createVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper renameVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper deleteVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper reloadVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper reloadDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper statusVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper operationVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper draftVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper deleteConfirmationVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper validationVisible = new ReadOnlyBooleanWrapper(false);
    private Actions actions = Actions.readOnly();
    private Mode mode = Mode.CLOSED;
    private String selectedItemId = "";
    private String selectorFilterText = "";
    private boolean busy;

    public ObservableList<String> itemIds() {
        return FXCollections.unmodifiableObservableList(itemIds);
    }

    public ReadOnlyStringProperty selectorAccessibleTextProperty() {
        return selectorAccessibleText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty selectorPromptTextProperty() {
        return selectorPromptText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty selectorPlaceholderTextProperty() {
        return selectorPlaceholderText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty selectorFilterTextProperty() {
        return selectorFilterTextValue.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusTextProperty() {
        return statusText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty draftNameProperty() {
        return draftName.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty draftPromptProperty() {
        return draftPrompt.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty submitTextProperty() {
        return submitText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty validationTextProperty() {
        return validationText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty deleteQuestionProperty() {
        return deleteQuestion.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty targetItemIdProperty() {
        return targetItemId.getReadOnlyProperty();
    }

    public ReadOnlyIntegerProperty selectedIndexProperty() {
        return selectedIndex.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty selectorDisabledProperty() {
        return selectorDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty selectorFilterEnabledProperty() {
        return selectorFilterEnabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty openDisabledProperty() {
        return openDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty openVisibleProperty() {
        return openVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty createDisabledProperty() {
        return createDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty renameDisabledProperty() {
        return renameDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty deleteDisabledProperty() {
        return deleteDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty createVisibleProperty() {
        return createVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty renameVisibleProperty() {
        return renameVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty deleteVisibleProperty() {
        return deleteVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty reloadVisibleProperty() {
        return reloadVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty reloadDisabledProperty() {
        return reloadDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty statusVisibleProperty() {
        return statusVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty operationVisibleProperty() {
        return operationVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty draftVisibleProperty() {
        return draftVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty deleteConfirmationVisibleProperty() {
        return deleteConfirmationVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty validationVisibleProperty() {
        return validationVisible.getReadOnlyProperty();
    }

    public void showCatalog(CatalogState state) {
        CatalogState safeState = state == null ? CatalogState.empty() : state;
        String stagedItemId = selectedItemId;
        selectorAccessibleText.set(safeState.selectorAccessibleText());
        emptyText.set(safeState.emptyText());
        statusText.set(safeState.statusText());
        actions = safeState.actions();
        busy = safeState.busy();
        items.clear();
        items.addAll(safeState.items());
        int readbackSelectionIndex = indexOf(safeState.selectedItemId());
        int stagedSelectionIndex = indexOf(stagedItemId);
        selectedItemId = selectedItemId(readbackSelectionIndex, stagedSelectionIndex, stagedItemId);
        refreshPreparedState();
    }

    public void selectItem(String itemId) {
        String normalized = normalize(itemId);
        if (itemById(normalized) == null) {
            return;
        }
        if (normalized.equals(selectedItemId) && selectedIndex.get() == indexInFilteredItems(normalized)) {
            return;
        }
        selectedItemId = normalized;
        refreshPreparedState();
    }

    public void updateSelectorFilter(String nextFilterText) {
        String normalized = normalize(nextFilterText);
        if (normalized.equals(selectorFilterText)) {
            return;
        }
        selectorFilterText = normalized;
        selectorFilterTextValue.set(selectorFilterText);
        refreshPreparedState();
    }

    public void openCreate() {
        mode = Mode.CREATE;
        targetItemId.set("");
        draftName.set("");
        validationText.set("");
        refreshPreparedState();
    }

    public void openRename(String itemId) {
        String normalized = normalize(itemId);
        Item target = itemById(normalized);
        if (target == null) {
            closeOperation();
            return;
        }
        mode = Mode.RENAME;
        targetItemId.set(normalized);
        draftName.set(target.label());
        validationText.set("");
        refreshPreparedState();
    }

    public void openDelete(String itemId) {
        String normalized = normalize(itemId);
        Item target = itemById(normalized);
        if (target == null) {
            closeOperation();
            return;
        }
        mode = Mode.DELETE_CONFIRMATION;
        targetItemId.set(normalized);
        draftName.set("");
        validationText.set("");
        deleteQuestion.set("Ausgewaehlten Eintrag loeschen?");
        refreshPreparedState();
    }

    public void updateDraft(String nextDraftName) {
        draftName.set(nextDraftName == null ? "" : nextDraftName);
        validationText.set("");
        refreshPreparedState();
    }

    public void showValidationError(String errorText) {
        validationText.set(errorText == null ? "" : errorText.trim());
        refreshPreparedState();
    }

    public void closeOperation() {
        mode = Mode.CLOSED;
        targetItemId.set("");
        draftName.set("");
        validationText.set("");
        refreshPreparedState();
    }

    String labelOf(String itemId) {
        Item item = itemById(itemId);
        return item == null ? "" : item.displayText();
    }

    String currentSelectableItemId() {
        return selectedIndex.get() >= 0 ? selectedItemId : "";
    }

    boolean createMode() {
        return mode == Mode.CREATE;
    }

    boolean renameMode() {
        return mode == Mode.RENAME;
    }

    private void refreshPreparedState() {
        clearSelectorFilterWhenContextUnavailable();
        rebuildFilteredItems();
        updateSelectorState();
        updateActionState();
        updateOperationState();
        validationVisible.set(!validationText.get().isBlank());
    }

    private void rebuildFilteredItems() {
        List<String> filteredIds = items.stream()
                .filter(this::matchesSelectorFilter)
                .map(Item::id)
                .toList();
        itemIds.setAll(filteredIds);
        selectedIndex.set(indexInFilteredItems(selectedItemId));
    }

    private void updateSelectorState() {
        boolean hasItems = !items.isEmpty();
        boolean hasFilteredItems = !itemIds.isEmpty();
        boolean operationOpen = mode != Mode.CLOSED;
        selectorDisabled.set(busy || !hasItems || operationOpen);
        selectorFilterEnabled.set(selectorContextAvailable());
        openDisabled.set(busy || !hasItems || operationOpen || selectedIndex.get() < 0);
        openVisible.set(hasItems);
        selectorPromptText.set(hasItems ? "Keine Auswahl" : emptyText.get());
        selectorPlaceholderText.set(selectorPlaceholderText(hasItems, hasFilteredItems));
        statusVisible.set(shouldShowStatusText(hasItems));
    }

    private String selectorPlaceholderText(boolean hasItems, boolean hasFilteredItems) {
        if (!hasItems) {
            return emptyText.get();
        }
        return hasFilteredItems ? "" : "Keine Treffer.";
    }

    private void updateActionState() {
        boolean hasSelection = selectedIndex.get() >= 0;
        createVisible.set(actions.createVisible());
        renameVisible.set(actions.renameVisible());
        deleteVisible.set(actions.deleteVisible());
        reloadVisible.set(actions.reloadVisible());
        createDisabled.set(busy || !actions.createEnabled());
        renameDisabled.set(busy || !actions.renameEnabled() || !hasSelection);
        deleteDisabled.set(busy || !actions.deleteEnabled() || !hasSelection);
        reloadDisabled.set(busy || !actions.reloadEnabled() || !hasSelection);
    }

    private void updateOperationState() {
        boolean operationOpen = mode != Mode.CLOSED;
        operationVisible.set(operationOpen);
        draftVisible.set(mode == Mode.CREATE || mode == Mode.RENAME);
        deleteConfirmationVisible.set(mode == Mode.DELETE_CONFIRMATION);
        draftPrompt.set(mode == Mode.CREATE ? "Name" : "Neuer Name");
        submitText.set(mode == Mode.CREATE ? "Erstellen" : "Speichern");
    }

    private void clearSelectorFilterWhenContextUnavailable() {
        if (selectorContextAvailable() || selectorFilterText.isBlank()) {
            return;
        }
        selectorFilterText = "";
        selectorFilterTextValue.set("");
    }

    private boolean selectorContextAvailable() {
        return !items.isEmpty() && !busy && mode == Mode.CLOSED;
    }

    private boolean matchesSelectorFilter(Item item) {
        return selectorFilterText.isBlank()
                || item.label().toLowerCase(Locale.ROOT).contains(selectorFilterText.toLowerCase(Locale.ROOT));
    }

    private int indexInFilteredItems(String itemId) {
        String normalized = normalize(itemId);
        if (normalized.isBlank()) {
            return -1;
        }
        for (int index = 0; index < itemIds.size(); index++) {
            if (normalized.equals(itemIds.get(index))) {
                return index;
            }
        }
        return -1;
    }

    private int indexOf(String itemId) {
        String normalized = normalize(itemId);
        if (normalized.isBlank()) {
            return -1;
        }
        for (int index = 0; index < items.size(); index++) {
            if (items.get(index).id().equals(normalized)) {
                return index;
            }
        }
        return -1;
    }

    private String selectedItemId(int readbackSelectionIndex, int stagedSelectionIndex, String stagedItemId) {
        if (readbackSelectionIndex >= 0) {
            return items.get(readbackSelectionIndex).id();
        }
        if (stagedSelectionIndex >= 0) {
            return stagedItemId;
        }
        return "";
    }

    private @Nullable Item itemById(String itemId) {
        int index = indexOf(itemId);
        return index < 0 ? null : items.get(index);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static String textOr(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback == null ? "" : fallback;
        }
        return value.trim();
    }

    private boolean shouldShowStatusText(boolean hasItems) {
        String normalizedStatus = normalize(statusText.get());
        return !normalizedStatus.isBlank() && hasItems;
    }

    public record Item(
            String id,
            String label,
            String detail,
            long revision,
            boolean enabled
    ) {

        public Item {
            id = normalize(id);
            label = textOr(label, id);
            detail = detail == null ? "" : detail.trim();
            revision = Math.max(NO_REVISION, revision);
        }

        String displayText() {
            if (!detail.isBlank()) {
                return label + "  " + detail;
            }
            if (revision > NO_REVISION) {
                return label + "  (rev " + revision + ")";
            }
            return label;
        }
    }

    public record CatalogState(
            String title,
            String selectorAccessibleText,
            String emptyText,
            String selectedItemId,
            List<Item> items,
            Actions actions,
            boolean busy,
            String statusText
    ) {

        public CatalogState {
            title = textOr(title, "Catalog");
            selectorAccessibleText = textOr(selectorAccessibleText, title);
            emptyText = textOr(emptyText, DEFAULT_EMPTY_TEXT);
            selectedItemId = normalize(selectedItemId);
            items = items == null ? List.of() : List.copyOf(items);
            actions = actions == null ? Actions.readOnly() : actions;
            statusText = statusText == null ? "" : statusText.trim();
        }

        public static CatalogState empty() {
            return new CatalogState(
                    "Catalog",
                    "Catalog auswaehlen",
                    DEFAULT_EMPTY_TEXT,
                    "",
                    List.of(),
                    Actions.readOnly(),
                    false,
                    "");
        }
    }

    public record Actions(
            boolean createEnabled,
            boolean renameEnabled,
            boolean deleteEnabled,
            boolean reloadEnabled,
            boolean createVisible,
            boolean renameVisible,
            boolean deleteVisible,
            boolean reloadVisible
    ) {

        public Actions(
                boolean createEnabled,
                boolean renameEnabled,
                boolean deleteEnabled,
                boolean reloadEnabled
        ) {
            this(
                    createEnabled,
                    renameEnabled,
                    deleteEnabled,
                    reloadEnabled,
                    true,
                    true,
                    true,
                    reloadEnabled);
        }

        public static Actions readOnly() {
            return new Actions(false, false, false, false);
        }

        public static Actions hiddenReadOnly() {
            return new Actions(false, false, false, false, false, false, false, false);
        }
    }

    private enum Mode {
        CLOSED,
        CREATE,
        RENAME,
        DELETE_CONFIRMATION
    }
}
