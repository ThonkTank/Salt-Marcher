package src.view.leftbartabs.sessionplanner;

import javafx.geometry.Insets;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

public final class SessionPlannerMainView extends ScrollPane {

    public SessionPlannerMainView(
            SessionPlannerTimelineMainView timelineView,
            SessionPlannerLootMainView lootView
    ) {
        VBox content = new VBox(16);
        content.getStyleClass().add("session-planner-main");
        content.setPadding(new Insets(10));
        content.getChildren().addAll(timelineView, lootView);

        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setContent(content);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }
}
