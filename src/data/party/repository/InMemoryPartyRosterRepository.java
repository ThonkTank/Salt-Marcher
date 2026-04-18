package src.data.party.repository;

import src.data.party.gateway.local.InMemoryPartyRosterGateway;

import java.util.Objects;

public final class InMemoryPartyRosterRepository extends AbstractPartyRosterRepository {

    public InMemoryPartyRosterRepository(InMemoryPartyRosterGateway gateway) {
        super(requiredGateway(gateway)::load, requiredGateway(gateway)::save);
    }

    private static InMemoryPartyRosterGateway requiredGateway(InMemoryPartyRosterGateway gateway) {
        return Objects.requireNonNull(gateway, "gateway");
    }
}
