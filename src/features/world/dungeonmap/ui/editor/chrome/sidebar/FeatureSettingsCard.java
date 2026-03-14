package features.world.dungeonmap.ui.editor.chrome.sidebar;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.List;
import java.util.function.Consumer;

final class FeatureSettingsCard {

    private final Label categoryValueLabel = new Label("-");
    private final Label selectedFeatureValueLabel = new Label("-");
    private final Button deleteFeatureButton = new Button("Selektiertes Feature löschen");
    private final VBox root;

    private List<DungeonFeature> knownFeatures = List.of();
    private DungeonFeatureCategory activeCategory = DungeonFeatureCategory.HAZARD;
    private Long selectedFeatureId;
    private boolean mapLoaded;

    public FeatureSettingsCard() {
        Label categoryLabel = new Label("Aktive Art");
        categoryLabel.getStyleClass().add("text-muted");
        Label selectedFeatureLabel = new Label("Auswahl");
        selectedFeatureLabel.getStyleClass().add("text-muted");
        deleteFeatureButton.getStyleClass().add("danger");
        root = DungeonSidebarCards.createCard(
                "Features",
                new VBox(
                        6,
                        categoryLabel,
                        categoryValueLabel,
                        selectedFeatureLabel,
                        selectedFeatureValueLabel,
                        deleteFeatureButton));
        refresh();
    }

    public Node root() {
        return root;
    }

    public void setMapLoaded(boolean loaded) {
        mapLoaded = loaded;
        refresh();
    }

    public void setFeatures(List<DungeonFeature> features) {
        knownFeatures = features == null ? List.of() : List.copyOf(features);
        refresh();
    }

    public void setActiveCategory(DungeonFeatureCategory category) {
        activeCategory = category == null ? DungeonFeatureCategory.HAZARD : category;
        refresh();
    }

    public DungeonFeatureCategory activeCategory() {
        return activeCategory;
    }

    public void setSelectedFeature(Long featureId) {
        selectedFeatureId = featureId;
        refresh();
    }

    public DungeonFeature selectedFeature() {
        if (selectedFeatureId == null) {
            return null;
        }
        for (DungeonFeature feature : knownFeatures) {
            if (selectedFeatureId.equals(feature.featureId())) {
                return feature;
            }
        }
        return null;
    }

    public Long selectedFeatureId() {
        return selectedFeatureId;
    }

    public void clearSelection() {
        selectedFeatureId = null;
        refresh();
    }

    public void setOnDeleteRequested(Consumer<Node> callback) {
        Consumer<Node> safeCallback = callback == null ? ignored -> { } : callback;
        deleteFeatureButton.setOnAction(event -> safeCallback.accept(deleteFeatureButton));
    }

    private void refresh() {
        categoryValueLabel.setText(activeCategory.label());
        DungeonFeature selected = selectedFeature();
        selectedFeatureValueLabel.setText(selected == null ? "-" : selected.toString());
        deleteFeatureButton.setDisable(!mapLoaded || selected == null);
    }
}
