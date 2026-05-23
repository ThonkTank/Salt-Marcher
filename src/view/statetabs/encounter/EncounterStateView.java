package src.view.statetabs.encounter;

import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class EncounterStateView extends VBox {

    private static final int BUILDER_INDEX = 0;
    private static final int INITIATIVE_INDEX = 1;
    private static final int COMBAT_INDEX = 2;
    private static final int RESULTS_INDEX = 3;

    private final StackPane contentArea = new StackPane();

    public EncounterStateView(
            Node builderContent,
            Node initiativeContent,
            Node combatContent,
            Node resultsContent
    ) {
        contentArea.getChildren().setAll(builderContent, initiativeContent, combatContent, resultsContent);
        hideAllContent();
        getStyleClass().add("surface-root");
        setFillWidth(true);
        setVgrow(contentArea, Priority.ALWAYS);
        getChildren().add(contentArea);
    }

    public void bind(EncounterStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        show(contentModel.activeContentProperty().get());
        contentModel.activeContentProperty().addListener((ignored, before, after) -> show(after));
    }

    private void show(EncounterStateContentModel.ActiveContent activeContent) {
        EncounterStateContentModel.ActiveContent safeContent =
                activeContent == null ? EncounterStateContentModel.ActiveContent.BUILDER : activeContent;
        switch (safeContent) {
            case INITIATIVE -> showContent(INITIATIVE_INDEX);
            case COMBAT -> showContent(COMBAT_INDEX);
            case RESULTS -> showContent(RESULTS_INDEX);
            case BUILDER -> showContent(BUILDER_INDEX);
            default -> showContent(BUILDER_INDEX);
        }
    }

    private void showContent(int contentIndex) {
        for (int index = 0; index < contentArea.getChildren().size(); index++) {
            Node child = contentArea.getChildren().get(index);
            boolean selected = index == contentIndex;
            child.setVisible(selected);
            child.setManaged(selected);
        }
    }

    private void hideAllContent() {
        for (Node child : contentArea.getChildren()) {
            child.setVisible(false);
            child.setManaged(false);
        }
    }
}
