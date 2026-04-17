package src.data.party.datasource.local;

import org.jspecify.annotations.Nullable;
import src.data.party.model.PartyCharacterRecord;

import java.sql.PreparedStatement;
import java.sql.SQLException;

final class PartyRosterSqliteValueBinder {

    void bindCharacter(PreparedStatement statement, PartyCharacterRecord character) throws SQLException {
        statement.setLong(1, character.id());
        statement.setString(2, character.name());
        statement.setString(3, blankToNull(character.playerName()));
        statement.setInt(4, character.level());
        statement.setInt(5, sanitizeNonNegative(character.currentXp()));
        statement.setInt(6, sanitizeNonNegative(character.xpSinceLongRest()));
        statement.setInt(7, sanitizeNonNegative(character.xpSinceShortRest()));
        statement.setInt(8, sanitizeCadence(character.shortRestsTakenSinceLongRest()));
        statement.setInt(9, sanitizeBoundedStat(character.passivePerception()));
        statement.setInt(10, sanitizeBoundedStat(character.armorClass()));
        statement.setInt(11, "ACTIVE".equalsIgnoreCase(character.membership()) ? 1 : 0);
    }

    private int sanitizeNonNegative(int value) {
        return Math.max(0, value);
    }

    private int sanitizeCadence(int value) {
        return Math.max(0, Math.min(2, value));
    }

    private int sanitizeBoundedStat(int value) {
        return Math.max(1, value);
    }

    private @Nullable String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
