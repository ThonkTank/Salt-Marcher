package features.encounter.adapter.javafx.state;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.scene.Node;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import features.encounter.api.EncounterStateSnapshot;
import java.util.List;

public final class EncounterStateView extends VBox {

    private final StackPane contentArea = new EncounterContentStack();
    private final Node tuning;

    public EncounterStateView(
            Node builderContent,
            Node initiativeContent,
            Node combatContent,
            Node resultsContent
    ) {
        this(null, builderContent, initiativeContent, combatContent, resultsContent);
    }

    public EncounterStateView(
            Node tuning,
            Node builderContent,
            Node initiativeContent,
            Node combatContent,
            Node resultsContent
    ) {
        this.tuning = tuning;
        ((EncounterContentStack) contentArea).setContent(builderContent, initiativeContent, combatContent, resultsContent);
        getStyleClass().add("surface-root");
        setFillWidth(true);
        setVgrow(contentArea, Priority.ALWAYS);
        if (tuning == null) {
            getChildren().add(contentArea);
        } else {
            getChildren().addAll(tuning, contentArea);
        }
    }

    public void bind(ReadOnlyObjectProperty<EncounterStateSnapshot.Mode> activeMode) {
        if (activeMode == null) {
            return;
        }
        show(activeMode.get());
        activeMode.addListener((ignored, before, after) -> show(after));
    }

    private void show(EncounterStateSnapshot.Mode activeContent) {
        if (tuning != null) {
            boolean builder = activeContent == EncounterStateSnapshot.Mode.BUILDER;
            tuning.setVisible(builder);
            tuning.setManaged(builder);
        }
        showContent(EncounterStateVocabulary.contentIndex(activeContent));
    }

    private void showContent(int contentIndex) {
        ((EncounterContentStack) contentArea).showContent(contentIndex);
    }

    private static final class EncounterContentStack extends StackPane {

        private List<Node> content = List.of();

        void setContent(
                Node builderContent,
                Node initiativeContent,
                Node combatContent,
                Node resultsContent
        ) {
            content = List.of(builderContent, initiativeContent, combatContent, resultsContent);
            showContent(-1);
        }

        void showContent(int contentIndex) {
            if (contentIndex < 0 || contentIndex >= content.size()) {
                getChildren().clear();
            } else {
                getChildren().setAll(content.get(contentIndex));
            }
        }
    }
}
