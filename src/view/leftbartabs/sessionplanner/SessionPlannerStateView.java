package src.view.leftbartabs.sessionplanner;

import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

public final class SessionPlannerStateView extends ScrollPane {

    private final Label sceneTitleLabel = label("");
    private final Label sceneDetailLabel = label("");
    private final Label sceneXpLabel = label("");
    private final Label contextLabel = label("");
    private final Label placeholderTitleLabel = label("Katalog-Vorbereitung");
    private final Label placeholderDetailLabel = label("");

    public SessionPlannerStateView() {
        VBox content = new StateContent(
                section("Ausgewaehlte Session-Szene", sceneTitleLabel, sceneDetailLabel, sceneXpLabel, contextLabel),
                section("Read-only Vorbereitung", placeholderTitleLabel, placeholderDetailLabel));
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        setContent(content);
    }

    void bind(SessionPlannerViewModel viewModel) {
        if (viewModel == null) {
            return;
        }
        viewModel.stateProjectionProperty().addListener((ignored, before, after) -> show(after));
        show(viewModel.stateProjectionProperty().get());
    }

    private void show(SessionPlannerViewModel.StateProjection projection) {
        if (projection == null) {
            return;
        }
        sceneTitleLabel.setText(projection.selectedSceneTitle());
        sceneDetailLabel.setText(projection.selectedSceneDetail());
        sceneXpLabel.setText(projection.selectedSceneXpSummary());
        contextLabel.setText(projection.stateContextLabel());
        placeholderTitleLabel.setText(projection.placeholderTitle());
        placeholderDetailLabel.setText(projection.placeholderDetail());
    }

    private static VBox section(String title, Label... labels) {
        return new SectionBox(title, labels);
    }

    private static Label label(String text, String... styleClasses) {
        return new StyledLabel(text, styleClasses);
    }

    private static final class StateContent extends VBox {

        private StateContent(VBox... sections) {
            super(12, sections);
            getStyleClass().add("session-planner-main");
        }
    }

    private static final class SectionBox extends VBox {

        private SectionBox(String title, Label... labels) {
            super(6);
            getStyleClass().add("session-planner-card");
            getChildren().add(label(title, "session-planner-card-title"));
            getChildren().addAll(labels);
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            setWrapText(true);
            getStyleClass().addAll(styleClasses);
        }
    }
}
