package features.encounter.internal.wiring;

import features.encounter.builder.application.ports.PartyProvider;
import features.party.api.PartyApi;

import java.util.List;

public final class DefaultPartyProvider implements PartyProvider {

    @Override
    public List<PartyApi.PartyMemberSummary> getActiveParty() {
        return PartyApi.loadActiveParty().members();
    }

    @Override
    public int averageLevel(List<PartyApi.PartyMemberSummary> party) {
        return PartyApi.calculatePartyLevel(party);
    }
}
