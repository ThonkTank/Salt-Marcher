package src.domain.encounter.model.session.repository;

import java.util.List;
import src.domain.encounter.model.session.model.PartyBudgetFacts;
import src.domain.encounter.model.session.model.PartyMemberData;

public interface EncounterPartyFactsRepository {

    PartyBudgetFacts loadPartyBudgetFacts();

    List<PartyMemberData> loadActiveParty();

    boolean awardXp(List<Long> partyMemberIds, int xpPerCharacter);
}
