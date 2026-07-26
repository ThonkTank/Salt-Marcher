package features.party.adapter.sqlite.gateway.local;

import features.party.adapter.sqlite.model.PartyCharacterRecord;
import features.party.adapter.sqlite.model.PartyRosterRecord;
import features.party.adapter.sqlite.model.PartyRosterRecordValidator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

final class PartyRosterSqliteStore {

    private final PartyRosterMetadataSqliteStore metadataStore = new PartyRosterMetadataSqliteStore();
    private final PartyRosterCharacterSqliteStore characterStore = new PartyRosterCharacterSqliteStore();

    PartyRosterRecord load(Connection connection) throws SQLException {
        long nextCharacterId = metadataStore.loadNextCharacterId(connection);
        List<PartyCharacterRecord> characters = characterStore.loadCharacters(connection);
        PartyRosterRecord roster = new PartyRosterRecord(nextCharacterId, characters);
        PartyRosterRecordValidator.validate(roster);
        return roster;
    }

    void save(Connection connection, PartyRosterRecord rosterRecord) throws SQLException {
        PartyRosterRecordValidator.validate(rosterRecord);
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            characterStore.deleteMissingCharacters(connection, rosterRecord.characters());
            characterStore.upsertCharacters(connection, rosterRecord.characters());
            metadataStore.saveNextCharacterId(connection, rosterRecord.nextCharacterId());
            connection.commit();
        } catch (SQLException | RuntimeException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }
}
