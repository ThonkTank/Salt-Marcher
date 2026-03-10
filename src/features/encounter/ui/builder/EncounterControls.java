package features.encounter.ui.builder;

import features.encountertable.model.EncounterTable;
import features.encounter.application.EncounterApplicationService;
import features.creaturepicker.ui.FilterPane;
import javafx.geometry.Bounds;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import javafx.util.StringConverter;
import features.creaturecatalog.service.CreatureService;
import ui.components.SliderControl;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import ui.components.ThemeColors;

/**
 * Encounter controls panel shown above the monster list.
 * Layout: filter section on top (including table selector), 2x2 slider grid below.
 */
public class EncounterControls extends VBox {

    private final EncounterApplicationService encounterService;
    private FilterPane filterPane;
    private Consumer<CreatureService.FilterCriteria> filterCallback;
    private Consumer<List<Long>> onTableChanged;
    private final SliderControl difficultySlider;
    private final SliderControl groupSlider;
    private final SliderControl balanceSlider;
    private final SliderControl amountSlider;

    private final VBox filterRegion;

    // Table selector — a popup button styled like the other filter triggers, with checkbox multi-select
    private final Button tableButton;
    private final Popup tablePopup;
    private final VBox tableListBox;
    private final List<EncounterTable> selectedTables = new ArrayList<>();
    // CheckBox nodes keyed by stable table ID.
    private final Map<Long, CheckBox> tableCheckboxById = new LinkedHashMap<>();

    private final Label filterHeader;
    private final Label encounterHeader;

    private boolean combatMode = false;
    private int partySizeForSliders = 1;
    private int avgLevelForDifficulty = 1;

    public EncounterControls(EncounterApplicationService encounterService) {
        this.encounterService = Objects.requireNonNull(encounterService);
        setSpacing(0);
        setPadding(new Insets(0));

        // FilterPane starts as empty placeholder, populated when FilterData arrives
        filterRegion = new VBox();
        Label loadingLabel = new Label("Lade Filter...");
        loadingLabel.getStyleClass().add("text-muted");
        filterRegion.getChildren().add(loadingLabel);

        // Sliders
        difficultySlider = new SliderControl("Schwierigkeit", 0, 100, 50, false,
                "XP-Budget von Easy bis 125% Deadly",
                new StringConverter<>() {
                    @Override public String toString(Double v) { return ""; }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> {
                    double t = Math.max(0.0, Math.min(1.0, v / 100.0));
                    int xp = EncounterControls.this.encounterService.previewDifficultyTargetXp(
                            avgLevelForDifficulty, partySizeForSliders, t);
                    return xp + " XP";
                },
                25.0);
        difficultySlider.addSliderStyleClass("difficulty-slider");

        groupSlider = new SliderControl("Gruppen", 1, 5, 3, true,
                "Steuert die Ziel-Anzahl an Monster-Initiative-Slots (via Mob-Regeln)",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        int lvl = Math.max(1, Math.min(5, (int) Math.round(v)));
                        int slots = EncounterControls.this.encounterService.previewTargetMonsterSlots(
                                partySizeForSliders, lvl);
                        return String.valueOf(slots);
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> {
                    int lvl = Math.max(1, Math.min(5, (int) Math.round(v)));
                    int slots = EncounterControls.this.encounterService.previewTargetMonsterSlots(
                            partySizeForSliders, lvl);
                    return slots + " Init.-Slots";
                });

        balanceSlider = new SliderControl("Balance", 1, 5, 3, true,
                "1: XP-Enden bevorzugen, 5: mittlere XP bevorzugen",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 1) return "Enden";
                        if (v >= 5) return "Mitte";
                        return "";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> {
                    int lvl = (int) Math.round(v);
                    return switch (lvl) {
                        case 1 -> "Enden++";
                        case 2 -> "Enden+";
                        case 3 -> "Neutral";
                        case 4 -> "Mitte+";
                        default -> "Mitte++";
                    };
                });

        amountSlider = new SliderControl("Menge", 1, 5, 3, false,
                "1: wenige Kreaturen, 5: viele Kreaturen",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (Math.abs(v - 1.0) <= 0.1) return "1";
                        if (Math.abs(v - 2.0) <= 0.1) return "x2";
                        if (Math.abs(v - 3.0) <= 0.1) return "x4";
                        if (Math.abs(v - 4.0) <= 0.1) return "x8";
                        if (Math.abs(v - 5.0) <= 0.1) return "\u221E";
                        return "";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> {
                    int target = EncounterControls.this.encounterService.previewTargetCreaturesForAmount(
                            v, partySizeForSliders);
                    return target == Integer.MAX_VALUE ? "\u221E" : String.valueOf(target);
                },
                1.0);

        // Table selector button — styled like SearchableFilterButton
        tableListBox = new VBox(2);
        tableListBox.getStyleClass().add("filter-dropdown");
        tableListBox.setPadding(new Insets(8));

        tablePopup = new Popup();
        tablePopup.setAutoHide(true);
        tablePopup.getContent().add(tableListBox);

        tableButton = new Button("Tabelle \u25BE");
        tableButton.getStyleClass().addAll("compact", "filter-trigger");
        tableButton.setOnAction(e -> {
            if (tablePopup.isShowing()) {
                tablePopup.hide();
            } else {
                Bounds b = tableButton.localToScreen(tableButton.getBoundsInLocal());
                if (b != null) tablePopup.show(tableButton, b.getMinX(), b.getMaxY() + 2);
            }
        });
        // Populate with empty placeholder until real data loads via setTableList
        tableListBox.getChildren().add(new Label("Lade Tabellen..."));

        // Section headers for visual hierarchy
        filterHeader = new Label("FILTER");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");

        encounterHeader = new Label("ENCOUNTER");
        encounterHeader.getStyleClass().addAll("section-header", "text-muted");

        HBox.setHgrow(difficultySlider, Priority.ALWAYS);
        HBox.setHgrow(groupSlider, Priority.ALWAYS);
        HBox.setHgrow(balanceSlider, Priority.ALWAYS);
        HBox.setHgrow(amountSlider, Priority.ALWAYS);

        applyHorizontalLayout();
    }

    private VBox buildFilterRow() {
        filterRegion.setPadding(new Insets(0, 4, 0, 4));
        return new VBox(0, filterHeader, filterRegion);
    }

    private void applyHorizontalLayout() {
        // Row 0: FILTER (includes table selector injected into FilterPane's filter row)
        VBox filterRow = buildFilterRow();

        // Row 1: ENCOUNTER — 2×2 slider grid
        HBox sliderRow1 = new HBox(8, difficultySlider, groupSlider);
        HBox sliderRow2 = new HBox(8, balanceSlider, amountSlider);
        VBox sliderGrid = new VBox(4, sliderRow1, sliderRow2);
        sliderGrid.setMaxWidth(Double.MAX_VALUE);
        sliderGrid.setPadding(new Insets(0, 4, 0, 4));

        VBox encounterSection = new VBox(0, encounterHeader, sliderGrid);

        getChildren().setAll(filterRow, ThemeColors.controlSeparator(), encounterSection);
        setMaxHeight(Double.MAX_VALUE);
    }

    // ---- Public API ----

    /** Switch between combat mode (filter only) and builder mode (filter + sliders). */
    public void setCombatMode(boolean combat) {
        if (this.combatMode == combat) return;
        this.combatMode = combat;
        if (combat) applyCombatLayout();
        else applyHorizontalLayout();
    }

    private void applyCombatLayout() {
        getChildren().setAll(buildFilterRow());
        setMaxHeight(Double.MAX_VALUE);
    }

    /** Initialize filter pane with async-loaded data. Replaces loading placeholder. */
    public void setFilterData(CreatureService.FilterOptions data) {
        filterPane = new FilterPane(data);
        filterRegion.getChildren().setAll(filterPane);
        if (filterCallback != null) filterPane.setOnFilterChanged(filterCallback);
        filterPane.addToFilterRow(tableButton);
        filterPane.setExternalChipSource(this::buildTableChips);
        filterPane.refreshChips();
    }

    /** Wires the filter-change callback. May be called before or after {@link #setFilterData}. */
    public void setOnFilterChanged(Consumer<CreatureService.FilterCriteria> callback) {
        this.filterCallback = callback;
        if (filterPane != null) filterPane.setOnFilterChanged(callback);
    }

    /** Fires with the selected table IDs (empty = all creatures) whenever the selection changes. */
    public void setOnTableChanged(Consumer<List<Long>> callback) {
        this.onTableChanged = callback;
    }

    /**
     * Returns the current filter criteria, or an empty (no-filter) criteria if the FilterPane
     * has not yet loaded.
     */
    public CreatureService.FilterCriteria buildCriteria() {
        return filterPane != null ? filterPane.buildCriteria() : CreatureService.FilterCriteria.empty();
    }

    /**
     * Populates the table selector popup. Call once after async load.
     * Removes any selected tables that are no longer present and fires the change callback if needed.
     */
    public void setTableList(List<EncounterTable> tables) {
        tableListBox.getChildren().clear();
        tableCheckboxById.clear();

        List<Long> beforeIds = selectedTables.stream().map(t -> t.tableId).toList();
        Map<Long, EncounterTable> tableById = new LinkedHashMap<>();
        for (EncounterTable t : tables) tableById.put(t.tableId, t);

        List<EncounterTable> reboundSelection = new ArrayList<>();
        for (Long id : beforeIds) {
            EncounterTable fresh = tableById.get(id);
            if (fresh != null) reboundSelection.add(fresh);
        }
        selectedTables.clear();
        selectedTables.addAll(reboundSelection);
        List<Long> afterIds = selectedTables.stream().map(t -> t.tableId).toList();

        // "Alle Monster" clear button
        Button clearAll = new Button("(Alle Monster)");
        clearAll.setMaxWidth(Double.MAX_VALUE);
        clearAll.getStyleClass().addAll("flat", "compact");
        clearAll.setOnAction(e -> {
            selectedTables.clear();
            tableCheckboxById.values().forEach(cb -> cb.setSelected(false));
            tablePopup.hide();
            updateTableButton();
            fireTableChanged();
        });
        tableListBox.getChildren().add(clearAll);

        for (EncounterTable t : tables) {
            boolean checked = selectedTables.stream().anyMatch(s -> s.tableId == t.tableId);
            CheckBox cb = new CheckBox(t.name);
            cb.setUserData(t.tableId);
            cb.setSelected(checked);
            cb.setMaxWidth(Double.MAX_VALUE);
            cb.setOnAction(e -> {
                if (cb.isSelected()) {
                    if (selectedTables.stream().noneMatch(s -> s.tableId == t.tableId))
                        selectedTables.add(t);
                } else {
                    selectedTables.removeIf(s -> s.tableId == t.tableId);
                }
                updateTableButton();
                fireTableChanged();
            });
            tableCheckboxById.put(t.tableId, cb);
            tableListBox.getChildren().add(cb);
        }

        updateTableButton();
        if (!beforeIds.equals(afterIds)) fireTableChanged();
    }

    private void updateTableButton() {
        tableButton.getStyleClass().remove("filter-trigger-active");
        if (selectedTables.isEmpty()) {
            tableButton.setText("Tabelle \u25BE");
        } else if (selectedTables.size() == 1) {
            tableButton.setText(selectedTables.get(0).name + " \u25BE");
            tableButton.getStyleClass().add("filter-trigger-active");
        } else {
            tableButton.setText("Tabellen (" + selectedTables.size() + ") \u25BE");
            tableButton.getStyleClass().add("filter-trigger-active");
        }
        // Rebuild chips in filter pane
        if (filterPane != null) {
            filterPane.setExternalChipSource(() -> buildTableChips());
            filterPane.refreshChips();
        }
    }

    private void fireTableChanged() {
        if (onTableChanged != null) {
            List<Long> ids = selectedTables.stream().map(t -> t.tableId).toList();
            onTableChanged.accept(ids);
        }
    }

    private List<Node> buildTableChips() {
        List<Node> chips = new ArrayList<>();
        for (EncounterTable t : List.copyOf(selectedTables)) {
            HBox chip = new HBox(2);
            chip.getStyleClass().addAll("chip", "chip-table");
            chip.getChildren().add(new javafx.scene.control.Label(t.name));
            Button x = new Button("\u00d7");
            x.getStyleClass().addAll("flat", "compact", "chip-remove-btn");
            x.setAccessibleText("Entfernen: " + t.name);
            x.setOnAction(e -> {
                long tableId = t.tableId;
                selectedTables.removeIf(s -> s.tableId == tableId);
                uncheckTableCheckbox(tableId);
                updateTableButton();
                fireTableChanged();
            });
            chip.getChildren().add(x);
            chips.add(chip);
        }
        return chips;
    }

    private void uncheckTableCheckbox(long tableId) {
        CheckBox byMap = tableCheckboxById.get(tableId);
        if (byMap != null) {
            byMap.setSelected(false);
            return;
        }
        for (Node node : tableListBox.getChildren()) {
            if (!(node instanceof CheckBox cb)) continue;
            Object userData = cb.getUserData();
            if (userData instanceof Long id && id == tableId) {
                cb.setSelected(false);
                return;
            }
        }
    }

    /**
     * Returns the currently selected encounter table IDs (empty list = all creatures).
     */
    public List<Long> getSelectedTableIds() {
        return selectedTables.stream().map(t -> t.tableId).toList();
    }

    /** @return slider value in [0.0, 1.0], or -1.0 ({@link ui.components.SliderControl#AUTO_VALUE}) if Auto is selected. */
    public double getSelectedDifficulty() { return difficultySlider.isAuto() ? -1.0 : difficultySlider.getValue() / 100.0; }
    /** @return groups level in [1, 5], or -1 if Auto is selected. */
    public int getSelectedGroupsLevel()   { return groupSlider.isAuto() ? -1 : (int) Math.round(groupSlider.getValue()); }
    /** @return balance level in [1, 5], or -1 if Auto is selected. */
    public int getSelectedBalanceLevel()  { return balanceSlider.isAuto() ? -1 : (int) Math.round(balanceSlider.getValue()); }
    /** @return amount value in [1.0, 5.0], or -1.0 if Auto is selected. */
    public double getSelectedAmountValue() { return amountSlider.isAuto() ? -1.0 : amountSlider.getValue(); }

    /** Updates party-dependent slider labels (amount + exact difficulty XP budget). */
    public void setPartyContext(int partySize, int avgLevel) {
        this.partySizeForSliders = Math.max(1, partySize);
        this.avgLevelForDifficulty = Math.max(1, Math.min(20, avgLevel));
        difficultySlider.refreshDisplay();
        groupSlider.refreshDisplay();
        amountSlider.refreshDisplay();
    }
}
