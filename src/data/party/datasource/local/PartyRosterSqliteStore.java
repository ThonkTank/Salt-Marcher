package src.data.party.datasource.local;

import src.data.party.model.PartyCharacterRecord;
import src.data.party.model.PartyPersistenceSchema;
import src.data.party.model.PartyRosterRecord;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

final class PartyRosterSqliteStore {

    private final PartyRosterMetadataSqliteStore metadataStore = new PartyRosterMetadataSqliteStore();
    private final PartyRosterCharacterSqliteStore characterStore = new PartyRosterCharacterSqliteStore();

    PartyRosterRecord load(Connection connection) throws SQLException {
        long nextCharacterId = metadataStore.loadNextCharacterId(connection);
        List<PartyCharacterRecord> characters = characterStore.loadCharacters(connection);
        return new PartyRosterRecord(nextCharacterId, characters);
    }

    void save(Connection connection, PartyRosterRecord rosterRecord) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            characterStore.deleteMissingCharacters(connection, rosterRecord.characters());
            characterStore.upsertCharacters(connection, rosterRecord.characters());
            metadataStore.saveNextCharacterId(connection, rosterRecord.nextCharacterId());
            connection.commit();
        } catch (SQLException exception) {
            connection.rollback();
            throw exception;
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }
}
