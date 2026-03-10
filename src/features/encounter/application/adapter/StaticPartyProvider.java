package features.encounter.application.adapter;

import features.encounter.application.EncounterApplicationService;
import features.party.model.PlayerCharacter;
import features.party.service.PartyService;

import java.util.List;

public final class StaticPartyProvider implements EncounterApplicationService.PartyProvider {

    @Override
    public List<PlayerCharacter> getActiveParty() {
        return PartyService.getActivePartyResult().members();
    }

    @Override
    public int averageLevel(List<PlayerCharacter> party) {
        return PartyService.averageLevel(party);
    }
}
