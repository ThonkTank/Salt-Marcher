package features.world.dungeonmap.ui.editor.chrome.sidebar;

import features.world.dungeonmap.model.editing.BrushShape;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.api.catalog.DungeonEncounterTableSummary;
import features.world.dungeonmap.ui.editor.state.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.state.DungeonColorRenderMode;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

public class DungeonToolSettingsPane extends VBox {

    private final Label activeToolLabel = new Label("Auswahl");
    private final Node overviewCard = DungeonSidebarCards.createCard("Werkzeug", activeToolLabel);
    private final WorkflowMessageCard workflowMessageCard = new WorkflowMessageCard();
    private final BrushSettingsCard brushSettingsCard = new BrushSettingsCard();
    private final AreaSettingsCard areaSettingsCard = new AreaSettingsCard();
    private final FeatureSettingsCard featureSettingsCard = new FeatureSettingsCard();
    private final VisibilitySettingsCard visibilitySettingsCard = new VisibilitySettingsCard();
    private final LinkStatusCard linkStatusCard = new LinkStatusCard();

    public DungeonToolSettingsPane() {
        getStyleClass().addAll("dungeon-sidebar-pane", "dungeon-tool-settings-pane");
        setSpacing(10);
        setPadding(new Insets(10));
        activeToolLabel.getStyleClass().add("dungeon-panel-title");
        getChildren().addAll(
                overviewCard,
                workflowMessageCard.root(),
                brushSettingsCard.root(),
                areaSettingsCard.root(),
                featureSettingsCard.root(),
                visibilitySettingsCard.root(),
                linkStatusCard.root());

        DungeonSidebarCards.setVisible(brushSettingsCard.root(), false);
        DungeonSidebarCards.setVisible(areaSettingsCard.root(), false);
        DungeonSidebarCards.setVisible(featureSettingsCard.root(), false);
        linkStatusCard.reset();
        setMapLoaded(false);
    }

    public void setActiveTool(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        activeToolLabel.setText(effectiveTool.panelTitle());
        clearWorkflowMessage();
        DungeonSidebarCards.setVisible(brushSettingsCard.root(), effectiveTool.brushSettingsVisible());
        DungeonSidebarCards.setVisible(areaSettingsCard.root(), effectiveTool.areaSettingsVisible());
        DungeonSidebarCards.setVisible(featureSettingsCard.root(), effectiveTool.featureSettingsVisible());
        if (effectiveTool.linkStatusVisible()) {
            linkStatusCard.showDefaultPrompt();
        } else {
            linkStatusCard.reset();
        }
    }

    public void showLinkPending(boolean pending) {
        if (pending) {
            linkStatusCard.showPending();
            return;
        }
        linkStatusCard.reset();
    }

    public void showWorkflowMessage(String title, String message) {
        workflowMessageCard.showMessage(title, message);
    }

    public void clearWorkflowMessage() {
        workflowMessageCard.clear();
    }

    public int getBrushSize() {
        return brushSettingsCard.brushSize();
    }

    public BrushShape getBrushShape() {
        return brushSettingsCard.brushShape();
    }

    public void setBrushPaintModeActive(boolean brushPaintModeActive) {
        brushSettingsCard.setBrushPaintModeActive(brushPaintModeActive);
    }

    public void setColorRenderMode(DungeonColorRenderMode mode) {
        visibilitySettingsCard.setColorRenderMode(mode);
    }

    public void setMapLoaded(boolean loaded) {
        areaSettingsCard.setMapLoaded(loaded);
        featureSettingsCard.setMapLoaded(loaded);
    }

    public DungeonArea selectedArea() {
        return areaSettingsCard.selectedArea();
    }

    public Long selectedAreaId() {
        return areaSettingsCard.selectedAreaId();
    }

    public DungeonFeature selectedFeature() {
        return featureSettingsCard.selectedFeature();
    }

    public Long selectedFeatureId() {
        return featureSettingsCard.selectedFeatureId();
    }

    public DungeonFeatureCategory selectedFeatureCategory() {
        return featureSettingsCard.activeCategory();
    }

    public boolean linksVisible() {
        return visibilitySettingsCard.linksVisible();
    }

    public boolean endpointsVisible() {
        return visibilitySettingsCard.endpointsVisible();
    }

    public boolean featuresVisible() {
        return visibilitySettingsCard.featuresVisible();
    }

    public void setAreas(List<DungeonArea> areas) {
        areaSettingsCard.setAreas(areas);
    }

    public void setFeatures(List<DungeonFeature> features) {
        featureSettingsCard.setFeatures(features);
    }

    public void setEncounterTables(List<DungeonEncounterTableSummary> tables) {
        areaSettingsCard.setEncounterTables(tables);
    }

    public void setStoredEncounters(List<features.world.dungeonmap.api.catalog.DungeonEncounterSummary> encounters) {
    }

    public void setSelectedArea(Long areaId) {
        areaSettingsCard.setSelectedArea(areaId);
    }

    public void setSelectedFeatureCategory(DungeonFeatureCategory category) {
        featureSettingsCard.setActiveCategory(category);
    }

    public void setSelectedFeature(Long featureId) {
        featureSettingsCard.setSelectedFeature(featureId);
    }

    public void clearEntitySelections() {
        areaSettingsCard.setSelectedArea(null);
        featureSettingsCard.clearSelection();
    }

    public void clearFeatureSelection() {
        featureSettingsCard.clearSelection();
    }

    public void setOnAreaSelected(Consumer<DungeonArea> onAreaSelected) {
        areaSettingsCard.setOnAreaSelected(onAreaSelected);
    }

    public void setOnAreaProfileSaveRequested(Consumer<DungeonArea> onAreaProfileSaveRequested) {
        areaSettingsCard.setOnSaveRequested(onAreaProfileSaveRequested);
    }

    public void setOnNewAreaRequested(Consumer<Node> callback) {
        areaSettingsCard.setOnCreateRequested(callback);
    }

    public void setOnDeleteAreaRequested(Consumer<Node> callback) {
        areaSettingsCard.setOnDeleteRequested(callback);
    }

    public void setOnDeleteFeatureRequested(Consumer<Node> callback) {
        featureSettingsCard.setOnDeleteRequested(callback);
    }

    public void setOnCancelLink(Runnable onCancelLink) {
        linkStatusCard.setOnCancel(onCancelLink);
    }

    public void setOnLinksVisibilityChanged(Consumer<Boolean> callback) {
        visibilitySettingsCard.setOnLinksVisibilityChanged(callback);
    }

    public void setOnEndpointsVisibilityChanged(Consumer<Boolean> callback) {
        visibilitySettingsCard.setOnEndpointsVisibilityChanged(callback);
    }

    public void setOnFeaturesVisibilityChanged(Consumer<Boolean> callback) {
        visibilitySettingsCard.setOnFeaturesVisibilityChanged(callback);
    }

    public void setOnColorRenderModeChanged(Consumer<DungeonColorRenderMode> onColorRenderModeChanged) {
        visibilitySettingsCard.setOnColorRenderModeChanged(onColorRenderModeChanged);
    }
}
