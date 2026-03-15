package features.encounter.combat.model;

/** Combat state for a player character. HP and AC are managed by the player; isAlive() is always true. */
public class PcCombatant extends Combatant {
    private Long partyMemberId;

    public Long getPartyMemberId() {
        return partyMemberId;
    }

    public void setPartyMemberId(Long partyMemberId) {
        this.partyMemberId = partyMemberId;
    }

    @Override
    public boolean isAlive() { return true; }
}
