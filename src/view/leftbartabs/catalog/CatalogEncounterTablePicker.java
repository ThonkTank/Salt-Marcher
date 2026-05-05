package src.view.leftbartabs.catalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class CatalogEncounterTablePicker extends Button {

    private static final String DEFAULT_TRIGGER_TEXT = "Tabelle ▾";
    private static final String EMPTY_LABEL = "Keine Encounter-Tabellen gefunden";
    private static final String CLEAR_ALL_LABEL = "(Alle Monster)";
    private static final String MULTI_TABLE_LABEL_PREFIX = "Tabellen (";
    private static final String MULTI_TABLE_LABEL_SUFFIX = ") ▾";
    private static final String LOOT_CONFLICT_SUFFIX = ", Loot-Konflikt) ▾";
    private static final String SELECTED_SUFFIX = " ▾";
    private static final String STYLE_COMPACT = "compact";
    private static final String STYLE_TRIGGER = "filter-trigger";
    private static final String STYLE_ACTIVE = "filter-trigger-active";
    private static final String STYLE_DROPDOWN = "filter-dropdown";
    private static final String STYLE_SECONDARY_TEXT = "text-secondary";
    private static final String STYLE_FLAT = "flat";
    private static final String CHIP_STYLE = "chip-table";
    private static final String CHIP_PREFIX = "encounter-table:";
    private static final String DEFAULT_TOOLTIP = "Mehrere Encounter-Tabellen können kombiniert werden.";
    private static final String LOOT_CONFLICT_TOOLTIP =
            "Mehrere ausgewählte Tabellen verweisen auf unterschiedliche Loot-Tabellen. "
                    + "Kampfstart bleibt blockiert, bis höchstens eine verknüpfte Loot-Tabelle aktiv ist.";

    private final Runnable onSelectionChanged;
    private final Tooltip tableTooltip = new Tooltip(DEFAULT_TOOLTIP);
    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final VBox popupContent = new VBox(2);
    private final Map<Long, CheckBox> checkboxesByTableId = new LinkedHashMap<>();

    private List<EncounterTableSelection> encounterTables = List.of();
    private List<Long> selectedEncounterTableIds = List.of();

    CatalogEncounterTablePicker(Runnable onSelectionChanged) {
        this.onSelectionChanged = onSelectionChanged;
        getStyleClass().addAll(STYLE_COMPACT, STYLE_TRIGGER);
        setTooltip(tableTooltip);
        setOnAction(event -> togglePopup());
        popupContent.getStyleClass().add(STYLE_DROPDOWN);
        popupContent.setPadding(new Insets(8));
        popup.setContent(popupContent);
        updateTriggerState();
    }

    void setEncounterTables(List<EncounterTableSelection> tables) {
        encounterTables = tables == null ? List.of() : List.copyOf(tables);
        selectedEncounterTableIds = availableEncounterTableIds(selectedEncounterTableIds);
        updateTriggerState();
        refreshOpenPopup();
    }

    void selectEncounterTables(List<Long> tableIds) {
        selectedEncounterTableIds = availableEncounterTableIds(tableIds);
        updateTriggerState();
        refreshOpenPopup();
    }

    boolean clearEncounterTableChip(String key) {
        if (!key.startsWith(CHIP_PREFIX)) {
            return false;
        }
        Long tableId = parseTableId(key.substring(CHIP_PREFIX.length()));
        if (tableId == null || !selectedEncounterTableIds.contains(tableId)) {
            return false;
        }
        selectWithoutPublishing(tableId, false);
        return true;
    }

    List<Long> selectedEncounterTableIds() {
        return List.copyOf(selectedEncounterTableIds);
    }

    List<CatalogFilterChipsStrip.FilterChipView> selectedTableChips() {
        List<CatalogFilterChipsStrip.FilterChipView> chips = new ArrayList<>();
        for (EncounterTableSelection table : selectedEncounterTables()) {
            chips.add(new CatalogFilterChipsStrip.FilterChipView(
                    CHIP_PREFIX + table.tableId(),
                    table.name(),
                    CHIP_STYLE));
        }
        return chips;
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        renderPopup();
        popup.showBelow(this);
    }

    private void refreshOpenPopup() {
        if (popup.isShowing()) {
            renderPopup();
        }
    }

    private void renderPopup() {
        popupContent.getChildren().clear();
        checkboxesByTableId.clear();
        popupContent.getChildren().add(clearAllButton());

        if (encounterTables.isEmpty()) {
            popupContent.getChildren().add(emptyStateLabel());
            return;
        }

        for (EncounterTableSelection table : encounterTables) {
            popupContent.getChildren().add(tableCheckbox(table));
        }
    }

    private Button clearAllButton() {
        Button clearAll = new Button(CLEAR_ALL_LABEL);
        clearAll.setMaxWidth(Double.MAX_VALUE);
        clearAll.getStyleClass().addAll(STYLE_FLAT, STYLE_COMPACT);
        clearAll.setOnAction(event -> {
            selectedEncounterTableIds = List.of();
            popup.hide();
            updateTriggerState();
            onSelectionChanged.run();
        });
        return clearAll;
    }

    private Label emptyStateLabel() {
        Label empty = new Label(EMPTY_LABEL);
        empty.getStyleClass().add(STYLE_SECONDARY_TEXT);
        return empty;
    }

    private CheckBox tableCheckbox(EncounterTableSelection table) {
        CheckBox checkbox = new CheckBox(table.name());
        checkbox.setMaxWidth(Double.MAX_VALUE);
        checkbox.setSelected(selectedEncounterTableIds.contains(table.tableId()));
        checkbox.setOnAction(event -> updateSelection(table.tableId(), checkbox.isSelected()));
        checkboxesByTableId.put(table.tableId(), checkbox);
        return checkbox;
    }

    private void updateSelection(long tableId, boolean selected) {
        selectWithoutPublishing(tableId, selected);
        onSelectionChanged.run();
    }

    private void selectWithoutPublishing(long tableId, boolean selected) {
        LinkedHashSet<Long> tableIds = new LinkedHashSet<>(selectedEncounterTableIds);
        if (selected) {
            tableIds.add(tableId);
        } else {
            tableIds.remove(tableId);
        }
        selectedEncounterTableIds = List.copyOf(tableIds);
        syncRenderedCheckbox(tableId, selected);
        updateTriggerState();
    }

    private void syncRenderedCheckbox(long tableId, boolean selected) {
        CheckBox checkbox = checkboxesByTableId.get(tableId);
        if (checkbox != null) {
            checkbox.setSelected(selected);
        }
    }

    private void updateTriggerState() {
        getStyleClass().remove(STYLE_ACTIVE);
        boolean lootConflict = hasLinkedLootConflict();
        List<EncounterTableSelection> selectedTables = selectedEncounterTables();
        setText(triggerLabel(selectedTables, lootConflict));
        if (!selectedTables.isEmpty()) {
            getStyleClass().add(STYLE_ACTIVE);
        }
        tableTooltip.setText(lootConflict ? LOOT_CONFLICT_TOOLTIP : DEFAULT_TOOLTIP);
    }

    private String triggerLabel(List<EncounterTableSelection> selectedTables, boolean lootConflict) {
        int selectedCount = selectedTables.size();
        if (selectedCount == 0) {
            return DEFAULT_TRIGGER_TEXT;
        }
        if (selectedCount == 1) {
            return selectedTables.get(0).name() + SELECTED_SUFFIX;
        }
        if (lootConflict) {
            return MULTI_TABLE_LABEL_PREFIX + selectedCount + LOOT_CONFLICT_SUFFIX;
        }
        return MULTI_TABLE_LABEL_PREFIX + selectedCount + MULTI_TABLE_LABEL_SUFFIX;
    }

    private List<EncounterTableSelection> selectedEncounterTables() {
        if (selectedEncounterTableIds.isEmpty()) {
            return List.of();
        }
        Set<Long> selectedIds = new LinkedHashSet<>(selectedEncounterTableIds);
        return encounterTables.stream()
                .filter(table -> selectedIds.contains(table.tableId()))
                .toList();
    }

    private List<Long> availableEncounterTableIds(List<Long> tableIds) {
        if (tableIds == null || tableIds.isEmpty()) {
            return List.of();
        }
        Set<Long> availableIds = encounterTables.stream()
                .map(EncounterTableSelection::tableId)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return tableIds.stream()
                .filter(Objects::nonNull)
                .filter(availableIds::contains)
                .distinct()
                .toList();
    }

    private boolean hasLinkedLootConflict() {
        long distinctLinkedLootTables = selectedEncounterTables().stream()
                .map(EncounterTableSelection::linkedLootTableId)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        return distinctLinkedLootTables > 1;
    }

    private static @Nullable Long parseTableId(String text) {
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    record EncounterTableSelection(long tableId, String name, @Nullable Long linkedLootTableId) {
        EncounterTableSelection {
            name = name == null || name.isBlank() ? "Tabelle " + tableId : name;
        }
    }
}
