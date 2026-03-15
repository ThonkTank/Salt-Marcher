package features.encounter.builder.application.ports;

import features.party.api.PartyApi;

import java.util.List;

public interface PartyProvider {

    List<PartyApi.PartyMemberSummary> getActiveParty();

    int averageLevel(List<PartyApi.PartyMemberSummary> party);
}
