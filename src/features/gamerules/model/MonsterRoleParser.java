package features.gamerules.model;

import java.util.Locale;
import java.util.logging.Logger;

/**
 * Parser for persisted monster role strings stored in the creatures table.
 */
public final class MonsterRoleParser {
    private static final Logger LOGGER = Logger.getLogger(MonsterRoleParser.class.getName());

    private MonsterRoleParser() {
        throw new AssertionError("No instances");
    }

    public static MonsterRole parseOrBrute(String persistedRole) {
        MonsterRole parsed = parseOrNull(persistedRole);
        if (parsed != null) {
            return parsed;
        }
        if (persistedRole != null && !persistedRole.isBlank()) {
            LOGGER.warning(() -> "Unknown persisted monster role '" + persistedRole + "', defaulting to BRUTE");
        }
        return MonsterRole.BRUTE;
    }

    public static MonsterRole parseOrNull(String persistedRole) {
        if (persistedRole == null) return null;
        String normalized = persistedRole.trim();
        if (normalized.isEmpty()) return null;
        String enumName = normalized.replace('-', '_')
                .replace(' ', '_')
                .toUpperCase(Locale.ROOT);
        try {
            return MonsterRole.valueOf(enumName);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
