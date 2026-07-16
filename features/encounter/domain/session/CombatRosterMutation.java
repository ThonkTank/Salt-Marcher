package features.encounter.domain.session;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

public final class CombatRosterMutation {

    public void updateInitiative(CombatRoster roster, @Nullable CombatTurnEntry entry, int initiative) {
        if (entry == null) {
            return;
        }
        List<String> memberIds = entry.memberIds();
        List<Combatant> updatedCombatants = new ArrayList<>();
        for (Combatant combatant : roster.combatants()) {
            updatedCombatants.add(memberIds.contains(combatant.id()) ? combatant.withInitiative(initiative) : combatant);
        }
        roster.replaceAll(updatedCombatants);
        roster.sort();
    }

    public boolean mutateHp(CombatRoster roster, @Nullable CombatTurnEntry entry, int amount, boolean healing) {
        if (amount <= 0 || entry == null || entry.playerCharacter()) {
            return false;
        }
        List<Combatant> updatedCombatants = new ArrayList<>(roster.combatants());
        List<Combatant> targets = aliveMembers(updatedCombatants, entry.memberIds());
        if (targets.isEmpty()) {
            return false;
        }
        if (healing) {
            Combatant target = targets.getFirst();
            replaceMember(updatedCombatants, target, Math.min(target.maxHp(), target.currentHp() + amount));
        } else {
            damageMembers(updatedCombatants, targets, amount);
        }
        roster.replaceAll(updatedCombatants);
        return true;
    }

    public List<ResultEnemyData> resultEnemies(CombatRoster roster) {
        List<ResultEnemyData> enemies = new ArrayList<>();
        for (Combatant combatant : roster.combatants()) {
            if (combatant.isPlayerCharacter()) {
                continue;
            }
            enemies.add(new ResultEnemyData(
                    combatant.name(),
                    combatant.creatureId(),
                    combatant.worldNpcId(),
                    combatant.isAlive() ? "Lebt" : "Tot",
                    Math.max(0, combatant.maxHp() - combatant.currentHp()),
                    combatant.xp(),
                    !combatant.isAlive(),
                    combatant.loot()));
        }
        return List.copyOf(enemies);
    }

    private static List<Combatant> aliveMembers(List<Combatant> combatants, List<String> memberIds) {
        List<Combatant> targets = new ArrayList<>();
        for (Combatant combatant : combatants) {
            if (memberIds.contains(combatant.id()) && combatant.isAlive()) {
                targets.add(combatant);
            }
        }
        targets.sort(Combatant::compareByHpThenName);
        return targets;
    }

    private static void replaceMember(List<Combatant> combatants, Combatant target, int hitPoints) {
        for (int index = 0; index < combatants.size(); index++) {
            Combatant combatant = combatants.get(index);
            if (combatant.id().equals(target.id())) {
                combatants.set(index, target.withHp(hitPoints));
                return;
            }
        }
    }

    private static void damageMembers(List<Combatant> combatants, List<Combatant> targets, int damage) {
        int remaining = damage;
        for (Combatant target : targets) {
            if (remaining <= 0) {
                return;
            }
            int appliedDamage = Math.min(remaining, target.currentHp());
            replaceMember(combatants, target, target.currentHp() - appliedDamage);
            remaining -= appliedDamage;
        }
    }
}
