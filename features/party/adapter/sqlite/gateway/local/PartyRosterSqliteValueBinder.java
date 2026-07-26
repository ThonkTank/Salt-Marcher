package features.party.adapter.sqlite.gateway.local;

import org.jspecify.annotations.Nullable;
import features.party.adapter.sqlite.model.PartyCharacterRecord;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Objects;

final class PartyRosterSqliteValueBinder {

    void bindCharacter(PreparedStatement statement, PartyCharacterRecord character) throws SQLException {
        statement.setLong(1, character.id());
        statement.setString(2, character.identity().name());
        statement.setString(3, blankToNull(character.identity().playerName()));
        setNullableInteger(statement, 4, character.progress().level());
        statement.setInt(5, character.progress().currentXp());
        statement.setInt(6, character.progress().xpSinceLongRest());
        statement.setInt(7, character.progress().xpSinceShortRest());
        statement.setInt(8, character.progress().shortRestsTakenSinceLongRest());
        setNullableInteger(statement, 9, character.combat().passivePerception());
        setNullableInteger(statement, 10, character.combat().armorClass());
        statement.setInt(11, "ACTIVE".equalsIgnoreCase(character.membership()) ? 1 : 0);
        bindTravel(statement, character.travel());
    }

    private void bindTravel(PreparedStatement statement, PartyCharacterRecord.Travel travel) throws SQLException {
        PartyCharacterRecord.Travel safeTravel = Objects.requireNonNull(travel, "travel");
        statement.setString(12, blankToNull(safeTravel.locationKind()));
        setNullableLong(statement, 13, safeTravel.dungeonMapId());
        statement.setString(14, blankToNull(safeTravel.dungeonLocationKind()));
        setNullableLong(statement, 15, safeTravel.dungeonOwnerId());
        setNullableInteger(statement, 16, safeTravel.dungeonQ());
        setNullableInteger(statement, 17, safeTravel.dungeonR());
        setNullableInteger(statement, 18, safeTravel.dungeonLevel());
        statement.setString(19, blankToNull(safeTravel.dungeonHeading()));
        setNullableLong(statement, 20, safeTravel.overworldMapId());
        setNullableLong(statement, 21, safeTravel.overworldTileId());
        statement.setInt(22, safeTravel.attachedToPartyToken() ? 1 : 0);
    }

    private void setNullableLong(PreparedStatement statement, int index, @Nullable Long value) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.BIGINT);
            return;
        }
        statement.setLong(index, value);
    }

    private void setNullableInteger(
            PreparedStatement statement,
            int index,
            @Nullable Integer value
    ) throws SQLException {
        if (value == null) {
            statement.setNull(index, Types.INTEGER);
            return;
        }
        statement.setInt(index, value);
    }

    private @Nullable String blankToNull(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
