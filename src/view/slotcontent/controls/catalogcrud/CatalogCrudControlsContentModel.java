package src.view.slotcontent.controls.catalogcrud;

import java.util.ArrayList;
import java.util.List;
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

    private final ObservableList<String> itemIds = FXCollections.observableArrayList();
    private final List<Item> items = new ArrayList<>();
    private final ReadOnlyStringWrapper title = new ReadOnlyStringWrapper("Catalog");
    private final ReadOnlyStringWrapper selectorAccessibleText = new ReadOnlyStringWrapper("Catalog auswaehlen");
    private final ReadOnlyStringWrapper emptyText = new ReadOnlyStringWrapper("Keine Eintraege verfuegbar.");
    private final ReadOnlyStringWrapper statusText = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper draftName = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper draftPrompt = new ReadOnlyStringWrapper("Name");
    private final ReadOnlyStringWrapper submitText = new ReadOnlyStringWrapper("Speichern");
    private final ReadOnlyStringWrapper validationText = new ReadOnlyStringWrapper("");
    private final ReadOnlyStringWrapper deleteQuestion = new ReadOnlyStringWrapper("Ausgewaehlten Eintrag loeschen?");
    private final ReadOnlyStringWrapper targetItemId = new ReadOnlyStringWrapper("");
    private final ReadOnlyIntegerWrapper selectedIndex = new ReadOnlyIntegerWrapper(-1);
    private final ReadOnlyBooleanWrapper selectorDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper createDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper renameDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper deleteDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper reloadVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper reloadDisabled = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper emptyVisible = new ReadOnlyBooleanWrapper(true);
    private final ReadOnlyBooleanWrapper operationVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper draftVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper deleteConfirmationVisible = new ReadOnlyBooleanWrapper(false);
    private final ReadOnlyBooleanWrapper validationVisible = new ReadOnlyBooleanWrapper(false);
    private Actions actions = Actions.readOnly();
    private Mode mode = Mode.CLOSED;
    private String selectedItemId = "";
    private boolean busy;

    public ObservableList<String> itemIds() {
        return FXCollections.unmodifiableObservableList(itemIds);
    }

    public ReadOnlyStringProperty titleProperty() {
        return title.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty selectorAccessibleTextProperty() {
        return selectorAccessibleText.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty emptyTextProperty() {
        return emptyText.getReadOnlyProperty();
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

    public ReadOnlyBooleanProperty createDisabledProperty() {
        return createDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty renameDisabledProperty() {
        return renameDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty deleteDisabledProperty() {
        return deleteDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty reloadVisibleProperty() {
        return reloadVisible.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty reloadDisabledProperty() {
        return reloadDisabled.getReadOnlyProperty();
    }

    public ReadOnlyBooleanProperty emptyVisibleProperty() {
        return emptyVisible.getReadOnlyProperty();
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
        title.set(safeState.title());
        selectorAccessibleText.set(safeState.selectorAccessibleText());
        emptyText.set(safeState.emptyText());
        statusText.set(safeState.statusText());
        actions = safeState.actions();
        busy = safeState.busy();
        items.clear();
        items.addAll(safeState.items());
        itemIds.setAll(items.stream().map(Item::id).toList());
        int readbackSelectionIndex = indexOf(safeState.selectedItemId());
        selectedItemId = readbackSelectionIndex < 0 ? "" : safeState.selectedItemId();
        selectedIndex.set(readbackSelectionIndex);
        refreshPreparedState();
    }

    public void selectItem(String itemId) {
        String normalized = normalize(itemId);
        if (itemById(normalized) == null) {
            return;
        }
        selectedItemId = normalized;
        selectedIndex.set(indexOf(normalized));
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

    public String labelOf(String itemId) {
        Item item = itemById(itemId);
        return item == null ? "" : item.displayText();
    }

    public String selectedItemId() {
        return selectedItemId;
    }

    public boolean createMode() {
        return mode == Mode.CREATE;
    }

    public boolean renameMode() {
        return mode == Mode.RENAME;
    }

    private void refreshPreparedState() {
        updateSelectorState();
        updateActionState();
        updateOperationState();
        validationVisible.set(!validationText.get().isBlank());
    }

    private void updateSelectorState() {
        boolean hasItems = !items.isEmpty();
        boolean operationOpen = mode != Mode.CLOSED;
        selectorDisabled.set(busy || !hasItems || operationOpen);
        emptyVisible.set(!hasItems);
    }

    private void updateActionState() {
        boolean hasSelection = !selectedItemId.isBlank();
        createDisabled.set(busy || !actions.createEnabled());
        renameDisabled.set(busy || !actions.renameEnabled() || !hasSelection);
        deleteDisabled.set(busy || !actions.deleteEnabled() || !hasSelection);
        reloadVisible.set(actions.reloadEnabled());
        reloadDisabled.set(busy || !hasSelection);
    }

    private void updateOperationState() {
        boolean operationOpen = mode != Mode.CLOSED;
        operationVisible.set(operationOpen);
        draftVisible.set(mode == Mode.CREATE || mode == Mode.RENAME);
        deleteConfirmationVisible.set(mode == Mode.DELETE_CONFIRMATION);
        draftPrompt.set(mode == Mode.CREATE ? "Name" : "Neuer Name");
        submitText.set(mode == Mode.CREATE ? "Erstellen" : "Speichern");
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
            emptyText = textOr(emptyText, "Keine Eintraege verfuegbar.");
            selectedItemId = normalize(selectedItemId);
            items = items == null ? List.of() : List.copyOf(items);
            actions = actions == null ? Actions.readOnly() : actions;
            statusText = statusText == null ? "" : statusText.trim();
        }

        public static CatalogState empty() {
            return new CatalogState(
                    "Catalog",
                    "Catalog auswaehlen",
                    "Keine Eintraege verfuegbar.",
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
            boolean reloadEnabled
    ) {

        public static Actions readOnly() {
            return new Actions(false, false, false, false);
        }
    }

    private enum Mode {
        CLOSED,
        CREATE,
        RENAME,
        DELETE_CONFIRMATION
    }
}
