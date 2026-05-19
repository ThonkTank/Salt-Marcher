package src.domain.encounter.model.session.model;

import java.util.OptionalInt;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.session.model.CombatProjectionData;

final class CombatTurnTracker {

    private OptionalInt currentTurnIndex = OptionalInt.empty();
    private int round = 1;

    void reset() {
        currentTurnIndex = OptionalInt.empty();
        round = 1;
    }

    void beginCombat(CombatTurn combatTurns, CombatRoster combatRoster) {
        currentTurnIndex = combatTurns.hasTurnEntries(combatRoster.combatants())
                ? OptionalInt.of(CombatTurn.FIRST_TURN_INDEX)
                : OptionalInt.empty();
        round = 1;
    }

    void advance(CombatTurn combatTurns, CombatRoster combatRoster) {
        CombatTurn.TurnAdvance turn = combatTurns.nextTurn(
                combatRoster.combatants(),
                currentTurnIndex.orElse(CombatTurn.NO_ACTIVE_TURN_INDEX),
                round);
        currentTurnIndex = toOptionalTurnIndex(turn.currentTurnIndex());
        round = turn.round();
    }

    @Nullable String activeTurnId(CombatTurn combatTurns, CombatRoster combatRoster) {
        return combatTurns.activeTurnId(combatRoster.combatants(), currentTurnIndex.orElse(CombatTurn.NO_ACTIVE_TURN_INDEX));
    }

    void restore(CombatTurn combatTurns, CombatRoster combatRoster, @Nullable String activeTurnId) {
        currentTurnIndex = toOptionalTurnIndex(combatTurns.turnIndexOf(
                combatRoster.combatants(),
                activeTurnId,
                currentTurnIndex.orElse(CombatTurn.NO_ACTIVE_TURN_INDEX)));
    }

    CombatProjectionData combatProjection(CombatTurn combatTurns, CombatRoster combatRoster) {
        if (!combatTurns.hasTurnEntries(combatRoster.combatants())) {
            return CombatProjectionData.empty();
        }
        CombatProjectionData projection = combatTurns.combatProjection(
                combatRoster.combatants(),
                currentTurnIndex.orElse(CombatTurn.NO_ACTIVE_TURN_INDEX),
                round);
        currentTurnIndex = toOptionalTurnIndex(projection.currentTurnIndex());
        return projection;
    }

    private static OptionalInt toOptionalTurnIndex(int turnIndex) {
        return turnIndex < 0 ? OptionalInt.empty() : OptionalInt.of(turnIndex);
    }
}
