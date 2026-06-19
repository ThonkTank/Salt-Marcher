package src.data.hex;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.hex.repository.SqliteHexMapRepository;
import src.domain.hex.model.map.repository.HexMapRepository;

public final class HexServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.register(HexMapRepository.class, new SqliteHexMapRepository());
    }
}
