package src.domain.encounter;

import java.util.ArrayList;
import java.util.List;
import shell.api.ServiceRegistry;
import src.domain.encounter.model.session.PartyBudgetFacts;
import src.domain.encounter.model.session.PartyMemberData;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyCompositionModel;
import src.domain.party.published.ActivePartyCompositionResult;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummaryModel;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.ReadStatus;

final class EncounterPartyFactsReadbackServiceAssembly {

    private EncounterPartyFactsReadbackServiceAssembly() {
    }

    static EncounterPartyFactsRepository create(ServiceRegistry services) {
        ActivePartyModel activePartyModel = services.require(ActivePartyModel.class);
        ActivePartyCompositionModel activePartyCompositionModel = services.require(ActivePartyCompositionModel.class);
        AdventuringDaySummaryModel adventuringDaySummaryModel = services.require(AdventuringDaySummaryModel.class);
        PartyMutationModel partyMutationModel = services.require(PartyMutationModel.class);
        return new EncounterPartyFactsApplicationServiceAssembly(
                () -> loadPartyBudgetFacts(activePartyCompositionModel, adventuringDaySummaryModel),
                () -> loadActiveParty(activePartyModel),
                services.require(PartyApplicationService.class),
                () -> partyMutationModel.current().status() == MutationStatus.SUCCESS);
    }

    private static PartyBudgetFacts loadPartyBudgetFacts(
            ActivePartyCompositionModel activePartyCompositionModel,
            AdventuringDaySummaryModel adventuringDaySummaryModel
    ) {
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

    private static List<PartyMemberData> loadActiveParty(ActivePartyModel activePartyModel) {
        ActivePartyResult result = activePartyModel.current();
        if (result.status() != ReadStatus.SUCCESS) {
            return List.of();
        }
        List<PartyMemberData> members = new ArrayList<>();
        for (PartyMemberSummary member : result.members()) {
            if (member != null) {
                members.add(toPartyMemberData(member));
            }
        }
        return List.copyOf(members);
    }

    private static PartyMemberData toPartyMemberData(PartyMemberSummary member) {
        return new PartyMemberData(
                "pc-" + member.id(),
                member.id(),
                member.name(),
                member.level());
    }
}
