package src.data.sessionplanner;

import java.util.Objects;
import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.sessionplanner.query.ApplicationSessionPlannerFactsQueryAdapter;
import src.data.sessionplanner.repository.SessionPlannerPublishedStateRepositoryAdapter;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.sessionplanner.SessionPlannerApplicationService;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerEncountersModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;
import src.domain.sessionplanner.session.port.SessionPlanRepository;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public SessionPlannerServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        SessionPlanRepository repository = new SqliteSessionPlanRepository();
        ForeignServices foreignServices = new ForeignServices();
        ApplicationSessionPlannerFactsQueryAdapter facts = new ApplicationSessionPlannerFactsQueryAdapter(
                foreignServices::party,
                foreignServices::activePartyModel,
                foreignServices::adventuringDayCalculationModel,
                foreignServices::encounterFacts);
        SessionPlannerPublishedStateRepositoryAdapter publishedState =
                new SessionPlannerPublishedStateRepositoryAdapter(repository, facts, facts);
        SessionPlannerApplicationService applicationService =
                new SessionPlannerApplicationService(repository, facts, facts, publishedState);
        builder.registerFactory(
                SessionPlannerApplicationService.class,
                services -> {
                    foreignServices.bind(services);
                    return applicationService;
                });
        builder.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                services -> {
                    foreignServices.bind(services);
                    services.require(SessionPlannerApplicationService.class);
                    return publishedState.currentSessionModel;
                });
        builder.registerFactory(
                SessionPlannerParticipantsModel.class,
                services -> {
                    foreignServices.bind(services);
                    services.require(SessionPlannerApplicationService.class);
                    return publishedState.participantsModel;
                });
        builder.registerFactory(
                SessionPlannerEncountersModel.class,
                services -> {
                    foreignServices.bind(services);
                    services.require(SessionPlannerApplicationService.class);
                    return publishedState.encountersModel;
                });
        builder.registerFactory(
                SessionPlannerStatePanelModel.class,
                services -> {
                    foreignServices.bind(services);
                    services.require(SessionPlannerApplicationService.class);
                    return publishedState.statePanelModel;
                });
    }

    private static final class ForeignServices {

        private boolean bound;
        private PartyApplicationService party;
        private ActivePartyModel activePartyModel;
        private AdventuringDayCalculationModel adventuringDayCalculationModel;
        private SessionEncounterFactsLookup encounterFacts;

        private void bind(ServiceRegistry services) {
            if (bound) {
                return;
            }
            party = services.require(PartyApplicationService.class);
            activePartyModel = services.require(ActivePartyModel.class);
            adventuringDayCalculationModel = services.require(AdventuringDayCalculationModel.class);
            encounterFacts = services.require(SessionEncounterFactsLookup.class);
            bound = true;
        }

        private PartyApplicationService party() {
            return Objects.requireNonNull(party, "party");
        }

        private ActivePartyModel activePartyModel() {
            return Objects.requireNonNull(activePartyModel, "activePartyModel");
        }

        private AdventuringDayCalculationModel adventuringDayCalculationModel() {
            return Objects.requireNonNull(adventuringDayCalculationModel, "adventuringDayCalculationModel");
        }

        private SessionEncounterFactsLookup encounterFacts() {
            return Objects.requireNonNull(encounterFacts, "encounterFacts");
        }
    }
}
