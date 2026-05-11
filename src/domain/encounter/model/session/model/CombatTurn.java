package src.domain.encounter.model.session.model;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.session.model.EncounterSessionValues.CombatCardData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CombatProjectionData;

public final class CombatTurn {

    public static final int FIRST_TURN_INDEX = 0;
    public static final int NO_ACTIVE_TURN_INDEX = -1;
    private static final int FIRST_COMBAT_ROUND = 1;
    private static final CombatTurnEntryAssembler ASSEMBLER = new CombatTurnEntryAssembler();

    public boolean hasTurnEntries(List<Combatant> combatants) {
        return !ASSEMBLER.assemble(combatants).isEmpty();
    }

    public @Nullable String activeTurnId(List<Combatant> combatants, int currentTurnIndex) {
        List<CombatTurnEntry> entries = ASSEMBLER.assemble(combatants);
        int index = normalizedTurnIndex(entries, currentTurnIndex);
        return index < 0 ? null : entries.get(index).id();
    }

    public int turnIndexOf(List<Combatant> combatants, @Nullable String combatantId, int fallbackTurnIndex) {
        List<CombatTurnEntry> entries = ASSEMBLER.assemble(combatants);
        if (combatantId != null) {
            for (int index = 0; index < entries.size(); index++) {
                if (entries.get(index).id().equals(combatantId)) {
                    return index;
                }
            }
        }
        return normalizedTurnIndex(entries, fallbackTurnIndex);
    }

    public TurnAdvance nextTurn(List<Combatant> combatants, int currentTurnIndex, int round) {
        List<CombatTurnEntry> entries = ASSEMBLER.assemble(combatants);
        if (entries.isEmpty()) {
            return new TurnAdvance(currentTurnIndex, round);
        }
        int next = currentTurnIndex;
        int nextRound = round;
        for (CombatTurnEntry ignored : entries) {
            next = (next + 1) % entries.size();
            if (next == FIRST_TURN_INDEX) {
                nextRound++;
            }
            if (entries.get(next).alive()) {
                return new TurnAdvance(next, nextRound);
            }
        }
        return new TurnAdvance(currentTurnIndex, round);
    }

    public CombatProjectionData combatProjection(List<Combatant> combatants, int requestedTurnIndex, int round) {
        List<CombatTurnEntry> entries = ASSEMBLER.assemble(combatants);
        int currentTurnIndex = normalizedTurnIndex(entries, requestedTurnIndex);
        List<CombatCardData> cards = new ArrayList<>();
        int totalEnemies = 0;
        int aliveEnemies = 0;
        for (Combatant combatant : combatants) {
            if (!combatant.isPlayerCharacter()) {
                totalEnemies++;
                if (combatant.isAlive()) {
                    aliveEnemies++;
                }
            }
        }
        for (int index = 0; index < entries.size(); index++) {
            CombatTurnEntry entry = entries.get(index);
            cards.add(entry.toCardData(index == currentTurnIndex && entry.alive()));
        }
        String statusText = aliveEnemies + "/" + totalEnemies + " - " + LivePressure.from(aliveEnemies, totalEnemies).label();
        return new CombatProjectionData(
                currentTurnIndex,
                round,
                statusText,
                cards,
                totalEnemies > 0 && aliveEnemies == 0);
    }

    public @Nullable CombatTurnEntry turnEntry(List<Combatant> combatants, String combatantId) {
        for (CombatTurnEntry entry : ASSEMBLER.assemble(combatants)) {
            if (entry.id().equals(combatantId)) {
                return entry;
            }
        }
        return null;
    }

    private static int normalizedTurnIndex(List<CombatTurnEntry> entries, int requestedTurnIndex) {
        if (entries.isEmpty()) {
            return NO_ACTIVE_TURN_INDEX;
        }
        int currentTurnIndex = Math.max(FIRST_TURN_INDEX, Math.min(requestedTurnIndex, entries.size() - 1));
        if (entries.get(currentTurnIndex).alive()) {
            return currentTurnIndex;
        }
        for (int index = 0; index < entries.size(); index++) {
            if (entries.get(index).alive()) {
                return index;
            }
        }
        return currentTurnIndex;
    }

    public record TurnAdvance(int currentTurnIndex, int round) {
        public TurnAdvance {
            round = Math.max(FIRST_COMBAT_ROUND, round);
        }
    }

    private enum LivePressure {
        COLLAPSING(0.25, "Kippt"),
        CONTROLLED(0.50, "Unter Kontrolle"),
        DANGEROUS(0.75, "Gefaehrlich"),
        FULL_STRENGTH(1.00, "Volle Staerke");

        private final double remainingRatioLimit;
        private final String label;

        LivePressure(double remainingRatioLimit, String label) {
            this.remainingRatioLimit = remainingRatioLimit;
            this.label = label;
        }

        static LivePressure from(int aliveEnemies, int totalEnemies) {
            if (totalEnemies <= 0) {
                return COLLAPSING;
            }
            double ratio = aliveEnemies / (double) totalEnemies;
            for (LivePressure pressure : values()) {
                if (ratio <= pressure.remainingRatioLimit) {
                    return pressure;
                }
            }
            return FULL_STRENGTH;
        }

        String label() {
            return label;
        }
    }
}
