package features.sessionplanner.adapter.javafx;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import features.sessionplanner.api.SessionPlannerApi;
import features.sessionplanner.api.SessionPlannerCatalogModel;
import features.sessionplanner.api.SessionPlannerCurrentSessionModel;
import features.sessionplanner.api.SessionPlannerParticipantsModel;
import features.sessionplanner.api.SessionPlannerSceneTimelineModel;
import features.sessionplanner.api.SessionPlannerStatePanelModel;

public final class SessionPlannerContribution implements ShellContribution {

    private final SessionPlannerApi planner;
    private final SessionPlannerCurrentSessionModel sessionModel;
    private final SessionPlannerCatalogModel catalogModel;
    private final SessionPlannerParticipantsModel participantsModel;
    private final SessionPlannerSceneTimelineModel sceneTimelineModel;
    private final SessionPlannerStatePanelModel statePanelModel;

    public SessionPlannerContribution(
            SessionPlannerApi planner,
            SessionPlannerCurrentSessionModel sessionModel,
            SessionPlannerCatalogModel catalogModel,
            SessionPlannerParticipantsModel participantsModel,
            SessionPlannerSceneTimelineModel sceneTimelineModel,
            SessionPlannerStatePanelModel statePanelModel
    ) {
        this.planner = Objects.requireNonNull(planner, "planner");
        this.sessionModel = Objects.requireNonNull(sessionModel, "sessionModel");
        this.catalogModel = Objects.requireNonNull(catalogModel, "catalogModel");
        this.participantsModel = Objects.requireNonNull(participantsModel, "participantsModel");
        this.sceneTimelineModel = Objects.requireNonNull(sceneTimelineModel, "sceneTimelineModel");
        this.statePanelModel = Objects.requireNonNull(statePanelModel, "statePanelModel");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("session-planner"),
                new NavigationGroupSpec("planning", "Planning", 10),
                15,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/sessionplanner/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        return new SessionPlannerBinder(
                planner,
                sessionModel,
                catalogModel,
                participantsModel,
                sceneTimelineModel,
                statePanelModel).bind();
    }
}
