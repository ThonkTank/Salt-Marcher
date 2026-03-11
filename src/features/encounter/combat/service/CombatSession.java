package features.encounter.combat.service;

import features.creatures.model.Creature;
import features.encounter.combat.model.Combatant;
import features.encounter.combat.model.MonsterCombatant;
import features.encounter.combat.model.PcCombatant;
import features.encounter.model.EncounterCreatureSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

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

    /** Stable pointer for preserving current/focus turn across re-grouping. */
    private record TurnRef(PcCombatant pc, MonsterCombatant monster) {
        static TurnRef forPc(PcCombatant pc) {
            return pc == null ? null : new TurnRef(pc, null);
        }

        static TurnRef forMonster(MonsterCombatant monster) {
            return monster == null ? null : new TurnRef(null, monster);
        }
    }

    private record TurnSelection(TurnRef active, TurnRef focused) {
        static TurnSelection none() {
            return new TurnSelection(null, null);
        }

        static TurnSelection same(TurnRef ref) {
            return new TurnSelection(ref, ref);
        }
    }

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
        mutateAndNormalize(() -> {
            MonsterCombatant mc = CombatSetup.createReinforcement(creature);
            mc.rename(CombatSetup.uniqueNameFor(creature, combatants));
            combatants.add(mc);
        });
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
        TurnRef ref = referenceFor(entry);
        mutateAndNormalize(ref, ref, () -> {
            if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC && entry.pc() != null) {
                entry.pc().setInitiative(initiative);
            } else {
                for (MonsterCombatant mc : entry.monsters()) mc.setInitiative(initiative);
            }
        });
    }

    public void healMonster(MonsterCombatant mc, int heal) {
        if (mc == null || heal <= 0) return;
        mutateAndNormalize(TurnRef.forMonster(mc), TurnRef.forMonster(mc), () -> mc.heal(heal));
    }

    public void applyDamageToMonster(MonsterCombatant mc, int damage) {
        if (mc == null || damage <= 0) return;
        mutateAndNormalize(() -> {
            boolean dies = mc.getCurrentHp() - damage <= 0;
            TurnSelection selection = dies
                    ? new TurnSelection(
                    preferredReferenceAfterRemoval(currentTurn, List.of(mc)),
                    preferredReferenceAfterRemoval(focusedIndex, List.of(mc)))
                    : TurnSelection.same(TurnRef.forMonster(mc));
            mc.applyDamage(damage);
            if (mc.getCurrentHp() <= 0) {
                archiveMonster(mc, EnemyStatus.DEAD);
                combatants.remove(mc);
            }
            return selection;
        });
    }

    /** Applies mob damage with spillover over sorted member HP (lowest HP first). */
    public void applyDamageToMob(CombatTurnGrouper.GroupedTurnEntry mobEntry, int damage) {
        if (mobEntry == null || damage <= 0 || mobEntry.monsters().isEmpty()) return;
        mutateAndNormalize(() -> {
            List<MonsterCombatant> members = new ArrayList<>(mobEntry.monsters());
            List<MonsterCombatant> removedMembers = new ArrayList<>();
            int remainingDamage = damage;
            members.sort(Comparator.comparingInt(MonsterCombatant::getCurrentHp));

            for (MonsterCombatant mc : members) {
                if (remainingDamage <= 0) break;
                if (!mc.isAlive()) continue;
                if (remainingDamage >= mc.getCurrentHp()) {
                    remainingDamage -= mc.getCurrentHp();
                    mc.setCurrentHp(0);
                    archiveMonster(mc, EnemyStatus.DEAD);
                    combatants.remove(mc);
                    removedMembers.add(mc);
                } else {
                    mc.applyDamage(remainingDamage);
                    remainingDamage = 0;
                }
            }
            if (!removedMembers.isEmpty()) {
                return new TurnSelection(
                        preferredReferenceAfterRemoval(currentTurn, removedMembers),
                        preferredReferenceAfterRemoval(focusedIndex, removedMembers)
                );
            }
            return TurnSelection.none();
        });
    }

    public void healMobFront(CombatTurnGrouper.GroupedTurnEntry mobEntry, int heal) {
        if (mobEntry == null || heal <= 0 || mobEntry.monsters().isEmpty()) return;
        List<MonsterCombatant> members = new ArrayList<>(mobEntry.monsters());
        members.sort(Comparator.comparingInt(MonsterCombatant::getCurrentHp));
        MonsterCombatant front = members.get(0);
        mutateAndNormalize(TurnRef.forMonster(front), TurnRef.forMonster(front), () -> front.heal(heal));
    }

    public void duplicateCombatant(MonsterCombatant original) {
        if (original == null || original.getCreatureRef() == null) return;
        mutateAndNormalize(() -> {
            EncounterCreatureSnapshot source = original.getCreatureRef();
            MonsterCombatant clone = CombatSetup.createReinforcement(source);
            clone.rename(CombatSetup.uniqueNameFor(source, combatants));
            combatants.add(clone);
        });
    }

    public void removeMonster(MonsterCombatant mc) {
        if (mc == null) return;
        TurnRef activeRef = preferredReferenceAfterRemoval(currentTurn, List.of(mc));
        TurnRef focusedRef = preferredReferenceAfterRemoval(focusedIndex, List.of(mc));
        mutateAndNormalize(activeRef, focusedRef, () -> {
            archiveMonster(mc, EnemyStatus.REMOVED);
            combatants.remove(mc);
        });
    }

    public void removeMob(CombatTurnGrouper.GroupedTurnEntry entry) {
        if (entry == null || entry.monsters().isEmpty()) return;
        List<MonsterCombatant> removedMembers = new ArrayList<>(entry.monsters());
        TurnRef activeRef = preferredReferenceAfterRemoval(currentTurn, removedMembers);
        TurnRef focusedRef = preferredReferenceAfterRemoval(focusedIndex, removedMembers);
        mutateAndNormalize(activeRef, focusedRef, () -> {
            for (MonsterCombatant mc : entry.monsters()) {
                archiveMonster(mc, EnemyStatus.REMOVED);
                combatants.remove(mc);
            }
        });
    }

    public void restoreRemoved(InactiveEnemy removed) {
        if (removed == null || removed.status() != EnemyStatus.REMOVED) return;
        MonsterCombatant restored = copyCombatant(removed.combatant());
        mutateAndNormalize(TurnRef.forMonster(restored), TurnRef.forMonster(restored), () -> {
            inactiveEnemies.removeIf(ie -> ie.id() == removed.id());
            combatants.add(restored);
        });
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
                source.getLoot(),
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

    private void mutateAndNormalize(Runnable mutation) {
        mutateAndNormalize(() -> {
            mutation.run();
            return TurnSelection.none();
        });
    }

    private void mutateAndNormalize(TurnRef activeRef, TurnRef focusedRef, Runnable mutation) {
        mutateAndNormalize(() -> {
            mutation.run();
            return new TurnSelection(activeRef, focusedRef);
        });
    }

    private void mutateAndNormalize(Supplier<TurnSelection> mutation) {
        TurnSelection selection = mutation.get();
        normalizeMonsterGrouping(selection.active(), selection.focused());
    }

    private void normalizeMonsterGrouping(TurnRef activeRef, TurnRef focusedRef) {
        if (activeRef == null && !turnEntries.isEmpty() && currentTurn < turnEntries.size()) {
            activeRef = referenceFor(turnEntries.get(currentTurn));
        }
        if (focusedRef == null && !turnEntries.isEmpty() && focusedIndex < turnEntries.size()) {
            focusedRef = referenceFor(turnEntries.get(focusedIndex));
        }

        combatants.sort(CombatOrdering.BY_INITIATIVE_PC_FIRST);

        rebuildTurnEntries();

        currentTurn = resolveTurnIndex(activeRef);
        focusedIndex = resolveTurnIndex(focusedRef);
        if (currentTurn < 0) currentTurn = 0;
        if (focusedIndex < 0) focusedIndex = Math.min(currentTurn, Math.max(0, turnEntries.size() - 1));
    }

    private int resolveTurnIndex(TurnRef ref) {
        if (turnEntries.isEmpty()) return 0;
        if (ref == null) return 0;

        for (int i = 0; i < turnEntries.size(); i++) {
            CombatTurnGrouper.GroupedTurnEntry t = turnEntries.get(i);
            if (ref.pc() != null && t.kind() == CombatTurnGrouper.GroupedTurnKind.PC && t.pc() == ref.pc()) return i;
            if (ref.monster() != null
                    && (t.kind() == CombatTurnGrouper.GroupedTurnKind.MONSTER
                    || t.kind() == CombatTurnGrouper.GroupedTurnKind.MOB)
                    && t.monsters().contains(ref.monster())) return i;
        }
        return 0;
    }

    private TurnRef referenceFor(CombatTurnGrouper.GroupedTurnEntry entry) {
        if (entry == null) return null;
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) return TurnRef.forPc(entry.pc());
        if (!entry.monsters().isEmpty()) return TurnRef.forMonster(entry.monsters().get(0));
        return null;
    }

    private TurnRef preferredReferenceAfterRemoval(int preferredIndex, List<MonsterCombatant> removedMembers) {
        if (turnEntries.isEmpty()) return null;

        Set<MonsterCombatant> removed = new HashSet<>(removedMembers);
        int start = Math.max(0, Math.min(preferredIndex, turnEntries.size() - 1));

        for (int offset = 0; offset < turnEntries.size(); offset++) {
            CombatTurnGrouper.GroupedTurnEntry entry = turnEntries.get((start + offset) % turnEntries.size());
            TurnRef ref = survivingReferenceFor(entry, removed);
            if (ref != null) return ref;
        }
        return null;
    }

    private TurnRef survivingReferenceFor(CombatTurnGrouper.GroupedTurnEntry entry, Set<MonsterCombatant> removedMembers) {
        if (entry == null) return null;
        if (entry.kind() == CombatTurnGrouper.GroupedTurnKind.PC) return TurnRef.forPc(entry.pc());
        for (MonsterCombatant monster : entry.monsters()) {
            if (!removedMembers.contains(monster)) return TurnRef.forMonster(monster);
        }
        return null;
    }

    private void rebuildTurnEntries() {
        turnEntries.clear();
        // Runtime grouping is deterministic and independent of current PC turn counts.
        turnEntries.addAll(CombatTurnGrouper.groupTurns(combatants));
    }
}
