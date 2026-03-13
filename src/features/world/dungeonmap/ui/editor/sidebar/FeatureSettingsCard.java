package features.world.dungeonmap.ui.editor.sidebar;

import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureCategory;
import features.world.dungeonmap.api.catalog.DungeonEncounterSummary;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

final class FeatureSettingsCard {

    private final ComboBox<DungeonFeatureCategory> featureCategoryCombo = new ComboBox<>();
    private final ComboBox<DungeonFeature> activeFeatureCombo = new ComboBox<>();
    private final ComboBox<DungeonFeature> tileFeatureCombo = new ComboBox<>();
    private final ComboBox<DungeonEncounterSummary> encounterCombo = new ComboBox<>();
    private final Label encounterSelectionLabel = new Label("Gebundenes Encounter");
    private final Button newFeatureButton = new Button("Feature neu");
    private final Button deleteFeatureButton = new Button("Feature löschen");
    private final Button addTileToFeatureButton = new Button("Ausgewähltes Feld hinzufügen");
    private final Button removeTileFromFeatureButton = new Button("Ausgewähltes Feld entfernen");
    private final VBox root;
    private List<DungeonFeature> knownFeatures = List.of();
    private boolean updatingSelections;
    private boolean mapLoaded;
    private Consumer<DungeonFeature> onFeatureSelected;
    private Consumer<DungeonFeature> onTileContextFeatureSelected;
    private Consumer<DungeonEncounterSummary> onEncounterSelected;

    public FeatureSettingsCard() {
        featureCategoryCombo.setPromptText("Kategorie wählen…");
        activeFeatureCombo.setPromptText("Feature wählen…");
        tileFeatureCombo.setPromptText("Feature auf Feld…");
        encounterCombo.setPromptText("Encounter wählen…");
        featureCategoryCombo.setMaxWidth(Double.MAX_VALUE);
        activeFeatureCombo.setMaxWidth(Double.MAX_VALUE);
        tileFeatureCombo.setMaxWidth(Double.MAX_VALUE);
        encounterCombo.setMaxWidth(Double.MAX_VALUE);
        featureCategoryCombo.getItems().setAll(DungeonFeatureCategory.values());
        featureCategoryCombo.setValue(DungeonFeatureCategory.HAZARD);
        deleteFeatureButton.getStyleClass().add("danger");

        activeFeatureCombo.setOnAction(event -> {
            if (!updatingSelections && onFeatureSelected != null) {
                onFeatureSelected.accept(activeFeatureCombo.getValue());
            }
        });
        tileFeatureCombo.setOnAction(event -> {
            if (!updatingSelections && onTileContextFeatureSelected != null) {
                onTileContextFeatureSelected.accept(tileFeatureCombo.getValue());
            }
        });
        featureCategoryCombo.setOnAction(event -> {
            if (!updatingSelections) {
                refreshFeatureChoices(selectedFeatureId());
                updateEncounterSelectionState();
            }
        });
        encounterCombo.setOnAction(event -> {
            if (!updatingSelections && onEncounterSelected != null) {
                onEncounterSelected.accept(encounterCombo.getValue());
            }
        });

        Label featureCategoryLabel = new Label("Aktive Kategorie");
        featureCategoryLabel.getStyleClass().add("text-muted");
        Label activeFeatureLabel = new Label("Aktives Feature");
        activeFeatureLabel.getStyleClass().add("text-muted");
        encounterSelectionLabel.getStyleClass().add("text-muted");
        Label tileFeatureLabel = new Label("Features auf ausgewähltem Feld");
        tileFeatureLabel.getStyleClass().add("text-muted");
        HBox featureActions = DungeonSidebarCards.actionRow(newFeatureButton, deleteFeatureButton);
        VBox featureManagement = new VBox(
                6,
                featureCategoryLabel,
                featureCategoryCombo,
                activeFeatureLabel,
                activeFeatureCombo,
                encounterSelectionLabel,
                encounterCombo,
                featureActions);
        featureManagement.getStyleClass().add("editor-subsection");
        VBox tileAssignment = new VBox(
                6,
                tileFeatureLabel,
                tileFeatureCombo,
                DungeonSidebarCards.actionRow(addTileToFeatureButton, removeTileFromFeatureButton));
        tileAssignment.getStyleClass().add("editor-subsection");
        root = DungeonSidebarCards.createCard("Features", featureManagement, tileAssignment);
        setMapLoaded(false);
        updateEncounterSelectionState();
    }

    public Node root() {
        return root;
    }

    public DungeonFeatureCategory selectedFeatureCategory() {
        return featureCategoryCombo.getValue() == null ? DungeonFeatureCategory.HAZARD : featureCategoryCombo.getValue();
    }

    public DungeonFeature selectedFeature() {
        return activeFeatureCombo.getValue();
    }

    public Long selectedFeatureId() {
        return selectedFeature() == null ? null : selectedFeature().featureId();
    }

    public DungeonEncounterSummary selectedEncounter() {
        return encounterCombo.getValue();
    }

    public void setMapLoaded(boolean loaded) {
        mapLoaded = loaded;
        newFeatureButton.setDisable(!loaded);
        deleteFeatureButton.setDisable(!loaded);
        addTileToFeatureButton.setDisable(!loaded);
        removeTileFromFeatureButton.setDisable(!loaded);
    }

    public void setFeatures(List<DungeonFeature> features) {
        knownFeatures = features == null ? List.of() : List.copyOf(features);
        refreshFeatureChoices(selectedFeatureId());
        updateEncounterSelectionState();
    }

    public void setTileContextFeatures(List<DungeonFeature> features) {
        updatingSelections = true;
        List<DungeonFeature> safe = features == null ? List.of() : List.copyOf(features);
        tileFeatureCombo.getItems().setAll(safe);
        tileFeatureCombo.setValue(safe.isEmpty() ? null : safe.get(0));
        updatingSelections = false;
    }

    public void setStoredEncounters(List<DungeonEncounterSummary> encounters) {
        encounterCombo.getItems().setAll(encounters == null ? List.of() : encounters);
        updateEncounterSelectionState();
    }

    public void setSelectedFeatureCategory(DungeonFeatureCategory category) {
        updatingSelections = true;
        featureCategoryCombo.setValue(category == null ? DungeonFeatureCategory.HAZARD : category);
        refreshFeatureChoices(selectedFeatureId());
        updatingSelections = false;
    }

    public void setSelectedFeature(Long featureId) {
        updatingSelections = true;
        DungeonFeature selected = findFeature(featureId);
        if (selected != null) {
            featureCategoryCombo.setValue(selected.category());
        }
        refreshFeatureChoices(featureId);
        selectEncounter(selected == null ? null : selected.encounterId());
        updateEncounterSelectionState();
        updatingSelections = false;
    }

    public void clearSelection() {
        updatingSelections = true;
        activeFeatureCombo.setValue(null);
        encounterCombo.setValue(null);
        tileFeatureCombo.getItems().clear();
        tileFeatureCombo.setValue(null);
        updatingSelections = false;
        updateEncounterSelectionState();
    }

    public void selectEncounter(Long encounterId) {
        updatingSelections = true;
        encounterCombo.setValue(findEncounter(encounterId));
        updatingSelections = false;
    }

    public void setOnFeatureSelected(Consumer<DungeonFeature> callback) {
        onFeatureSelected = callback;
    }

    public void setOnTileContextFeatureSelected(Consumer<DungeonFeature> callback) {
        onTileContextFeatureSelected = callback;
    }

    public void setOnEncounterSelected(Consumer<DungeonEncounterSummary> callback) {
        onEncounterSelected = callback;
    }

    public void setOnCreateRequested(Consumer<Node> callback) {
        Consumer<Node> safeCallback = callback == null ? ignored -> { } : callback;
        newFeatureButton.setOnAction(event -> safeCallback.accept(newFeatureButton));
    }

    public void setOnDeleteRequested(Consumer<Node> callback) {
        Consumer<Node> safeCallback = callback == null ? ignored -> { } : callback;
        deleteFeatureButton.setOnAction(event -> safeCallback.accept(deleteFeatureButton));
    }

    public void setOnAddTileRequested(Runnable callback) {
        Runnable safeCallback = callback == null ? () -> { } : callback;
        addTileToFeatureButton.setOnAction(event -> safeCallback.run());
    }

    public void setOnRemoveTileRequested(Runnable callback) {
        Runnable safeCallback = callback == null ? () -> { } : callback;
        removeTileFromFeatureButton.setOnAction(event -> safeCallback.run());
    }

    private void refreshFeatureChoices(Long preferredFeatureId) {
        List<DungeonFeature> filtered = new ArrayList<>();
        DungeonFeatureCategory category = selectedFeatureCategory();
        for (DungeonFeature feature : knownFeatures) {
            if (feature.category() == category) {
                filtered.add(feature);
            }
        }
        updatingSelections = true;
        activeFeatureCombo.getItems().setAll(filtered);
        activeFeatureCombo.setValue(findFeature(filtered, preferredFeatureId, filtered.isEmpty() ? null : filtered.get(0)));
        updatingSelections = false;
        updateEncounterSelectionState();
    }

    private void updateEncounterSelectionState() {
        boolean enabled = selectedFeatureCategory() == DungeonFeatureCategory.ENCOUNTER;
        encounterSelectionLabel.setVisible(enabled);
        encounterSelectionLabel.setManaged(enabled);
        encounterCombo.setVisible(enabled);
        encounterCombo.setManaged(enabled);
        encounterCombo.setDisable(!enabled || !mapLoaded);
        if (!enabled) {
            encounterCombo.setValue(null);
        }
    }

    private DungeonFeature findFeature(Long featureId) {
        return findFeature(knownFeatures, featureId, null);
    }

    private static DungeonFeature findFeature(List<DungeonFeature> features, Long featureId, DungeonFeature fallback) {
        if (featureId != null) {
            for (DungeonFeature feature : features) {
                if (featureId.equals(feature.featureId())) {
                    return feature;
                }
            }
        }
        return fallback;
    }

    private DungeonEncounterSummary findEncounter(Long encounterId) {
        if (encounterId != null) {
            for (DungeonEncounterSummary encounter : encounterCombo.getItems()) {
                if (encounterId.equals(encounter.encounterId())) {
                    return encounter;
                }
            }
        }
        return null;
    }
}
