package features.encounter.adapter.javafx.state;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import features.encounter.api.EncounterStateSnapshot;

public final class EncounterStateView extends VBox {

    private final StackPane contentArea = new EncounterContentStack();

    public EncounterStateView(
            Node builderContent,
            Node initiativeContent,
            Node combatContent,
            Node resultsContent
    ) {
        ((EncounterContentStack) contentArea).setContent(builderContent, initiativeContent, combatContent, resultsContent);
        getStyleClass().add("surface-root");
        setFillWidth(true);
        setVgrow(contentArea, Priority.ALWAYS);
        getChildren().add(contentArea);
    }

    public void bind(ReadOnlyObjectProperty<EncounterStateSnapshot.Mode> activeMode) {
        if (activeMode == null) {
            return;
        }
        show(activeMode.get());
        activeMode.addListener((ignored, before, after) -> show(after));
    }

    private void show(EncounterStateSnapshot.Mode activeContent) {
        showContent(EncounterStateVocabulary.contentIndex(activeContent));
    }

    private void showContent(int contentIndex) {
        ((EncounterContentStack) contentArea).showContent(contentIndex);
    }

    private static void showNode(Node child, boolean selected) {
        child.setVisible(selected);
        child.setManaged(selected);
    }

    private static final class EncounterContentStack extends StackPane {

        void setContent(
                Node builderContent,
                Node initiativeContent,
                Node combatContent,
                Node resultsContent
        ) {
            getChildren().setAll(builderContent, initiativeContent, combatContent, resultsContent);
            showContent(-1);
        }

        void showContent(int contentIndex) {
            for (int index = 0; index < getChildren().size(); index++) {
                showNode(getChildren().get(index), index == contentIndex);
            }
        }
    }
}
