package src.domain.party;

import java.util.List;
import java.util.Objects;
import src.domain.party.model.roster.model.PartyMutationStatus;
import src.domain.party.model.roster.repository.PartyPublishedStateRepository;
import src.domain.party.model.roster.repository.PartyRosterRepository;
import src.domain.party.published.MutationResult;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartySnapshotModel;

final class PartyPublishedStateServiceAssembly
        extends PartyPublishedModelsServiceAssembly
        implements PartyPublishedStateRepository {

    private final PartyPublishedReadbackServiceAssembly readback;

    PartyPublishedStateServiceAssembly(PartyRosterRepository delegate) {
        PartyRosterRepository repository = Objects.requireNonNull(delegate, "delegate");
        this.readback = new PartyPublishedReadbackServiceAssembly(repository);
        refreshRepositoryBackedState(readback, false);
    }

    PartySnapshotModel partySnapshotModel() {
        return rosterModels.partySnapshotModel();
    }

    ActivePartyModel activePartyModel() {
        return rosterModels.activePartyModel();
    }

    ActivePartyCompositionModel activePartyCompositionModel() {
        return rosterModels.activePartyCompositionModel();
    }

    @Override
    public void publishRepositoryBackedState(PartyPublishedStateRepository.StatePublication publication) {
        refreshRepositoryBackedState(readback, true);
    }

    @Override
    public void publishMutationStatus(PartyMutationStatus status) {
        publishMutationResult(new MutationResult(PartyMutationProjectionServiceAssembly.mapMutationStatus(status)));
    }

    @Override
    public void publishStorageErrorMutation(PartyPublishedStateRepository.StatePublication publication) {
        publishStorageErrorMutationResult();
    }

    @Override
    public void publishAdventuringDayCalculation(
            PartyPublishedStateRepository.AdventuringDayCalculationPublication publication
    ) {
        PartyPublishedStateRepository.AdventuringDayCalculationPublication safePublication =
                publication == null
                        ? new PartyPublishedStateRepository.AdventuringDayCalculationPublication(List.of(), 0)
                        : publication;
        publishAdventuringDayCalculationResult(readback.readAdventuringDayCalculationResult(
                safePublication.levels(),
                safePublication.totalGroupXp()));
    }
}
