package src.view.leftbartabs.sessionplanner;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

public final class SessionPlannerStateView extends ScrollPane {

    private final Label encounterTitleLabel = label("");
    private final Label encounterDetailLabel = label("");
    private final Label encounterXpLabel = label("");
    private final Label contextLabel = label("");
    private final Label placeholderTitleLabel = label("Katalog-Vorbereitung");
    private final Label placeholderDetailLabel = label("");

    public SessionPlannerStateView() {
        VBox content = new StateContent(
                section("Ausgewaehlter Session-Encounter", encounterTitleLabel, encounterDetailLabel, encounterXpLabel, contextLabel),
                section("Read-only Vorbereitung", placeholderTitleLabel, placeholderDetailLabel));
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        setContent(content);
    }

    public void bind(SessionPlannerStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        contentModel.projectionProperty().addListener((ignored, before, after) -> show(after));
        show(contentModel.projectionProperty().get());
    }

    private void show(SessionPlannerStateContentModel.Projection projection) {
        SessionPlannerStateContentModel.Projection safe = projection == null
                ? SessionPlannerStateContentModel.Projection.empty()
                : projection;
        encounterTitleLabel.setText(safe.selectedEncounterTitle());
        encounterDetailLabel.setText(safe.selectedEncounterDetail());
        encounterXpLabel.setText(safe.selectedEncounterXpSummary());
        contextLabel.setText(safe.stateContextLabel());
        placeholderTitleLabel.setText(safe.placeholderTitle());
        placeholderDetailLabel.setText(safe.placeholderDetail());
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
            setPadding(new Insets(10));
        }
    }

    private static final class SectionBox extends VBox {

        private SectionBox(String title, Label... labels) {
            super(6);
            getStyleClass().add("session-planner-card");
            setPadding(new Insets(10));
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
