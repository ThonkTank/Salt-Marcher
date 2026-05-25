package src.domain.encounter;

import java.util.List;
import java.util.Objects;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;
import src.domain.party.published.AwardPartyXpCommand;

final class EncounterPartyFactsApplicationServiceAssembly implements EncounterPartyFactsRepository {

    private final java.util.function.Supplier<src.domain.encounter.model.session.model.PartyBudgetFacts>
            partyBudgetFacts;
    private final java.util.function.Supplier<List<src.domain.encounter.model.session.model.PartyMemberData>>
            activeParty;
    private final src.domain.party.PartyApplicationService party;
    private final java.util.function.BooleanSupplier xpAwardSucceeded;

    EncounterPartyFactsApplicationServiceAssembly(
            java.util.function.Supplier<src.domain.encounter.model.session.model.PartyBudgetFacts> partyBudgetFacts,
            java.util.function.Supplier<List<src.domain.encounter.model.session.model.PartyMemberData>> activeParty,
            src.domain.party.PartyApplicationService party,
            java.util.function.BooleanSupplier xpAwardSucceeded
    ) {
        this.partyBudgetFacts = Objects.requireNonNull(partyBudgetFacts, "partyBudgetFacts");
        this.activeParty = Objects.requireNonNull(activeParty, "activeParty");
        this.party = Objects.requireNonNull(party, "party");
        this.xpAwardSucceeded = Objects.requireNonNull(xpAwardSucceeded, "xpAwardSucceeded");
    }

    @Override
    public src.domain.encounter.model.session.model.PartyBudgetFacts loadPartyBudgetFacts() {
        return partyBudgetFacts.get();
    }

    @Override
    public List<src.domain.encounter.model.session.model.PartyMemberData> loadActiveParty() {
        return List.copyOf(activeParty.get());
    }

    @Override
    public boolean awardXp(List<Long> partyMemberIds, int xpPerCharacter) {
        party.awardXp(new AwardPartyXpCommand(partyMemberIds, xpPerCharacter));
        return xpAwardSucceeded.getAsBoolean();
    }
}
