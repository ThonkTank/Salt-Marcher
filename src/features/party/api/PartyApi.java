package features.party.api;

import database.DatabaseManager;
import features.party.model.PlayerCharacter;
import features.party.repository.PlayerCharacterRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Public cross-feature read facade for party state.
 */
public final class PartyApi {
    private static final Logger LOGGER = Logger.getLogger(PartyApi.class.getName());

    private PartyApi() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public record PartyMember(Long id, String name, int level) {}
    public record ActivePartyResult(ReadStatus status, List<PartyMember> members) {}
    public record PartySnapshotResult(ReadStatus status, List<PartyMember> members, List<PartyMember> available) {}

    public static ActivePartyResult loadActiveParty() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new ActivePartyResult(
                    ReadStatus.SUCCESS,
                    mapMembers(PlayerCharacterRepository.getPartyMembers(conn)));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyApi.loadActiveParty(): DB access failed", e);
            return new ActivePartyResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public static PartySnapshotResult loadPartySnapshot() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new PartySnapshotResult(
                    ReadStatus.SUCCESS,
                    mapMembers(PlayerCharacterRepository.getPartyMembers(conn)),
                    mapMembers(PlayerCharacterRepository.getAvailableCharacters(conn)));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyApi.loadPartySnapshot(): DB access failed", e);
            return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, List.of(), List.of());
        }
    }

    public static int calculatePartyLevel(List<PartyMember> party) {
        return party == null || party.isEmpty()
                ? 1
                : (int) Math.round(party.stream().mapToInt(PartyMember::level).average().orElse(1));
    }

    public static List<Integer> loadActivePartyLevels(Connection conn) throws SQLException {
        return PlayerCharacterRepository.getActivePartyLevels(conn);
    }

    public static List<Integer> loadActivePartyLevelsForComposition(Connection conn) throws SQLException {
        return PlayerCharacterRepository.getActivePartyLevelsForComposition(conn);
    }

    private static List<PartyMember> mapMembers(List<PlayerCharacter> party) {
        if (party == null || party.isEmpty()) {
            return List.of();
        }
        return party.stream()
                .map(pc -> new PartyMember(pc.Id, pc.Name, pc.Level))
                .toList();
    }
}
