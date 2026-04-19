package src.data.party.gateway.local;

import org.jspecify.annotations.Nullable;
import src.data.party.model.PartyCharacterRecord;

import java.sql.PreparedStatement;
import java.sql.SQLException;

final class PartyRosterSqliteValueBinder {

    void bindCharacter(PreparedStatement statement, PartyCharacterRecord character) throws SQLException {
        statement.setLong(1, character.id());
        statement.setString(2, character.identity().name());
        statement.setString(3, blankToNull(character.identity().playerName()));
        statement.setInt(4, character.progress().level());
        statement.setInt(5, sanitizeNonNegative(character.progress().currentXp()));
        statement.setInt(6, sanitizeNonNegative(character.progress().xpSinceLongRest()));
        statement.setInt(7, sanitizeNonNegative(character.progress().xpSinceShortRest()));
        statement.setInt(8, sanitizeCadence(character.progress().shortRestsTakenSinceLongRest()));
        statement.setInt(9, sanitizeBoundedStat(character.combat().passivePerception()));
        statement.setInt(10, sanitizeBoundedStat(character.combat().armorClass()));
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
