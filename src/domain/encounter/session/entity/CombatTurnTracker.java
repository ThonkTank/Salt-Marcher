package src.domain.encounter.session.entity;

import java.util.OptionalInt;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.session.service.CombatTurnService;
import src.domain.encounter.session.value.EncounterSessionValues.CombatProjectionData;

final class CombatTurnTracker {

    private OptionalInt currentTurnIndex = OptionalInt.empty();
    private int round = 1;

    void reset() {
        currentTurnIndex = OptionalInt.empty();
        round = 1;
    }

    void beginCombat(CombatTurnService combatTurns, CombatRoster combatRoster) {
        currentTurnIndex = combatTurns.hasTurnEntries(combatRoster.combatants())
                ? OptionalInt.of(CombatTurnService.FIRST_TURN_INDEX)
                : OptionalInt.empty();
        round = 1;
    }

    void advance(CombatTurnService combatTurns, CombatRoster combatRoster) {
        CombatTurnService.TurnAdvance turn = combatTurns.nextTurn(
                combatRoster.combatants(),
                currentTurnIndex.orElse(CombatTurnService.NO_ACTIVE_TURN_INDEX),
                round);
        currentTurnIndex = toOptionalTurnIndex(turn.currentTurnIndex());
        round = turn.round();
    }

    @Nullable String activeTurnId(CombatTurnService combatTurns, CombatRoster combatRoster) {
        return combatTurns.activeTurnId(combatRoster.combatants(), currentTurnIndex.orElse(CombatTurnService.NO_ACTIVE_TURN_INDEX));
    }

    void restore(CombatTurnService combatTurns, CombatRoster combatRoster, @Nullable String activeTurnId) {
        currentTurnIndex = toOptionalTurnIndex(combatTurns.turnIndexOf(
                combatRoster.combatants(),
                activeTurnId,
                currentTurnIndex.orElse(CombatTurnService.NO_ACTIVE_TURN_INDEX)));
    }

    CombatProjectionData combatProjection(CombatTurnService combatTurns, CombatRoster combatRoster) {
        if (!combatTurns.hasTurnEntries(combatRoster.combatants())) {
            return CombatProjectionData.empty();
        }
        CombatProjectionData projection = combatTurns.combatProjection(
                combatRoster.combatants(),
                currentTurnIndex.orElse(CombatTurnService.NO_ACTIVE_TURN_INDEX),
                round);
        currentTurnIndex = toOptionalTurnIndex(projection.currentTurnIndex());
        return projection;
    }

    private static OptionalInt toOptionalTurnIndex(int turnIndex) {
        return turnIndex < 0 ? OptionalInt.empty() : OptionalInt.of(turnIndex);
    }
}
