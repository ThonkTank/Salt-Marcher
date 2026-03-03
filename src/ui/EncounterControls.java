package ui;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import services.XpCalculator;
import ui.components.SliderControl;

/**
 * Encounter controls panel with two layout modes:
 *   Vertical (sidebar): filter on top, collapsible sliders, sticky buttons at bottom
 *   Horizontal (top bar): filter | 2x2 slider grid | buttons — single row
 */
public class EncounterControls extends VBox {

    private FilterPane filterPane;
    private final SliderControl difficultySlider;
    private final SliderControl groupSlider;
    private final SliderControl balanceSlider;
    private final SliderControl strengthSlider;

    // Persistent layout regions (created once, rearranged on mode switch)
    private final VBox filterRegion;
    private final VBox sliderSection;
    private final ScrollPane scrollPane;
    private final VBox scrollContent;

    // Horizontal mode: paired slider rows + grid container
    private final HBox sliderRow1;
    private final HBox sliderRow2;
    private final VBox sliderGrid;

    // Section headers (created once, reused in both layout modes to avoid per-toggle allocation)
    private final Label filterHeader;
    private final Label encounterHeader;

    private boolean horizontal = false;

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

        // Scrollable middle zone (filter + sliders)
        scrollContent = new VBox(0, filterHeader, filterRegion, encounterHeader, sliderSection);
        scrollPane = new ScrollPane(scrollContent);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);

        // Paired rows + grid for horizontal mode
        sliderRow1 = new HBox(8);
        sliderRow2 = new HBox(8);
        sliderGrid = new VBox(2, sliderRow1, sliderRow2);
        HBox.setHgrow(difficultySlider, Priority.ALWAYS);
        HBox.setHgrow(groupSlider, Priority.ALWAYS);
        HBox.setHgrow(balanceSlider, Priority.ALWAYS);
        HBox.setHgrow(strengthSlider, Priority.ALWAYS);

        // Default: vertical layout
        applyVerticalLayout();
    }

    /** Switch between vertical (sidebar) and horizontal (top bar) layout. */
    public void setHorizontal(boolean horiz) {
        if (this.horizontal == horiz) return;
        this.horizontal = horiz;
        if (horiz) applyHorizontalLayout();
        else applyVerticalLayout();
    }

    private void applyVerticalLayout() {
        getStyleClass().remove("encounter-controls-horizontal");

        // Sliders back into vertical VBox
        sliderSection.getChildren().setAll(
                difficultySlider, groupSlider, balanceSlider, strengthSlider);
        sliderSection.setSpacing(2);

        setSliderCompact(true);

        VBox.setVgrow(scrollPane, Priority.ALWAYS);
        filterRegion.setPadding(Insets.EMPTY);

        getChildren().setAll(scrollPane);
        setMaxHeight(Double.MAX_VALUE);
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
        setMaxHeight(Region.USE_PREF_SIZE);
    }

    private void setSliderCompact(boolean compact) {
        difficultySlider.setCompact(compact);
        groupSlider.setCompact(compact);
        balanceSlider.setCompact(compact);
        strengthSlider.setCompact(compact);
    }

    // ---- Public API ----

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
