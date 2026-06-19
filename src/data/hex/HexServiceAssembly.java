package src.data.hex;

import shell.api.ServiceRegistry;
import src.data.hex.repository.SqliteHexMapRepository;
import src.domain.hex.model.map.repository.HexMapRepository;

final class HexServiceAssembly {

    void register(ServiceRegistry.Builder builder) {
        builder.register(HexMapRepository.class, new SqliteHexMapRepository());
    }
}
