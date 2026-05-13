package src.view.leftbartabs.catalog;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;
import javafx.geometry.Insets;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.VBox;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.popup.AnchoredPopupContentModel;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;

final class CatalogEncounterTablePickerView extends Button {

    private static final String DEFAULT_TRIGGER_TEXT = "Tabelle ▾";
    private static final String EMPTY_LABEL = "Keine Encounter-Tabellen gefunden";
    private static final String CLEAR_ALL_LABEL = "(Alle Monster)";
    private static final String DEFAULT_TOOLTIP = "Mehrere Encounter-Tabellen können kombiniert werden.";
    private static final String LOOT_CONFLICT_TOOLTIP =
            "Mehrere ausgewählte Tabellen verweisen auf unterschiedliche Loot-Tabellen. "
                    + "Kampfstart bleibt blockiert, bis höchstens eine verknüpfte Loot-Tabelle aktiv ist.";

    private final Runnable onInteraction;
    private final Tooltip tableTooltip = new Tooltip(DEFAULT_TOOLTIP);
    private final PopupContentView popupContent = new PopupContentView();
    private final AnchoredPopupContentModel popupContentModel = new AnchoredPopupContentModel();
    private final AnchoredPopupView popup = new AnchoredPopupView(popupContent, () -> this);
    private final SelectionState selectionState = new SelectionState();

    CatalogEncounterTablePickerView(Runnable onInteraction) {
        this.onInteraction = onInteraction;
        getStyleClass().addAll("compact", "filter-trigger");
        setTooltip(tableTooltip);
        setOnAction(event -> togglePopup());
        popup.bind(popupContentModel);
        updateTriggerState();
    }

    void applyProjection(Projection projection) {
        selectionState.apply(projection);
        renderPopup(selectionState.popupOpen(projection));
        updateTriggerState();
    }

    Snapshot snapshot() {
        return selectionState.snapshot(popupContentModel.isOpen());
    }

    boolean clearChip(String key) {
        if (!selectionState.clearChip(key)) {
            return false;
        }
        renderPopup(popupContentModel.isOpen());
        updateTriggerState();
        return true;
    }

    private void togglePopup() {
        renderPopup(!popupContentModel.isOpen());
        onInteraction.run();
    }

    private void renderPopup(boolean open) {
        if (open) {
            popupContent.render(
                    selectionState.encounterTables(),
                    selectionState.selectedEncounterTableIds(),
                    this::handleSelectionChange,
                    this::handleClearAll);
            if (!popupContentModel.isOpen()) {
                popupContentModel.showBelow(2.0, false);
            }
            return;
        }
        if (popupContentModel.isOpen()) {
            popupContentModel.hide();
        }
    }

    private void updateTriggerState() {
        getStyleClass().remove("filter-trigger-active");
        SelectionSummary summary = selectionState.summary();
        setText(summary.label());
        if (!selectionState.selectedEncounterTableIds().isEmpty()) {
            getStyleClass().add("filter-trigger-active");
        }
        tableTooltip.setText(summary.lootConflict() ? LOOT_CONFLICT_TOOLTIP : DEFAULT_TOOLTIP);
    }

    private void handleSelectionChange(long tableId, boolean selected) {
        selectionState.select(tableId, selected);
        renderPopup(popupContentModel.isOpen());
        updateTriggerState();
        onInteraction.run();
    }

    private void handleClearAll() {
        selectionState.clearAll();
        renderPopup(popupContentModel.isOpen());
        updateTriggerState();
        onInteraction.run();
    }

    record Projection(
            List<CatalogContributionModel.EncounterTableOption> encounterTables,
            List<Long> selectedEncounterTableIds,
            boolean popupOpen
    ) {
        Projection {
            encounterTables = encounterTables == null ? List.of() : List.copyOf(encounterTables);
            selectedEncounterTableIds = selectedEncounterTableIds == null ? List.of() : List.copyOf(selectedEncounterTableIds);
        }
    }

    record Snapshot(boolean popupOpen, List<Long> selectedEncounterTableIds) {
        Snapshot {
            selectedEncounterTableIds = selectedEncounterTableIds == null ? List.of() : List.copyOf(selectedEncounterTableIds);
        }
    }

    private record SelectionSummary(String label, boolean lootConflict) {

        private static final String CHIP_PREFIX = "encounter-table:";
        private static final String MULTI_TABLE_LABEL_PREFIX = "Tabellen (";
        private static final String MULTI_TABLE_LABEL_SUFFIX = ") ▾";
        private static final String LOOT_CONFLICT_SUFFIX = ", Loot-Konflikt) ▾";
        private static final String SELECTED_SUFFIX = " ▾";
        private static final int SINGLE_SELECTION_COUNT = 1;
        private static final long MULTI_LOOT_TABLE_COUNT = 1L;

        static SelectionSummary from(
                List<CatalogContributionModel.EncounterTableOption> encounterTables,
                List<Long> selectedEncounterTableIds
        ) {
            Set<Long> selectedIds = new LinkedHashSet<>(selectedEncounterTableIds);
            List<CatalogContributionModel.EncounterTableOption> selectedTables = encounterTables.stream()
                    .filter(table -> selectedIds.contains(table.tableId()))
                    .toList();
            long distinctLootTables = selectedTables.stream()
                    .map(CatalogContributionModel.EncounterTableOption::linkedLootTableId)
                    .filter(java.util.Objects::nonNull)
                    .distinct()
                    .count();
            if (selectedTables.isEmpty()) {
                return new SelectionSummary(DEFAULT_TRIGGER_TEXT, false);
            }
            if (selectedTables.size() == SINGLE_SELECTION_COUNT) {
                return new SelectionSummary(selectedTables.get(0).name() + SELECTED_SUFFIX, false);
            }
            boolean lootConflict = distinctLootTables > MULTI_LOOT_TABLE_COUNT;
            String label = lootConflict
                    ? MULTI_TABLE_LABEL_PREFIX + selectedTables.size() + LOOT_CONFLICT_SUFFIX
                    : MULTI_TABLE_LABEL_PREFIX + selectedTables.size() + MULTI_TABLE_LABEL_SUFFIX;
            return new SelectionSummary(label, lootConflict);
        }

        static @Nullable Long tableIdFromKey(String key) {
            if (key == null || !key.startsWith(CHIP_PREFIX)) {
                return null;
            }
            try {
                return Long.parseLong(key.substring(CHIP_PREFIX.length()));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
    }

    private static final class SelectionState {

        private List<CatalogContributionModel.EncounterTableOption> encounterTables = List.of();
        private List<Long> selectedEncounterTableIds = List.of();

        void apply(Projection projection) {
            Projection safeProjection = projection == null ? new Projection(List.of(), List.of(), false) : projection;
            encounterTables = safeProjection.encounterTables();
            selectedEncounterTableIds = availableEncounterTableIds(safeProjection.selectedEncounterTableIds());
        }

        boolean clearChip(String key) {
            Long tableId = SelectionSummary.tableIdFromKey(key);
            if (tableId == null || !selectedEncounterTableIds.contains(tableId)) {
                return false;
            }
            select(tableId, false);
            return true;
        }

        void clearAll() {
            selectedEncounterTableIds = List.of();
        }

        void select(long tableId, boolean selected) {
            Set<Long> updatedTableIds = new LinkedHashSet<>(selectedEncounterTableIds);
            if (selected) {
                updatedTableIds.add(tableId);
            } else {
                updatedTableIds.remove(tableId);
            }
            selectedEncounterTableIds = List.copyOf(updatedTableIds);
        }

        Snapshot snapshot(boolean popupOpen) {
            return new Snapshot(popupOpen, selectedEncounterTableIds);
        }

        SelectionSummary summary() {
            return SelectionSummary.from(encounterTables, selectedEncounterTableIds);
        }

        List<CatalogContributionModel.EncounterTableOption> encounterTables() {
            return encounterTables;
        }

        List<Long> selectedEncounterTableIds() {
            return selectedEncounterTableIds;
        }

        boolean popupOpen(Projection projection) {
            return projection != null && projection.popupOpen();
        }

        private List<Long> availableEncounterTableIds(List<Long> tableIds) {
            if (tableIds == null || tableIds.isEmpty()) {
                return List.of();
            }
            Set<Long> availableIds = encounterTables.stream()
                    .map(CatalogContributionModel.EncounterTableOption::tableId)
                    .collect(LinkedHashSet::new, Set::add, Set::addAll);
            return tableIds.stream()
                    .filter(availableIds::contains)
                    .distinct()
                    .toList();
        }
    }

    private static final class PopupContentView extends VBox {

        PopupContentView() {
            super(2);
            getStyleClass().add("filter-dropdown");
            setPadding(new Insets(8));
        }

        void render(
                List<CatalogContributionModel.EncounterTableOption> encounterTables,
                List<Long> selectedEncounterTableIds,
                BiConsumer<Long, Boolean> selectionAction,
                Runnable clearAction
        ) {
            getChildren().clear();
            getChildren().add(new ClearAllButton(clearAction));
            if (encounterTables.isEmpty()) {
                getChildren().add(new SecondaryLabel(EMPTY_LABEL));
                return;
            }
            Set<Long> selectedIds = new LinkedHashSet<>(selectedEncounterTableIds);
            for (CatalogContributionModel.EncounterTableOption table : encounterTables) {
                getChildren().add(new EncounterTableCheckBox(table, selectedIds.contains(table.tableId()), selectionAction));
            }
        }
    }

    private static final class ClearAllButton extends Button {

        ClearAllButton(Runnable clearAction) {
            super(CLEAR_ALL_LABEL);
            setMaxWidth(Double.MAX_VALUE);
            getStyleClass().addAll("flat", "compact");
            setOnAction(event -> clearAction.run());
        }
    }

    private static final class SecondaryLabel extends Label {

        SecondaryLabel(String text) {
            super(text);
            getStyleClass().add("text-secondary");
        }
    }

    private static final class EncounterTableCheckBox extends CheckBox {

        EncounterTableCheckBox(
                CatalogContributionModel.EncounterTableOption table,
                boolean selected,
                BiConsumer<Long, Boolean> selectionAction
        ) {
            super(table.name());
            setMaxWidth(Double.MAX_VALUE);
            setSelected(selected);
            setOnAction(event -> selectionAction.accept(table.tableId(), isSelected()));
        }
    }
}
