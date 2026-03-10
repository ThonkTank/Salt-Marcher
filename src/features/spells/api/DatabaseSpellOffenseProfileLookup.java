package features.spells.api;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

final class DatabaseSpellOffenseProfileLookup implements SpellOffenseProfileLookup {
    private static final Logger LOGGER = Logger.getLogger(DatabaseSpellOffenseProfileLookup.class.getName());

    private final Connection conn;

    DatabaseSpellOffenseProfileLookup(Connection conn) {
        this.conn = conn;
    }

    @Override
    public Optional<SpellOffenseProfile> findByName(String spellName) {
        if (conn == null || spellName == null || spellName.isBlank()) {
            return Optional.empty();
        }
        try {
            return SpellReadApi.findOffenseProfileByName(conn, spellName);
        } catch (SQLException e) {
            LOGGER.log(Level.FINE,
                    "DatabaseSpellOffenseProfileLookup.findByName(): lookup failed for " + spellName,
                    e);
            return Optional.empty();
        }
    }
}
