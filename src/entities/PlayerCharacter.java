package entities;

/**
 * Player character data container.
 * Note: the DB has an {@code in_party} column used as a partition key in
 * {@link repositories.PlayerCharacterRepository} queries. The entity is always
 * loaded pre-filtered, so callers never need to inspect the party flag directly —
 * there is intentionally no {@code InParty} field here.
 */
public class PlayerCharacter {
    public Long Id;
    public String Name;
    public int Level;
}
