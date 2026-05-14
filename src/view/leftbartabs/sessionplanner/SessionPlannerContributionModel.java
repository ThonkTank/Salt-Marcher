package src.view.leftbartabs.sessionplanner;

import java.util.Objects;

public final class SessionPlannerContributionModel {

    private final SessionPlannerControlsContentModel controlsContentModel;
    private final SessionPlannerTimelineMainContentModel timelineMainContentModel;
    private final SessionPlannerLootMainContentModel lootMainContentModel;
    private final SessionPlannerStateContentModel stateContentModel;

    SessionPlannerContributionModel(
            SessionPlannerControlsContentModel controlsContentModel,
            SessionPlannerTimelineMainContentModel timelineMainContentModel,
            SessionPlannerLootMainContentModel lootMainContentModel,
            SessionPlannerStateContentModel stateContentModel
    ) {
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.timelineMainContentModel = Objects.requireNonNull(timelineMainContentModel, "timelineMainContentModel");
        this.lootMainContentModel = Objects.requireNonNull(lootMainContentModel, "lootMainContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
    }

    SessionPlannerControlsContentModel controlsContentModel() {
        return controlsContentModel;
    }

    SessionPlannerTimelineMainContentModel timelineMainContentModel() {
        return timelineMainContentModel;
    }

    SessionPlannerLootMainContentModel lootMainContentModel() {
        return lootMainContentModel;
    }

    SessionPlannerStateContentModel stateContentModel() {
        return stateContentModel;
    }
}
