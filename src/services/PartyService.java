package services;

import entities.PlayerCharacter;
import repositories.PlayerCharacterRepository;

import java.util.List;
import java.util.Optional;

/**
 * Facade for party management. All UI code goes through here, not directly to the repository.
 * <p>Currently thin delegations; this layer is the intended home for future party-state logic
 * (e.g. max-party-size enforcement, level-range validation).
 */
public class PartyService {

    public static List<PlayerCharacter> getActiveParty() {
        return PlayerCharacterRepository.getPartyMembers();
    }

    public static List<PlayerCharacter> getAvailableCharacters() {
        return PlayerCharacterRepository.getAvailableCharacters();
    }

    public static void addToParty(long id) {
        PlayerCharacterRepository.addToParty(id);
    }

    public static void removeFromParty(long id) {
        PlayerCharacterRepository.removeFromParty(id);
    }

    public static void deleteCharacter(long id) {
        PlayerCharacterRepository.deleteCharacter(id);
    }

    public static void updateCharacter(long id, String name, int level) {
        PlayerCharacterRepository.updateCharacter(id, name, level);
    }

    public static Optional<PlayerCharacter> createCharacter(String name, int level) {
        return PlayerCharacterRepository.createCharacter(name, level);
    }

    /** Returns the average level of the party, rounded to the nearest integer. Returns 1 for an empty party. */
    public static int averageLevel(List<PlayerCharacter> party) {
        return party.isEmpty() ? 1
                : (int) Math.round(party.stream().mapToInt(pc -> pc.Level).average().orElse(1));
    }
}
