package src.data.encounter.repository;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.ReadStatus;

public final class ApplicationEncounterPartyFactsRepository implements EncounterPartyFactsRepository {

    private final PartyApplicationService party;
    private final ActivePartyModel activePartyModel;
    private final ActivePartyCompositionModel activePartyCompositionModel;
    private final AdventuringDaySummaryModel adventuringDaySummaryModel;
    private final PartyMutationModel partyMutationModel;

    public ApplicationEncounterPartyFactsRepository(
            PartyApplicationService party,
            ActivePartyModel activePartyModel,
            ActivePartyCompositionModel activePartyCompositionModel,
            AdventuringDaySummaryModel adventuringDaySummaryModel,
            PartyMutationModel partyMutationModel
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.activePartyModel = Objects.requireNonNull(activePartyModel, "activePartyModel");
        this.activePartyCompositionModel = Objects.requireNonNull(
                activePartyCompositionModel,
                "activePartyCompositionModel");
        this.adventuringDaySummaryModel = Objects.requireNonNull(
                adventuringDaySummaryModel,
                "adventuringDaySummaryModel");
        this.partyMutationModel = Objects.requireNonNull(partyMutationModel, "partyMutationModel");
    }

    @Override
    public PartyBudgetFacts loadPartyBudgetFacts() {
        ActivePartyCompositionResult compositionResult = activePartyCompositionModel.current();
        AdventuringDayResult adventuringDayResult = adventuringDaySummaryModel.current();
        if (compositionResult.status() != ReadStatus.SUCCESS || adventuringDayResult.status() != ReadStatus.SUCCESS) {
            return PartyBudgetFacts.storageError();
        }
        List<Integer> activeLevels = compositionResult.composition().activePartyLevels();
        if (activeLevels.isEmpty()) {
            return PartyBudgetFacts.noActiveParty();
        }
        return PartyBudgetFacts.success(
                activeLevels,
                compositionResult.composition().averageLevel(),
                adventuringDayResult.summary().consumedXp(),
                adventuringDayResult.summary().totalBudgetXp());
    }

    @Override
    public List<PartyMemberData> loadActiveParty() {
        ActivePartyResult result = activePartyModel.current();
        if (result.status() != ReadStatus.SUCCESS) {
            return List.of();
        }
        return result.members().stream()
                .filter(Objects::nonNull)
                .map(ApplicationEncounterPartyFactsRepository::toPartyMemberData)
                .toList();
    }

    @Override
    public boolean awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        party.awardXp(new AwardPartyXpCommand(partyMemberIds, xpPerCharacter));
        return partyMutationModel.current().status() == MutationStatus.SUCCESS;
    }

    private static PartyMemberData toPartyMemberData(PartyMemberSummary member) {
        return new PartyMemberData(
                "pc-" + member.id(),
                member.id(),
                member.name(),
                member.level());
    }
}
