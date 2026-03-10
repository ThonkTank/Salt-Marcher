package features.encounter.combat.ui;

import features.creatures.model.Creature;
import features.encounter.combat.model.Combatant;
import features.encounter.combat.model.MonsterCombatant;
import features.encounter.combat.service.CombatSession;
import features.encounter.combat.service.CombatTurnGrouper;
import features.creatures.api.StatBlockRequest;

import java.util.List;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class CombatTrackerCoordinator {
    private final CombatSession session = new CombatSession();

    private CombatTrackerRenderState state = CombatTrackerRenderState.empty();

    private Consumer<CombatTrackerRenderState> onRenderStateChanged;
    private Consumer<StatBlockRequest> onEnsureStatBlock;
    private Runnable onCombatStateChanged;

    void setOnRenderStateChanged(Consumer<CombatTrackerRenderState> callback) {
        this.onRenderStateChanged = callback;
    }

    void setOnEnsureStatBlock(Consumer<StatBlockRequest> callback) {
        this.onEnsureStatBlock = callback;
    }

    void setOnCombatStateChanged(Runnable callback) {
        this.onCombatStateChanged = callback;
    }

    void startCombat(List<Combatant> newCombatants) {
        dispatchCommand(() -> session.startCombat(newCombatants));
    }

    void addReinforcement(Creature creature) {
        dispatchCommand(() -> session.addReinforcement(creature));
    }

    void nextTurn() {
        dispatchCommand(session::nextTurn);
        if (onEnsureStatBlock == null) return;
        List<CombatTurnGrouper.GroupedTurnEntry> entries = state.turnEntries();
        int currentTurnIndex = state.currentTurnIndex();
        if (entries.isEmpty() || currentTurnIndex < 0 || currentTurnIndex >= entries.size()) return;
        CombatTurnGrouper.GroupedTurnEntry active = entries.get(currentTurnIndex);
        if (active.creatureId() != null) {
            onEnsureStatBlock.accept(CombatStatBlockRequestMapper.fromTurnEntry(active));
        }
    }

    void moveFocus(int delta) {
        session.moveFocus(delta);
        refreshState();
    }

    void applyDamageToMonster(MonsterCombatant combatant, int damage) {
        dispatchCommand(() -> session.applyDamageToMonster(combatant, damage));
    }

    void healMonster(MonsterCombatant combatant, int heal) {
        dispatchCommand(() -> session.healMonster(combatant, heal));
    }

    void applyDamageToMob(CombatTurnGrouper.GroupedTurnEntry mobEntry, int damage) {
        dispatchCommand(() -> session.applyDamageToMob(mobEntry, damage));
    }

    void healMobFront(CombatTurnGrouper.GroupedTurnEntry mobEntry, int heal) {
        dispatchCommand(() -> session.healMobFront(mobEntry, heal));
    }

    void setInitiative(CombatTurnGrouper.GroupedTurnEntry entry, int initiative) {
        dispatchCommand(() -> session.setInitiative(entry, initiative));
    }

    void duplicateCombatant(MonsterCombatant original) {
        dispatchCommand(() -> session.duplicateCombatant(original));
    }

    void removeMonster(MonsterCombatant combatant) {
        dispatchCommand(() -> session.removeMonster(combatant));
    }

    void removeMob(CombatTurnGrouper.GroupedTurnEntry entry) {
        dispatchCommand(() -> session.removeMob(entry));
    }

    void restoreRemoved(CombatSession.InactiveEnemy removed) {
        dispatchCommand(() -> session.restoreRemoved(removed));
    }

    private void fireCombatStateChanged() {
        if (onCombatStateChanged != null) {
            onCombatStateChanged.run();
        }
    }

    private void dispatchCommand(Runnable command) {
        command.run();
        refreshState();
        fireCombatStateChanged();
    }

    private <T> T dispatchCommand(Supplier<T> command) {
        T result = command.get();
        refreshState();
        fireCombatStateChanged();
        return result;
    }

    private void refreshState() {
        state = new CombatTrackerRenderState(
                session.getRound(),
                session.getCurrentTurnIndex(),
                session.getFocusedIndex(),
                session.getCurrentTurnName(),
                List.copyOf(session.getCombatants()),
                List.copyOf(session.getTurnEntries()),
                List.copyOf(session.getInactiveEnemies()),
                List.copyOf(session.getEnemyOutcomes()),
                session.getEnemyTotals());
        if (onRenderStateChanged != null) {
            onRenderStateChanged.accept(state);
        }
    }
}
