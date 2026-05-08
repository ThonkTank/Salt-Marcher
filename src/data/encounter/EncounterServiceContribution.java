package src.data.encounter;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encounter.query.ApplicationEncounterSessionPlannerFactsAdapter;
import src.data.encounter.repository.ApplicationEncounterPartyFactsRepository;
import src.data.encounter.repository.EncounterPublishedStateRepositoryAdapter;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.plan.port.EncounterPlanRepository;
import src.domain.encounter.published.EncounterBuilderInputsModel;
import src.domain.encounter.published.EncounterStateModel;
import src.domain.encounter.published.EncounterTuningPreviewModel;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.sessionplanner.session.port.SessionEncounterFactsLookup;

public final class EncounterServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterPlanRepository repository = new SqliteEncounterPlanRepository();
        EncounterPublishedStateRepositoryAdapter publishedState = new EncounterPublishedStateRepositoryAdapter();
        builder.registerFactory(
                EncounterApplicationService.class,
                services -> new EncounterApplicationService(
                        new ApplicationEncounterPartyFactsRepository(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(ActivePartyCompositionModel.class),
                                services.require(AdventuringDaySummaryModel.class),
                                services.require(PartyMutationModel.class)),
                        services.require(CreaturesApplicationService.class),
                        services.require(EncounterTableApplicationService.class),
                        repository,
                        publishedState));
        builder.registerFactory(
                SessionEncounterFactsLookup.class,
                services -> new ApplicationEncounterSessionPlannerFactsAdapter(
                        repository,
                        new ApplicationEncounterPartyFactsRepository(
                                services.require(PartyApplicationService.class),
                                services.require(ActivePartyModel.class),
                                services.require(ActivePartyCompositionModel.class),
                                services.require(AdventuringDaySummaryModel.class),
                                services.require(PartyMutationModel.class)),
                        services.require(CreaturesApplicationService.class)));
        builder.register(EncounterStateModel.class, publishedState.stateModel);
        builder.register(EncounterBuilderInputsModel.class, publishedState.builderInputsModel);
        builder.register(EncounterTuningPreviewModel.class, publishedState.tuningPreviewModel);
    }
}
