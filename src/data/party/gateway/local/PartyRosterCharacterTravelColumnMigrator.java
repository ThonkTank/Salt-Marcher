package src.data.party.gateway.local;

import src.data.party.model.PartyPersistenceSchema;

import java.sql.Connection;
import java.sql.SQLException;

final class PartyRosterCharacterTravelColumnMigrator {

    void ensureTravelColumns(Connection connection) throws SQLException {
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_location_kind",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_LOCATION_KIND_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_dungeon_map_id",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_DUNGEON_MAP_ID_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_dungeon_location_kind",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_DUNGEON_LOCATION_KIND_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_dungeon_owner_id",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_DUNGEON_OWNER_ID_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_dungeon_q",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_DUNGEON_Q_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_dungeon_r",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_DUNGEON_R_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_dungeon_level",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_DUNGEON_LEVEL_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_dungeon_heading",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_DUNGEON_HEADING_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_overworld_map_id",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_OVERWORLD_MAP_ID_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "travel_overworld_tile_id",
                statement -> statement.execute(PartyPersistenceSchema.ADD_TRAVEL_OVERWORLD_TILE_ID_COLUMN_SQL));
        PartyRosterColumnMigrationSupport.ensureColumn(
                connection,
                "attached_to_party_token",
                statement -> statement.execute(PartyPersistenceSchema.ADD_ATTACHED_TO_PARTY_TOKEN_COLUMN_SQL));
    }
}
