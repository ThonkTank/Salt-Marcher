package features.party.service;

import database.DatabaseManager;
import features.party.model.PlayerCharacter;
import features.party.repository.PlayerCharacterRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Facade for party management. All UI code goes through here, not directly to the repository.
 * <p>Currently thin delegations; this layer is the intended home for future party-state logic
 * (e.g. max-party-size enforcement, level-range validation).
 */
public final class PartyService {
    private static final Logger LOGGER = Logger.getLogger(PartyService.class.getName());

    private PartyService() {
        throw new AssertionError("No instances");
    }

    public enum ReadStatus {
        SUCCESS,
        STORAGE_ERROR
    }

    public enum MutationStatus {
        SUCCESS,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public record PartySnapshotResult(ReadStatus status, List<PlayerCharacter> members, List<PlayerCharacter> available) {}
    public record PartyListResult(ReadStatus status, List<PlayerCharacter> members) {}
    public record MutationResult(MutationStatus status) {}
    public record CreateResult(MutationStatus status, PlayerCharacter character) {}

    public static PartySnapshotResult loadPartySnapshot() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new PartySnapshotResult(
                    ReadStatus.SUCCESS,
                    PlayerCharacterRepository.getPartyMembers(conn),
                    PlayerCharacterRepository.getAvailableCharacters(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyService.loadPartySnapshot(): DB access failed", e);
            return new PartySnapshotResult(ReadStatus.STORAGE_ERROR, List.of(), List.of());
        }
    }

    public static PartyListResult getActivePartyResult() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return new PartyListResult(ReadStatus.SUCCESS, PlayerCharacterRepository.getPartyMembers(conn));
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyService.getActivePartyResult(): DB access failed", e);
            return new PartyListResult(ReadStatus.STORAGE_ERROR, List.of());
        }
    }

    public static MutationResult addToParty(Long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean updated = PlayerCharacterRepository.addToParty(conn, id);
            return new MutationResult(updated ? MutationStatus.SUCCESS : MutationStatus.NOT_FOUND);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyService.addToParty(): DB access failed", e);
            return new MutationResult(MutationStatus.STORAGE_ERROR);
        }
    }

    public static MutationResult removeFromParty(Long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean updated = PlayerCharacterRepository.removeFromParty(conn, id);
            return new MutationResult(updated ? MutationStatus.SUCCESS : MutationStatus.NOT_FOUND);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyService.removeFromParty(): DB access failed", e);
            return new MutationResult(MutationStatus.STORAGE_ERROR);
        }
    }

    public static MutationResult deleteCharacter(Long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean deleted = PlayerCharacterRepository.deleteCharacter(conn, id);
            return new MutationResult(deleted ? MutationStatus.SUCCESS : MutationStatus.NOT_FOUND);
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyService.deleteCharacter(): DB access failed", e);
            return new MutationResult(MutationStatus.STORAGE_ERROR);
        }
    }

    public static CreateResult createCharacterAndAddToParty(String name, int level) {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                PlayerCharacter created = PlayerCharacterRepository.createCharacter(conn, name, level, true);
                if (created == null) {
                    conn.rollback();
                    return new CreateResult(MutationStatus.STORAGE_ERROR, null);
                }
                conn.commit();
                return new CreateResult(MutationStatus.SUCCESS, created);
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "PartyService.createCharacterAndAddToParty(): DB access failed", e);
            return new CreateResult(MutationStatus.STORAGE_ERROR, null);
        }
    }

    /** Returns the average level of the party, rounded to the nearest integer. Returns 1 for an empty party. */
    public static int averageLevel(List<PlayerCharacter> party) {
        return party.isEmpty() ? 1
                : (int) Math.round(party.stream().mapToInt(pc -> pc.Level).average().orElse(1));
    }

}
