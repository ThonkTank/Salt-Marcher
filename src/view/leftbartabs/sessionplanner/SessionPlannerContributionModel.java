package src.view.leftbartabs.sessionplanner;

import java.util.Objects;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCatalogSnapshot;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;

public final class SessionPlannerContributionModel {

    private final SessionPlannerControlsContentModel controlsContentModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final SessionPlannerTimelineMainContentModel timelineMainContentModel;
    private final SessionPlannerStateContentModel stateContentModel;

    SessionPlannerContributionModel(
            SessionPlannerControlsContentModel controlsContentModel,
            CatalogCrudControlsContentModel catalogContentModel,
            SessionPlannerTimelineMainContentModel timelineMainContentModel,
            SessionPlannerStateContentModel stateContentModel
    ) {
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
        this.timelineMainContentModel = Objects.requireNonNull(timelineMainContentModel, "timelineMainContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
    }

    void bindReadback(
            SessionPlannerCurrentSessionModel sessionModel,
            SessionPlannerCatalogModel catalogModel,
            SessionPlannerParticipantsModel participantsModel,
            SessionPlannerEncountersModel encountersModel,
        SessionPlannerStatePanelModel statePanelModel
    ) {
        sessionModel.subscribe(controlsContentModel::applySession);
        catalogModel.subscribe(this::applyCatalog);
        participantsModel.subscribe(controlsContentModel::applyParticipants);
        encountersModel.subscribe(timelineMainContentModel::applyEncounters);
        statePanelModel.subscribe(stateContentModel::applyStatePanel);
        controlsContentModel.applySession(sessionModel.current());
        applyCatalog(catalogModel.current());
        controlsContentModel.applyParticipants(participantsModel.current());
        timelineMainContentModel.applyEncounters(encountersModel.current());
        stateContentModel.applyStatePanel(statePanelModel.current());
    }

    private void applyCatalog(SessionPlannerCatalogSnapshot catalog) {
        SessionPlannerCatalogSnapshot safe = catalog == null ? SessionPlannerCatalogSnapshot.empty() : catalog;
        catalogContentModel.showCatalog(new CatalogCrudControlsContentModel.CatalogState(
                "Sessions",
                "Session auswaehlen",
                "Keine Sessions verfuegbar.",
                safe.selectedSessionId() <= 0L ? "" : Long.toString(safe.selectedSessionId()),
                safe.sessions().stream()
                        .map(session -> new CatalogCrudControlsContentModel.Item(
                                Long.toString(session.sessionId()),
                                session.displayName(),
                                "",
                                0L,
                                true))
                        .toList(),
                new CatalogCrudControlsContentModel.Actions(true, true, true, false),
                false,
                safe.statusText()));
    }
}
