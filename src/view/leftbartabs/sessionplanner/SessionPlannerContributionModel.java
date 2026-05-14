package src.view.leftbartabs.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

public final class SessionPlannerContributionModel {

    private final SessionPlannerControlsContentModel controlsContentModel;
    private final SessionPlannerTimelineMainContentModel timelineMainContentModel;
    private final SessionPlannerLootMainContentModel lootMainContentModel;
    private final SessionPlannerStateContentModel stateContentModel;

    private SessionPlannerSessionSnapshot sessionSnapshot = SessionPlannerSessionSnapshot.empty("");
    private SessionPlannerParticipantsProjection participantsProjection = SessionPlannerParticipantsProjection.empty();

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

    public void applySession(SessionPlannerSessionSnapshot snapshot) {
        sessionSnapshot = snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
        refreshControlsContentModel();
    }

    public void applyParticipants(SessionPlannerParticipantsProjection projection) {
        participantsProjection = projection == null ? SessionPlannerParticipantsProjection.empty() : projection;
        refreshControlsContentModel();
    }

    public void applyEncounters(SessionPlannerEncountersProjection projection) {
        SessionPlannerEncountersProjection safeProjection =
                projection == null ? SessionPlannerEncountersProjection.empty() : projection;
        timelineMainContentModel.applyEncounters(safeProjection);
        lootMainContentModel.applyEncounters(safeProjection);
    }

    public void applyStatePanel(SessionPlannerStatePanelProjection projection) {
        stateContentModel.applyStatePanel(projection);
    }

    private void refreshControlsContentModel() {
        controlsContentModel.applyReadback(sessionSnapshot, participantsProjection);
    }
}
