package features.encounter.service.combat;

import features.creaturecatalog.model.Creature;
import features.encounter.model.Combatant;
import features.encounter.model.EncounterCreatureSnapshot;
import features.encounter.model.MonsterCombatant;
import features.encounter.model.PcCombatant;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Canonical combat state and rules. UI is expected to render this state and wire user events
 * to these command-like methods.
 */
public class CombatSession {
    /** Enemy terminal states captured for combat results. */
    public enum EnemyStatus { ALIVE, DEAD, REMOVED }

    /** Immutable snapshot for post-combat XP accounting. */
    public record EnemyOutcome(MonsterCombatant combatant, EnemyStatus status) {}

    /** Enemy alive/total counts including inactive dead/removed members. */
    public record EnemyTotals(int alive, int total) {}

    /** Archived monster state used for inactive rows and restore actions. */
    public record InactiveEnemy(long id, MonsterCombatant combatant, EnemyStatus status) {}

    private final List<Combatant> combatants = new ArrayList<>();
    private final List<CombatTurnGrouper.GroupedTurnEntry> turnEntries = new ArrayList<>();
    private final List<InactiveEnemy> inactiveEnemies = new ArrayList<>();

    private int currentTurn = 0;
    private int round = 1;
    private int focusedIndex = 0;
    private long inactiveEnemySeq = 1;

    public void startCombat(List<Combatant> newCombatants) {
        combatants.clear();
        inactiveEnemies.clear();
        combatants.addAll(newCombatants);
        round = 1;
        currentTurn = 0;
        focusedIndex = 0;
        inactiveEnemySeq = 1;
        normalizeMonsterGrouping(null, null);
    }

    public int getRound() { return round; }

    public int getCurrentTurnIndex() { return currentTurn; }

    public int getFocusedIndex() { return focusedIndex; }

    public List<Combatant> getCombatants() { return Collections.unmodifiableList(combatants); }

    public List<CombatTurnGrouper.GroupedTurnEntry> getTurnEntries() { return Collections.unmodifiableList(turnEntries); }

    public List<InactiveEnemy> getInactiveEnemies() { return Collections.unmodifiableList(inactiveEnemies); }

    public CombatTurnGrouper.GroupedTurnEntry getFocusedEntry() {
        return (focusedIndex >= 0 && focusedIndex < turnEntries.size()) ? turnEntries.get(focusedIndex) : null;
    }

    public String getCurrentTurnName() {
        if (currentTurn >= 0 && currentTurn < turnEntries.size()) return turnEntries.get(currentTurn).name();
        return null;
    }

    /** Returns all enemies (active + inactive) for post-combat calculations. */
    public List<EnemyOutcome> getEnemyOutcomes() {
        List<EnemyOutcome> out = new ArrayList<>();
        for (Combatant c : combatants) {
            if (c instanceof MonsterCombatant mc) {
                out.add(new EnemyOutcome(mc, mc.isAlive() ? EnemyStatus.ALIVE : EnemyStatus.DEAD));
            }
        }
        for (InactiveEnemy ie : inactiveEnemies) out.add(new EnemyOutcome(ie.combatant(), ie.status()));
        return out;
    }

    public EnemyTotals getEnemyTotals() {
        int alive = 0;
        int total = inactiveEnemies.size();
        for (Combatant c : combatants) {
            if (c instanceof MonsterCombatant mc) {
                total++;
                if (mc.isAlive()) alive++;
            }
        }
        return new EnemyTotals(alive, total);
    }

    public void addReinforcement(Creature creature) {
        MonsterCombatant mc = CombatSetup.createReinforcement(creature);
        mc.rename(CombatSetup.uniqueNameFor(creature, combatants));
        combatants.add(mc);
        normalizeMonsterGrouping(mc, mc);
    }

    /**
     * Advances to the next living turn entry and returns active creature id (if any)
     * so UI can ensure a stat block tab.
     */
    public Long nextTurn() {
        if (turnEntries.isEmpty()) return null;

        int checked = 0;
        do {
            currentTurn = (currentTurn + 1) % turnEntries.size();
            if (currentTurn == 0) round++;
            checked++;
            if (checked > turnEntries.size()) break;
        } while (!isAlive(turnEntries.get(currentTurn)));

        focusedIndex = currentTurn;
        CombatTurnGrouper.GroupedTurnEntry active = turnEntries.get(currentTurn);
        return active.creatureId();
    }

    public void moveFocus(int delta) {
        if (turnEntries.isEmpty()) return;
        focusedIndex = Math.max(0, Math.min(turnEntries.size() - 1, focusedIndex + delta));
    }

    public void setInitiative(CombatTurnGrouper.GroupedTurnEntry entry, int initiative) {
        if (entry == null) return;
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC && entry.pc() != null) {
            entry.pc().setInitiative(initiative);
        } else {
            for (MonsterCombatant mc : entry.monsters()) mc.setInitiative(initiative);
        }
        Object ref = referenceFor(entry);
        normalizeMonsterGrouping(ref, ref);
    }

    public void healMonster(MonsterCombatant mc, int heal) {
        if (mc == null || heal <= 0) return;
        mc.heal(heal);
        normalizeMonsterGrouping(mc, mc);
    }

    public void applyDamageToMonster(MonsterCombatant mc, int damage) {
        if (mc == null || damage <= 0) return;
        mc.applyDamage(damage);

        Object activeRef = null;
        Object focusedRef = null;
        if (mc.getCurrentHp() <= 0) {
            activeRef = preferredReferenceAfterRemoval(currentTurn, List.of(mc));
            focusedRef = preferredReferenceAfterRemoval(focusedIndex, List.of(mc));
            archiveMonster(mc, EnemyStatus.DEAD);
            combatants.remove(mc);
        }
        normalizeMonsterGrouping(activeRef, focusedRef);
    }

    /** Applies mob damage with spillover over sorted member HP (lowest HP first). */
    public void applyDamageToMob(CombatTurnGrouper.GroupedTurnEntry mobEntry, int damage) {
        if (mobEntry == null || damage <= 0 || mobEntry.monsters().isEmpty()) return;

        List<MonsterCombatant> members = new ArrayList<>(mobEntry.monsters());
        List<MonsterCombatant> removedMembers = new ArrayList<>();
        members.sort(Comparator.comparingInt(MonsterCombatant::getCurrentHp));

        for (MonsterCombatant mc : members) {
            if (damage <= 0) break;
            if (!mc.isAlive()) continue;
            if (damage >= mc.getCurrentHp()) {
                damage -= mc.getCurrentHp();
                mc.setCurrentHp(0);
                archiveMonster(mc, EnemyStatus.DEAD);
                combatants.remove(mc);
                removedMembers.add(mc);
            } else {
                mc.applyDamage(damage);
                damage = 0;
            }
        }

        Object activeRef = null;
        Object focusedRef = null;
        if (!removedMembers.isEmpty()) {
            activeRef = preferredReferenceAfterRemoval(currentTurn, removedMembers);
            focusedRef = preferredReferenceAfterRemoval(focusedIndex, removedMembers);
        }
        normalizeMonsterGrouping(activeRef, focusedRef);
    }

    public void healMobFront(CombatTurnGrouper.GroupedTurnEntry mobEntry, int heal) {
        if (mobEntry == null || heal <= 0 || mobEntry.monsters().isEmpty()) return;
        List<MonsterCombatant> members = new ArrayList<>(mobEntry.monsters());
        members.sort(Comparator.comparingInt(MonsterCombatant::getCurrentHp));
        MonsterCombatant front = members.get(0);
        front.heal(heal);
        normalizeMonsterGrouping(front, front);
    }

    public void duplicateCombatant(MonsterCombatant original) {
        if (original == null || original.getCreatureRef() == null) return;
        EncounterCreatureSnapshot source = original.getCreatureRef();
        MonsterCombatant clone = CombatSetup.createReinforcement(source);
        clone.rename(CombatSetup.uniqueNameFor(source, combatants));
        combatants.add(clone);
        normalizeMonsterGrouping(clone, clone);
    }

    public void removeMonster(MonsterCombatant mc) {
        if (mc == null) return;
        Object activeRef = preferredReferenceAfterRemoval(currentTurn, List.of(mc));
        Object focusedRef = preferredReferenceAfterRemoval(focusedIndex, List.of(mc));
        archiveMonster(mc, EnemyStatus.REMOVED);
        combatants.remove(mc);
        normalizeMonsterGrouping(activeRef, focusedRef);
    }

    public void removeMob(CombatTurnGrouper.GroupedTurnEntry entry) {
        if (entry == null || entry.monsters().isEmpty()) return;
        List<MonsterCombatant> removedMembers = new ArrayList<>(entry.monsters());
        Object activeRef = preferredReferenceAfterRemoval(currentTurn, removedMembers);
        Object focusedRef = preferredReferenceAfterRemoval(focusedIndex, removedMembers);
        for (MonsterCombatant mc : entry.monsters()) {
            archiveMonster(mc, EnemyStatus.REMOVED);
            combatants.remove(mc);
        }
        normalizeMonsterGrouping(activeRef, focusedRef);
    }

    public void restoreRemoved(InactiveEnemy removed) {
        if (removed == null || removed.status() != EnemyStatus.REMOVED) return;
        inactiveEnemies.removeIf(ie -> ie.id() == removed.id());
        MonsterCombatant restored = copyCombatant(removed.combatant());
        combatants.add(restored);
        normalizeMonsterGrouping(restored, restored);
    }

    private void archiveMonster(MonsterCombatant mc, EnemyStatus status) {
        inactiveEnemies.add(new InactiveEnemy(inactiveEnemySeq++, copyCombatant(mc), status));
    }

    private MonsterCombatant copyCombatant(MonsterCombatant source) {
        return new MonsterCombatant(
                source.getName(),
                source.getInitiative(),
                source.getInitiativeBonus(),
                source.getCurrentHp(),
                source.getMaxHp(),
                source.getAc(),
                source.getCreatureRef());
    }

    private boolean isAlive(CombatTurnGrouper.GroupedTurnEntry entry) {
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) {
            return entry.pc() != null && entry.pc().isAlive();
        }
        for (MonsterCombatant mc : entry.monsters()) {
            if (mc.isAlive()) return true;
        }
        return false;
    }

    private void normalizeMonsterGrouping(Object activeRef, Object focusedRef) {
        if (activeRef == null && !turnEntries.isEmpty() && currentTurn < turnEntries.size()) {
            activeRef = referenceFor(turnEntries.get(currentTurn));
        }
        if (focusedRef == null && !turnEntries.isEmpty() && focusedIndex < turnEntries.size()) {
            focusedRef = referenceFor(turnEntries.get(focusedIndex));
        }

        combatants.sort((a, b) -> {
            if (b.getInitiative() != a.getInitiative()) return b.getInitiative() - a.getInitiative();
            return Boolean.compare(b instanceof PcCombatant, a instanceof PcCombatant);
        });

        rebuildTurnEntries();

        currentTurn = resolveTurnIndex(activeRef);
        focusedIndex = resolveTurnIndex(focusedRef);
        if (currentTurn < 0) currentTurn = 0;
        if (focusedIndex < 0) focusedIndex = Math.min(currentTurn, Math.max(0, turnEntries.size() - 1));
    }

    private int resolveTurnIndex(Object ref) {
        if (turnEntries.isEmpty()) return 0;
        if (ref == null) return 0;

        for (int i = 0; i < turnEntries.size(); i++) {
            CombatTurnGrouper.GroupedTurnEntry t = turnEntries.get(i);
            if (t.kind() == CombatTurnGrouper.GroupedTurnKind.PC && t.pc() == ref) return i;
            if ((t.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER
                    || t.kind() == CombatTurnGrouper.GroupedTurnKind.MOB) && t.monsters().contains(ref)) {
                return i;
            }
        }
        return 0;
    }

    private Object referenceFor(CombatTurnGrouper.GroupedTurnEntry entry) {
        if (entry == null) return null;
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) return entry.pc();
        if (!entry.monsters().isEmpty()) return entry.monsters().get(0);
        return null;
    }

    private Object preferredReferenceAfterRemoval(int preferredIndex, List<MonsterCombatant> removedMembers) {
        if (turnEntries.isEmpty()) return null;

        Set<MonsterCombatant> removed = new HashSet<>(removedMembers);
        int start = Math.max(0, Math.min(preferredIndex, turnEntries.size() - 1));

        for (int offset = 0; offset < turnEntries.size(); offset++) {
            CombatTurnGrouper.GroupedTurnEntry entry = turnEntries.get((start + offset) % turnEntries.size());
            Object ref = survivingReferenceFor(entry, removed);
            if (ref != null) return ref;
        }
        return null;
    }

    private Object survivingReferenceFor(CombatTurnGrouper.GroupedTurnEntry entry, Set<MonsterCombatant> removedMembers) {
        if (entry == null) return null;
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) return entry.pc();
        for (MonsterCombatant monster : entry.monsters()) {
            if (!removedMembers.contains(monster)) return monster;
        }
        return null;
    }

    private void rebuildTurnEntries() {
        turnEntries.clear();
        int pcTurns = (int) combatants.stream().filter(c -> c instanceof PcCombatant).count();
        turnEntries.addAll(CombatTurnGrouper.groupTurns(combatants, Math.max(1, pcTurns)));
    }
}
