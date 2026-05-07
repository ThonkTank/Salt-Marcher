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
        VBox content = new VBox(12,
                section("Ausgewaehlter Session-Encounter", encounterTitleLabel, encounterDetailLabel, encounterXpLabel, contextLabel),
                section("Read-only Vorbereitung", placeholderTitleLabel, placeholderDetailLabel));
        content.getStyleClass().add("session-planner-main");
        content.setPadding(new Insets(10));
        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        setContent(content);
    }

    public void show(StateProjection projection) {
        StateProjection safe = projection == null ? StateProjection.empty() : projection;
        encounterTitleLabel.setText(safe.selectedEncounterTitle());
        encounterDetailLabel.setText(safe.selectedEncounterDetail());
        encounterXpLabel.setText(safe.selectedEncounterXpSummary());
        contextLabel.setText(safe.stateContextLabel());
        placeholderTitleLabel.setText(safe.placeholderTitle());
        placeholderDetailLabel.setText(safe.placeholderDetail());
    }

    private static VBox section(String title, Label... labels) {
        VBox section = new VBox(6);
        section.getStyleClass().add("session-planner-card");
        section.setPadding(new Insets(10));
        section.getChildren().add(label(title, "session-planner-card-title"));
        section.getChildren().addAll(labels);
        return section;
    }

    private static Label label(String text, String... styleClasses) {
        Label label = new Label(text);
        label.setWrapText(true);
        label.getStyleClass().addAll(styleClasses);
        return label;
    }
}
