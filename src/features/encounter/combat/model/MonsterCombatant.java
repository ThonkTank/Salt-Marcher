package features.encounter.combat.model;

import features.encounter.model.EncounterCreatureSnapshot;
import features.gamerules.model.LootCoins;

import java.util.Objects;

/** Combat state for a monster. Tracks HP, AC, and source snapshot for stat-block lookup. */
public class MonsterCombatant extends Combatant {
    private int currentHp;
    private int maxHp;
    private int ac;
    private LootCoins lootCoins;
    private EncounterCreatureSnapshot creatureRef;

    public MonsterCombatant(
            String name,
            int initiative,
            int initiativeBonus,
            int currentHp,
            int maxHp,
            int ac,
            LootCoins lootCoins,
            EncounterCreatureSnapshot creatureRef) {
        rename(name);
        setInitiative(initiative);
        setInitiativeBonus(initiativeBonus);
        setCreatureRef(creatureRef);
        setMaxHp(maxHp);
        setCurrentHp(currentHp);
        setAc(ac);
        setLootCoins(lootCoins);
    }

    public int getCurrentHp() {
        return currentHp;
    }

    public void setCurrentHp(int currentHp) {
        this.currentHp = clampHp(currentHp, maxHp);
    }

    public int getMaxHp() {
        return maxHp;
    }

    public void setMaxHp(int maxHp) {
        if (maxHp < 0) {
            throw new IllegalArgumentException("maxHp must be >= 0");
        }
        this.maxHp = maxHp;
        this.currentHp = clampHp(currentHp, maxHp);
    }

    public void heal(int amount) {
        if (amount <= 0) return;
        setCurrentHp(currentHp + amount);
    }

    public void applyDamage(int amount) {
        if (amount <= 0) return;
        setCurrentHp(currentHp - amount);
    }

    public int getAc() {
        return ac;
    }

    public void setAc(int ac) {
        if (ac < 0) {
            throw new IllegalArgumentException("ac must be >= 0");
        }
        this.ac = ac;
    }

    public EncounterCreatureSnapshot getCreatureRef() {
        return creatureRef;
    }

    public void setCreatureRef(EncounterCreatureSnapshot creatureRef) {
        this.creatureRef = Objects.requireNonNull(creatureRef, "creatureRef must be non-null");
    }

    public LootCoins getLootCoins() {
        return lootCoins;
    }

    public void setLootCoins(LootCoins lootCoins) {
        this.lootCoins = Objects.requireNonNull(lootCoins, "lootCoins must be non-null");
    }

    private static int clampHp(int currentHp, int maxHp) {
        return Math.max(0, Math.min(maxHp, currentHp));
    }

    @Override
    public boolean isAlive() { return currentHp > 0; }
}
