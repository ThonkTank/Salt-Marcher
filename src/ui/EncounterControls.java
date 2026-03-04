package ui;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import services.XpCalculator;
import ui.components.SliderControl;

/**
 * Encounter controls panel shown above the monster list.
 * Layout: filter section on top, 2x2 slider grid below.
 */
public class EncounterControls extends VBox {

    private FilterPane filterPane;
    private final SliderControl difficultySlider;
    private final SliderControl groupSlider;
    private final SliderControl balanceSlider;
    private final SliderControl strengthSlider;

    private final VBox filterRegion;
    private final VBox sliderSection;

    private final HBox sliderRow1;
    private final HBox sliderRow2;
    private final VBox sliderGrid;

    private final Label filterHeader;
    private final Label encounterHeader;

    private boolean combatMode = false;

    public EncounterControls() {
        setSpacing(0);
        setPadding(new Insets(0));
        getStyleClass().add("encounter-controls");

        // FilterPane starts as empty placeholder, populated when FilterData arrives
        filterRegion = new VBox();
        Label loadingLabel = new Label("Lade Filter...");
        loadingLabel.getStyleClass().add("text-muted");
        filterRegion.getChildren().add(loadingLabel);

        // Sliders
        difficultySlider = new SliderControl("Schwierigkeit", 0, 100, 33, false,
                "Wie schwer der Encounter sein soll",
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

        strengthSlider = new SliderControl("Staerke", 0, 100, 50, false,
                "Links: viele schwache Kreaturen. Rechts: wenige starke",
                new StringConverter<>() {
                    @Override public String toString(Double v) {
                        if (v <= 0) return "Schwarm"; if (v >= 100) return "Elite"; return "";
                    }
                    @Override public Double fromString(String s) { return 0.0; }
                },
                v -> v < 30 ? "Schwarm" : v < 70 ? "Gemischt" : "Elite");

        // ---- Persistent regions ----

        sliderSection = new VBox(2, difficultySlider, groupSlider, balanceSlider, strengthSlider);
        sliderSection.setPadding(new Insets(4, 8, 4, 8));

        // Section headers for visual hierarchy
        filterHeader = new Label("FILTER");
        filterHeader.getStyleClass().addAll("section-header", "text-muted");

        encounterHeader = new Label("ENCOUNTER");
        encounterHeader.getStyleClass().addAll("section-header", "text-muted");

        // Paired rows + grid
        sliderRow1 = new HBox(8);
        sliderRow2 = new HBox(8);
        sliderGrid = new VBox(2, sliderRow1, sliderRow2);
        HBox.setHgrow(difficultySlider, Priority.ALWAYS);
        HBox.setHgrow(groupSlider, Priority.ALWAYS);
        HBox.setHgrow(balanceSlider, Priority.ALWAYS);
        HBox.setHgrow(strengthSlider, Priority.ALWAYS);

        applyHorizontalLayout();
    }

    private void applyHorizontalLayout() {
        if (!getStyleClass().contains("encounter-controls-horizontal"))
            getStyleClass().add("encounter-controls-horizontal");

        // Row 1: FILTER — full width
        filterRegion.setPadding(new Insets(0, 4, 0, 4));
        VBox filterRow = new VBox(0, filterHeader, filterRegion);

        // Row 2: ENCOUNTER — 2×2 slider grid + buttons

        sliderRow1.getChildren().setAll(difficultySlider, groupSlider);
        sliderRow2.getChildren().setAll(balanceSlider, strengthSlider);
        sliderGrid.getChildren().setAll(sliderRow1, sliderRow2);
        sliderGrid.setMaxWidth(Double.MAX_VALUE);
        sliderGrid.setPadding(new Insets(0, 4, 0, 4));

        setSliderCompact(false);

        VBox encounterSection = new VBox(0, encounterHeader, sliderGrid);

        // Assemble: Row1 (filter) | separator | Row2 (encounter)
        getChildren().setAll(filterRow, ThemeColors.controlSeparator(), encounterSection);
        setMaxHeight(Double.MAX_VALUE);
    }

    private void setSliderCompact(boolean compact) {
        difficultySlider.setCompact(compact);
        groupSlider.setCompact(compact);
        balanceSlider.setCompact(compact);
        strengthSlider.setCompact(compact);
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
        if (!getStyleClass().contains("encounter-controls-horizontal"))
            getStyleClass().add("encounter-controls-horizontal");

        filterRegion.setPadding(new Insets(0, 4, 0, 4));
        VBox filterRow = new VBox(0, filterHeader, filterRegion);

        getChildren().setAll(filterRow);
        setMaxHeight(Double.MAX_VALUE);
    }

    public FilterPane getFilterPane() { return filterPane; }

    /** Initialize filter pane with async-loaded data. Replaces loading placeholder. */
    public void setFilterData(FilterPane.FilterData data) {
        filterPane = new FilterPane(data);
        filterRegion.getChildren().setAll(filterPane);
    }

    public double getSelectedDifficulty() { return difficultySlider.getValue() < 0 ? -1 : difficultySlider.getValue() / 100.0; }
    public int getSelectedGroupCount()    { return groupSlider.isAuto() ? -1 : (int) Math.round(groupSlider.getValue()); }
    public double getSelectedBalance()    { return balanceSlider.getValue() < 0 ? -1 : balanceSlider.getValue() / 100.0; }
    public double getSelectedStrength()   { return strengthSlider.getValue() < 0 ? -1 : strengthSlider.getValue() / 100.0; }
}
