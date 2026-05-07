package src.view.leftbartabs.sessionplanner;

import javafx.geometry.Insets;
import javafx.scene.control.ScrollPane;
import javafx.scene.layout.VBox;

public final class SessionPlannerMainView extends ScrollPane {

    public SessionPlannerMainView(
            SessionPlannerTimelineMainView timelineView,
            SessionPlannerLootMainView lootView
    ) {
        VBox content = new MainContent(timelineView, lootView);

        getStyleClass().add("session-planner-main-scroll");
        setFitToWidth(true);
        setContent(content);
        setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
    }

    private static final class MainContent extends VBox {

        private MainContent(SessionPlannerTimelineMainView timelineView, SessionPlannerLootMainView lootView) {
            super(16, timelineView, lootView);
            getStyleClass().add("session-planner-main");
            setPadding(new Insets(10));
        }
    }
}
