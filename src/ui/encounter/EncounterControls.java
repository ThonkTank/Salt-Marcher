package ui.encounter;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import services.CreatureService;
import services.XpCalculator;
import ui.components.FilterPane;
import ui.components.SliderControl;

import java.util.function.Consumer;
import ui.components.ThemeColors;

/**
 * Encounter controls panel shown above the monster list.
 * Layout: filter section on top, 2x2 slider grid below.
 */
public class EncounterControls extends VBox {

    private FilterPane filterPane;
    private Consumer<CreatureService.FilterCriteria> filterCallback;
    private final SliderControl difficultySlider;
    private final SliderControl groupSlider;
    private final SliderControl balanceSlider;
    private final SliderControl strengthSlider;

    private final VBox filterRegion;

    private final Label filterHeader;
    private final Label encounterHeader;

    private boolean combatMode = false;

    public EncounterControls() {
        setSpacing(0);
        setPadding(new Insets(0));
        // No CSS class needed — AppShell applies "control-panel" to the container

        // FilterPane starts as empty placeholder, populated when FilterData arrives
        filterRegion = new VBox();
        Label loadingLabel = new Label("Lade Filter...");
        loadingLabel.getStyleClass().add("text-muted");
        filterRegion.getChildren().add(loadingLabel);

        // Sliders
        difficultySlider = new SliderControl("Schwierigkeit", 0, 100, 33, false,
                "Wie schwer der Encounter sein soll",
                // Tick labels: E=Easy, M=Medium, H=Hard, D=Deadly (abbreviated to fit tick space)
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 16) return "E"; if (v <= 50) return "M";
                        if (v <= 83) return "H"; return "D";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> XpCalculator.classifyDifficulty(v / 100.0));

        groupSlider = new SliderControl("Gruppen", 1, 4, 2, true,
                "Anzahl verschiedener Monsterarten", null,
                v -> ((int) Math.round(v)) + "x");

        balanceSlider = new SliderControl("Balance", 0, 100, 50, false,
                "Links: eine dominante Gruppe. Rechts: alle gleich stark",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 0) return "Dom."; if (v >= 100) return "Gleich"; return "";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> v < 30 ? "Dominant" : v < 70 ? "Mittel" : "Gleich");

        strengthSlider = new SliderControl("St\u00e4rke", 0, 100, 50, false,
                "Links: viele schwache Kreaturen. Rechts: wenige starke",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 0) return "Schwarm"; if (v >= 100) return "Elite"; return "";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> v < 30 ? "Schwarm" : v < 70 ? "Gemischt" : "Elite");

        // Section headers for visual hierarchy
        filterHeader = new Label("FILTER");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");

        encounterHeader = new Label("ENCOUNTER");
        encounterHeader.getStyleClass().addAll("section-header", "text-muted");

        HBox.setHgrow(difficultySlider, Priority.ALWAYS);
        HBox.setHgrow(groupSlider, Priority.ALWAYS);
        HBox.setHgrow(balanceSlider, Priority.ALWAYS);
        HBox.setHgrow(strengthSlider, Priority.ALWAYS);

        applyHorizontalLayout();
    }

    private VBox buildFilterRow() {
        filterRegion.setPadding(new Insets(0, 4, 0, 4));
        return new VBox(0, filterHeader, filterRegion);
    }

    private void applyHorizontalLayout() {

        // Row 1: FILTER — full width
        VBox filterRow = buildFilterRow();

        // Row 2: ENCOUNTER — 2×2 slider grid + buttons

        HBox sliderRow1 = new HBox(8, difficultySlider, groupSlider);
        HBox sliderRow2 = new HBox(8, balanceSlider, strengthSlider);
        VBox sliderGrid = new VBox(4, sliderRow1, sliderRow2);
        sliderGrid.setMaxWidth(Double.MAX_VALUE);
        sliderGrid.setPadding(new Insets(0, 4, 0, 4));

        VBox encounterSection = new VBox(0, encounterHeader, sliderGrid);

        // Assemble: Row1 (filter) | separator | Row2 (encounter)
        getChildren().setAll(filterRow, ThemeColors.controlSeparator(), encounterSection);
        setMaxHeight(Double.MAX_VALUE);
    }

    // ---- Public API ----

    /** Switch between combat mode (filter + quick search) and builder mode (filter + sliders). */
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
    }

    /** Wires the filter-change callback. May be called before or after {@link #setFilterData}. */
    public void setOnFilterChanged(Consumer<CreatureService.FilterCriteria> callback) {
        this.filterCallback = callback;
        if (filterPane != null) filterPane.setOnFilterChanged(callback);
    }

    /**
     * Returns the current filter criteria, or an empty (no-filter) criteria if the FilterPane
     * has not yet loaded. An empty result means the encounter generator will consider all creature
     * types — this is safe but may be surprising if called before the async filter-load completes.
     */
    public CreatureService.FilterCriteria buildCriteria() {
        return filterPane != null ? filterPane.buildCriteria() : CreatureService.FilterCriteria.empty();
    }

    /** @return slider value in [0.0, 1.0], or -1.0 ({@link ui.components.SliderControl#AUTO_VALUE}) if Auto is selected. */
    public double getSelectedDifficulty() { return difficultySlider.isAuto() ? -1.0 : difficultySlider.getValue() / 100.0; }
    /** @return group count in [1, 4], or -1 if Auto is selected. */
    public int getSelectedGroupCount()    { return groupSlider.isAuto() ? -1 : (int) Math.round(groupSlider.getValue()); }
    /** @return balance value in [0.0, 1.0], or -1.0 if Auto is selected. */
    public double getSelectedBalance()    { return balanceSlider.isAuto() ? -1.0 : balanceSlider.getValue() / 100.0; }
    /** @return strength value in [0.0, 1.0], or -1.0 if Auto is selected. */
    public double getSelectedStrength()   { return strengthSlider.isAuto() ? -1.0 : strengthSlider.getValue() / 100.0; }
}
