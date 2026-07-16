package features.party.adapter.sqlite.repository;

import platform.persistence.SqliteDatabase;
import features.party.adapter.sqlite.gateway.local.SqlitePartyLocalGateway;

import java.util.Objects;

public final class SqlitePartyRosterRepository extends AbstractPartyRosterRepository {

    public SqlitePartyRosterRepository() {
        this(new SqlitePartyLocalGateway());
    }

    public SqlitePartyRosterRepository(SqliteDatabase database) {
        this(new SqlitePartyLocalGateway(database));
    }

    SqlitePartyRosterRepository(SqlitePartyLocalGateway gateway) {
        super(requiredGateway(gateway)::load, requiredGateway(gateway)::save);
    }

    private static SqlitePartyLocalGateway requiredGateway(SqlitePartyLocalGateway gateway) {
        return Objects.requireNonNull(gateway, "gateway");
    }
}
