package src.view.statetabs.encounter;

import static src.view.statetabs.encounter.EncounterStateContentModel.ActiveContent.BUILDER;
import static src.view.statetabs.encounter.EncounterStateContentModel.ActiveContent.COMBAT;
import static src.view.statetabs.encounter.EncounterStateContentModel.ActiveContent.INITIATIVE;
import static src.view.statetabs.encounter.EncounterStateContentModel.ActiveContent.RESULTS;

import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;

public final class EncounterStateView extends VBox {

    private static final int BUILDER_INDEX = 0;
    private static final int INITIATIVE_INDEX = 1;
    private static final int COMBAT_INDEX = 2;
    private static final int RESULTS_INDEX = 3;

    private final ContentStack contentArea = new ContentStack();

    public EncounterStateView(
            Node builderContent,
            Node initiativeContent,
            Node combatContent,
            Node resultsContent
    ) {
        contentArea.setContent(builderContent, initiativeContent, combatContent, resultsContent);
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
                activeContent == null ? BUILDER : activeContent;
        switch (safeContent) {
            case INITIATIVE -> contentArea.showContent(INITIATIVE_INDEX);
            case COMBAT -> contentArea.showContent(COMBAT_INDEX);
            case RESULTS -> contentArea.showContent(RESULTS_INDEX);
            case BUILDER -> contentArea.showContent(BUILDER_INDEX);
            default -> showContent(BUILDER_INDEX);
        }
    }

    private void showContent(int contentIndex) {
        contentArea.showContent(contentIndex);
    }

    private void hideAllContent() {
        contentArea.hideAllContent();
    }

    private static final class ContentStack extends StackPane {

        private void setContent(Node... nodes) {
            getChildren().setAll(nodes);
        }

        private void showContent(int contentIndex) {
            for (int index = 0; index < getChildren().size(); index++) {
                showNode(getChildren().get(index), index == contentIndex);
            }
        }

        private void hideAllContent() {
            for (Node child : getChildren()) {
                showNode(child, false);
            }
        }

        private static void showNode(Node child, boolean selected) {
            child.setVisible(selected);
            child.setManaged(selected);
        }
    }
}
