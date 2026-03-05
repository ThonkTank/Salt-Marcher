package services;

import database.DatabaseManager;
import entities.PlayerCharacter;
import repositories.PlayerCharacterRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * Facade for party management. All UI code goes through here, not directly to the repository.
 * <p>Currently thin delegations; this layer is the intended home for future party-state logic
 * (e.g. max-party-size enforcement, level-range validation).
 */
public class PartyService {

    public static List<PlayerCharacter> getActiveParty() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return PlayerCharacterRepository.getPartyMembers(conn);
        } catch (SQLException e) {
            System.err.println("PartyService.getActiveParty(): " + e.getMessage());
            return List.of();
        }
    }

    public static List<PlayerCharacter> getAvailableCharacters() {
        try (Connection conn = DatabaseManager.getConnection()) {
            return PlayerCharacterRepository.getAvailableCharacters(conn);
        } catch (SQLException e) {
            System.err.println("PartyService.getAvailableCharacters(): " + e.getMessage());
            return List.of();
        }
    }

    public static void addToParty(long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            PlayerCharacterRepository.addToParty(conn, id);
        } catch (SQLException e) {
            System.err.println("PartyService.addToParty(): " + e.getMessage());
        }
    }

    public static void removeFromParty(long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            PlayerCharacterRepository.removeFromParty(conn, id);
        } catch (SQLException e) {
            System.err.println("PartyService.removeFromParty(): " + e.getMessage());
        }
    }

    public static void deleteCharacter(long id) {
        try (Connection conn = DatabaseManager.getConnection()) {
            PlayerCharacterRepository.deleteCharacter(conn, id);
        } catch (SQLException e) {
            System.err.println("PartyService.deleteCharacter(): " + e.getMessage());
        }
    }

    public static void updateCharacter(long id, String name, int level) {
        try (Connection conn = DatabaseManager.getConnection()) {
            PlayerCharacterRepository.updateCharacter(conn, id, name, level);
        } catch (SQLException e) {
            System.err.println("PartyService.updateCharacter(): " + e.getMessage());
        }
    }

    public static Optional<PlayerCharacter> createCharacter(String name, int level) {
        try (Connection conn = DatabaseManager.getConnection()) {
            return PlayerCharacterRepository.createCharacter(conn, name, level);
        } catch (SQLException e) {
            System.err.println("PartyService.createCharacter(): " + e.getMessage());
            return Optional.empty();
        }
    }

    /** Returns the average level of the party, rounded to the nearest integer. Returns 1 for an empty party. */
    public static int averageLevel(List<PlayerCharacter> party) {
        return party.isEmpty() ? 1
                : (int) Math.round(party.stream().mapToInt(pc -> pc.Level).average().orElse(1));
    }
}
