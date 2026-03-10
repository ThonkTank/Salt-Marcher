package features.encounter.builder.application.ports;

import features.party.api.PartyApi;

import java.util.List;

public interface PartyProvider {

    List<PartyApi.PartyMember> getActiveParty();

    int averageLevel(List<PartyApi.PartyMember> party);
}
