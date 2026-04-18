package src.data.party.repository;

import src.data.party.gateway.local.SqlitePartyLocalGateway;

import java.util.Objects;

public final class SqlitePartyRosterRepository extends AbstractPartyRosterRepository {

    public SqlitePartyRosterRepository(SqlitePartyLocalGateway gateway) {
        super(requiredGateway(gateway)::load, requiredGateway(gateway)::save);
    }

    private static SqlitePartyLocalGateway requiredGateway(SqlitePartyLocalGateway gateway) {
        return Objects.requireNonNull(gateway, "gateway");
    }
}
