package src.domain.party;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartySnapshotModel;
import src.domain.party.published.PartyTravelPositionsModel;

final class PartyServiceAssembly {

    private final AtomicReference<PartyRuntime> runtime = new AtomicReference<>();

    PartyApplicationService createApplicationService(ServiceRegistry services) {
        return runtime(services).applicationService;
    }

    PartySnapshotModel partySnapshotModel(ServiceRegistry services) {
        return runtime(services).partySnapshotModel;
    }

    ActivePartyModel activePartyModel(ServiceRegistry services) {
        return runtime(services).activePartyModel;
    }

    ActivePartyCompositionModel activePartyCompositionModel(ServiceRegistry services) {
        return runtime(services).activePartyCompositionModel;
    }

    AdventuringDaySummaryModel adventuringDaySummaryModel(ServiceRegistry services) {
        return runtime(services).adventuringDaySummaryModel;
    }

    PartyTravelPositionsModel partyTravelPositionsModel(ServiceRegistry services) {
        return runtime(services).partyTravelPositionsModel;
    }

    PartyMutationModel partyMutationModel(ServiceRegistry services) {
        return runtime(services).partyMutationModel;
    }

    AdventuringDayCalculationModel adventuringDayCalculationModel(ServiceRegistry services) {
        return runtime(services).adventuringDayCalculationModel;
    }

    private PartyRuntime runtime(ServiceRegistry services) {
        PartyRuntime existing = runtime.get();
        if (existing != null) {
            return existing;
        }
        PartyRuntime candidate = new PartyRuntime(services.require(PartyRosterRepository.class));
        return runtime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(runtime.get(), "runtime");
    }

    private static final class PartyRuntime {

        private final PartySnapshotModel partySnapshotModel = new PartySnapshotModel();
        private final ActivePartyModel activePartyModel = new ActivePartyModel();
        private final ActivePartyCompositionModel activePartyCompositionModel = new ActivePartyCompositionModel();
        private final AdventuringDaySummaryModel adventuringDaySummaryModel = new AdventuringDaySummaryModel();
        private final PartyTravelPositionsModel partyTravelPositionsModel = new PartyTravelPositionsModel();
        private final PartyMutationModel partyMutationModel = new PartyMutationModel();
        private final AdventuringDayCalculationModel adventuringDayCalculationModel =
                new AdventuringDayCalculationModel();
        private final PartyApplicationService applicationService;

        private PartyRuntime(PartyRosterRepository repository) {
            applicationService = new PartyApplicationService(
                    Objects.requireNonNull(repository, "repository"),
                    partySnapshotModel,
                    activePartyModel,
                    activePartyCompositionModel,
                    adventuringDaySummaryModel,
                    partyTravelPositionsModel,
                    partyMutationModel,
                    adventuringDayCalculationModel);
            applicationService.refreshPublishedState();
        }
    }
}
