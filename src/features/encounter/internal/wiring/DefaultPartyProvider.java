package features.encounter.internal.wiring;

import features.encounter.builder.application.ports.PartyProvider;
import features.party.api.PartyApi;

import java.util.List;

public final class DefaultPartyProvider implements PartyProvider {

    @Override
    public List<PartyApi.PartyMember> getActiveParty() {
        return PartyApi.loadActiveParty().members();
    }

    @Override
    public int averageLevel(List<PartyApi.PartyMember> party) {
        return PartyApi.calculatePartyLevel(party);
    }
}
