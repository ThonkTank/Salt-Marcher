package features.party.adapter.sqlite.repository;
import features.party.adapter.sqlite.gateway.local.SqlitePartyLocalGateway;

import platform.diagnostics.Diagnostics;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;

import java.util.Objects;

public final class SqlitePartyRosterRepository extends AbstractPartyRosterRepository {

    public static FeatureStoreDefinition storeDefinition() {
        return SqlitePartyLocalGateway.storeDefinition();
    }

    public SqlitePartyRosterRepository(FeatureStoreHandle store) {
        this(store, NoopDiagnostics.INSTANCE);
    }

    public SqlitePartyRosterRepository(FeatureStoreHandle store, Diagnostics diagnostics) {
        this(new SqlitePartyLocalGateway(store, diagnostics));
    }

    SqlitePartyRosterRepository(SqlitePartyLocalGateway gateway) {
        super(requiredGateway(gateway)::load, requiredGateway(gateway)::save);
    }

    private static SqlitePartyLocalGateway requiredGateway(SqlitePartyLocalGateway gateway) {
        return Objects.requireNonNull(gateway, "gateway");
    }
}
