package src.domain.sessionplanner.session.aggregate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import src.domain.sessionplanner.session.value.EncounterDays;
import src.domain.sessionplanner.session.value.SessionEncounter;
import src.domain.sessionplanner.session.value.SessionEncounterAllocation;
import src.domain.sessionplanner.session.value.SessionLootPlaceholder;
import src.domain.sessionplanner.session.value.SessionRestPlacement;

public record SessionPlan(
        long sessionId,
        List<Long> participantRefs,
        EncounterDays encounterDays,
        List<SessionEncounter> encounters,
        List<SessionRestPlacement> restPlacements,
        List<SessionLootPlaceholder> lootPlaceholders,
        long selectedEncounterId,
        String statusText,
        long nextEncounterId,
        long nextLootId
) {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int SCALE = 4;

    public SessionPlan {
        sessionId = Math.max(1L, sessionId);
        participantRefs = participantRefs == null ? List.of() : List.copyOf(participantRefs);
        encounterDays = encounterDays == null ? EncounterDays.one() : encounterDays;
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        restPlacements = restPlacements == null ? List.of() : List.copyOf(restPlacements);
        lootPlaceholders = lootPlaceholders == null ? List.of() : List.copyOf(lootPlaceholders);
        selectedEncounterId = Math.max(0L, selectedEncounterId);
        statusText = statusText == null ? "" : statusText;
        nextEncounterId = Math.max(1L, nextEncounterId);
        nextLootId = Math.max(1L, nextLootId);
    }

    public static SessionPlan seeded(
            long sessionId,
            List<Long> participantRefs,
            EncounterDays encounterDays
    ) {
        return new SessionPlan(
                sessionId,
                participantRefs,
                encounterDays,
                List.of(),
                List.of(),
                List.of(),
                0L,
                "",
                1L,
                1L);
    }

    public SessionPlan clearStatus() {
        return copy(participantRefs, encounterDays, encounters, restPlacements, lootPlaceholders, selectedEncounterId, "", nextEncounterId, nextLootId);
    }

    public SessionPlan withStatus(String statusText) {
        return copy(participantRefs, encounterDays, encounters, restPlacements, lootPlaceholders, selectedEncounterId, statusText, nextEncounterId, nextLootId);
    }

    public SessionPlan addParticipant(long characterId) {
        if (characterId <= 0L) {
            return this;
        }
        if (participantRefs.contains(characterId)) {
            return withStatus("Charakter ist bereits Teil der Session.");
        }
        List<Long> nextParticipants = new ArrayList<>(participantRefs);
        nextParticipants.add(characterId);
        return copy(nextParticipants, encounterDays, encounters, restPlacements, lootPlaceholders, selectedEncounterId,
                "Charakter zur Session hinzugefuegt.", nextEncounterId, nextLootId);
    }

    public SessionPlan removeParticipant(long characterId) {
        if (characterId <= 0L) {
            return this;
        }
        List<Long> nextParticipants = new ArrayList<>(participantRefs);
        boolean removed = nextParticipants.remove(Long.valueOf(characterId));
        if (!removed) {
            return this;
        }
        return copy(nextParticipants, encounterDays, encounters, restPlacements, lootPlaceholders, selectedEncounterId,
                "Charakter aus der Session entfernt.", nextEncounterId, nextLootId);
    }

    public SessionPlan setEncounterDays(EncounterDays encounterDays) {
        return copy(participantRefs, encounterDays == null ? EncounterDays.one() : encounterDays, encounters, restPlacements, lootPlaceholders,
                selectedEncounterId, "Session-Tage aktualisiert.", nextEncounterId, nextLootId);
    }

    public SessionPlan attachEncounter(long encounterPlanId) {
        if (encounterPlanId <= 0L) {
            return this;
        }
        long encounterId = nextEncounterId;
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        nextEncounters.add(new SessionEncounter(encounterId, encounterPlanId, SessionEncounterAllocation.zero()));
        List<SessionEncounter> rebalanced = rebalanceAllocationsEvenly(nextEncounters);
        long nextSelected = selectedEncounterId <= 0L ? encounterId : selectedEncounterId;
        return copy(participantRefs, encounterDays, rebalanced, restPlacements, lootPlaceholders, nextSelected,
                "Encounter an Session angehaengt.", nextEncounterId + 1, nextLootId);
    }

    public SessionPlan removeEncounter(long encounterId) {
        int index = encounterIndex(encounters, encounterId);
        if (index < 0) {
            return this;
        }
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        nextEncounters.remove(index);
        List<SessionRestPlacement> nextRestPlacements = pruneRestPlacements(nextEncounters, restPlacements);
        List<SessionEncounter> normalized = renormalizeAllocationsAfterRemoval(nextEncounters);
        long nextSelected = selectedEncounterId;
        if (selectedEncounterId == encounterId) {
            nextSelected = normalized.isEmpty()
                    ? 0L
                    : normalized.get(Math.min(index, normalized.size() - 1)).encounterId();
        }
        return copy(participantRefs, encounterDays, normalized, nextRestPlacements, lootPlaceholders, nextSelected,
                "Encounter entfernt.", nextEncounterId, nextLootId);
    }

    public SessionPlan moveEncounterUp(long encounterId) {
        return moveEncounter(encounterId, -1);
    }

    public SessionPlan moveEncounterDown(long encounterId) {
        return moveEncounter(encounterId, 1);
    }

    public SessionPlan setEncounterAllocation(long encounterId, BigDecimal budgetPercentage) {
        int targetIndex = encounterIndex(encounters, encounterId);
        if (targetIndex < 0) {
            return this;
        }
        if (encounters.size() == 1) {
            return copy(participantRefs, encounterDays,
                    List.of(encounters.get(0).withAllocation(SessionEncounterAllocation.hundred())),
                    restPlacements,
                    lootPlaceholders,
                    selectedEncounterId,
                    "Encounter-Budget aktualisiert.",
                    nextEncounterId,
                    nextLootId);
        }
        BigDecimal clampedTarget = SessionEncounterAllocation.normalizePercentage(budgetPercentage);
        BigDecimal remainingBudget = HUNDRED.subtract(clampedTarget).max(BigDecimal.ZERO);
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        List<Integer> otherIndexes = new ArrayList<>();
        BigDecimal otherSum = BigDecimal.ZERO;
        for (int index = 0; index < nextEncounters.size(); index++) {
            if (index == targetIndex) {
                continue;
            }
            otherIndexes.add(index);
            otherSum = otherSum.add(nextEncounters.get(index).allocation().budgetPercentage());
        }
        List<BigDecimal> redistributed = otherSum.signum() <= 0
                ? distributeEvenly(otherIndexes.size(), remainingBudget)
                : distributeProportionally(nextEncounters, otherIndexes, otherSum, remainingBudget);
        nextEncounters.set(targetIndex, nextEncounters.get(targetIndex).withAllocation(new SessionEncounterAllocation(clampedTarget)));
        for (int offset = 0; offset < otherIndexes.size(); offset++) {
            int index = otherIndexes.get(offset);
            nextEncounters.set(index, nextEncounters.get(index).withAllocation(new SessionEncounterAllocation(redistributed.get(offset))));
        }
        return copy(participantRefs, encounterDays, nextEncounters, restPlacements, lootPlaceholders, selectedEncounterId,
                "Encounter-Budget aktualisiert.", nextEncounterId, nextLootId);
    }

    public SessionPlan selectEncounter(long encounterId) {
        return encounterIndex(encounters, encounterId) < 0
                ? this
                : copy(participantRefs, encounterDays, encounters, restPlacements, lootPlaceholders, encounterId,
                "Encounter ausgewaehlt.", nextEncounterId, nextLootId);
    }

    public SessionPlan setRestPlacement(SessionRestPlacement placement) {
        if (placement == null || !isAdjacent(encounters, placement.leftEncounterId(), placement.rightEncounterId())) {
            return this;
        }
        SessionPlan cleared = clearRestPlacement(placement.leftEncounterId(), placement.rightEncounterId());
        List<SessionRestPlacement> nextRestPlacements = new ArrayList<>(cleared.restPlacements);
        nextRestPlacements.add(placement);
        return cleared.copy(cleared.participantRefs, cleared.encounterDays, cleared.encounters, nextRestPlacements, cleared.lootPlaceholders,
                cleared.selectedEncounterId, "Rast aktualisiert.", cleared.nextEncounterId, cleared.nextLootId);
    }

    public SessionPlan clearRestPlacement(long leftEncounterId, long rightEncounterId) {
        List<SessionRestPlacement> nextRestPlacements = new ArrayList<>(restPlacements);
        boolean removed = false;
        Iterator<SessionRestPlacement> iterator = nextRestPlacements.iterator();
        while (iterator.hasNext()) {
            SessionRestPlacement placement = iterator.next();
            if (placement.matchesGap(leftEncounterId, rightEncounterId)) {
                iterator.remove();
                removed = true;
            }
        }
        return removed
                ? copy(participantRefs, encounterDays, encounters, nextRestPlacements, lootPlaceholders, selectedEncounterId,
                "Rast entfernt.", nextEncounterId, nextLootId)
                : this;
    }

    public SessionPlan addLootPlaceholder() {
        List<SessionLootPlaceholder> nextLootPlaceholders = new ArrayList<>(lootPlaceholders);
        nextLootPlaceholders.add(new SessionLootPlaceholder(
                nextLootId,
                "Loot-Platzhalter " + (lootPlaceholders.size() + 1)));
        return copy(participantRefs, encounterDays, encounters, restPlacements, nextLootPlaceholders, selectedEncounterId,
                "Loot-Platzhalter hinzugefuegt.", nextEncounterId, nextLootId + 1);
    }

    public SessionPlan removeLootPlaceholder(long lootId) {
        List<SessionLootPlaceholder> nextLootPlaceholders = new ArrayList<>(lootPlaceholders);
        boolean removed = nextLootPlaceholders.removeIf(placeholder -> placeholder.lootId() == lootId);
        return removed
                ? copy(participantRefs, encounterDays, encounters, restPlacements, nextLootPlaceholders, selectedEncounterId,
                "Loot-Platzhalter entfernt.", nextEncounterId, nextLootId)
                : this;
    }

    private SessionPlan moveEncounter(long encounterId, int delta) {
        int index = encounterIndex(encounters, encounterId);
        int nextIndex = index + delta;
        if (index < 0 || nextIndex < 0 || nextIndex >= encounters.size()) {
            return this;
        }
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        Collections.swap(nextEncounters, index, nextIndex);
        List<SessionRestPlacement> nextRestPlacements = pruneRestPlacements(nextEncounters, restPlacements);
        return copy(participantRefs, encounterDays, nextEncounters, nextRestPlacements, lootPlaceholders, selectedEncounterId,
                "Encounter verschoben.", nextEncounterId, nextLootId);
    }

    private SessionPlan copy(
            List<Long> participantRefs,
            EncounterDays encounterDays,
            List<SessionEncounter> encounters,
            List<SessionRestPlacement> restPlacements,
            List<SessionLootPlaceholder> lootPlaceholders,
            long selectedEncounterId,
            String statusText,
            long nextEncounterId,
            long nextLootId
    ) {
        return new SessionPlan(
                sessionId,
                participantRefs,
                encounterDays,
                encounters,
                restPlacements,
                lootPlaceholders,
                selectedEncounterId,
                statusText,
                nextEncounterId,
                nextLootId);
    }

    private static int encounterIndex(List<SessionEncounter> encounters, long encounterId) {
        for (int index = 0; index < encounters.size(); index++) {
            if (encounters.get(index).encounterId() == encounterId) {
                return index;
            }
        }
        return -1;
    }

    private static boolean isAdjacent(List<SessionEncounter> encounters, long leftEncounterId, long rightEncounterId) {
        for (int index = 0; index < encounters.size() - 1; index++) {
            SessionEncounter left = encounters.get(index);
            SessionEncounter right = encounters.get(index + 1);
            if (left.encounterId() == leftEncounterId
                    && right.encounterId() == rightEncounterId) {
                return true;
            }
        }
        return false;
    }

    private static List<SessionRestPlacement> pruneRestPlacements(
            List<SessionEncounter> encounters,
            List<SessionRestPlacement> restPlacements
    ) {
        List<SessionRestPlacement> nextRestPlacements = new ArrayList<>(restPlacements);
        nextRestPlacements.removeIf(placement -> !isAdjacent(
                encounters,
                placement.leftEncounterId(),
                placement.rightEncounterId()));
        return nextRestPlacements;
    }

    private static List<SessionEncounter> rebalanceAllocationsEvenly(List<SessionEncounter> encounters) {
        List<BigDecimal> allocations = distributeEvenly(encounters.size(), HUNDRED);
        List<SessionEncounter> rebalanced = new ArrayList<>(encounters.size());
        for (int index = 0; index < encounters.size(); index++) {
            rebalanced.add(encounters.get(index).withAllocation(new SessionEncounterAllocation(allocations.get(index))));
        }
        return rebalanced;
    }

    private static List<SessionEncounter> renormalizeAllocationsAfterRemoval(List<SessionEncounter> encounters) {
        if (encounters.isEmpty()) {
            return List.of();
        }
        BigDecimal total = BigDecimal.ZERO;
        for (SessionEncounter encounter : encounters) {
            total = total.add(encounter.allocation().budgetPercentage());
        }
        List<BigDecimal> allocations = total.signum() <= 0
                ? distributeEvenly(encounters.size(), HUNDRED)
                : distributeProportionally(encounters, allEncounterIndexes(encounters.size()), total, HUNDRED);
        List<SessionEncounter> normalized = new ArrayList<>(encounters.size());
        for (int index = 0; index < encounters.size(); index++) {
            normalized.add(encounters.get(index).withAllocation(new SessionEncounterAllocation(allocations.get(index))));
        }
        return normalized;
    }

    private static List<Integer> allEncounterIndexes(int size) {
        List<Integer> indexes = new ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            indexes.add(index);
        }
        return indexes;
    }

    private static List<BigDecimal> distributeProportionally(
            List<SessionEncounter> encounters,
            List<Integer> indexes,
            BigDecimal sourceTotal,
            BigDecimal targetTotal
    ) {
        List<BigDecimal> distributed = new ArrayList<>(indexes.size());
        BigDecimal consumed = BigDecimal.ZERO;
        for (int offset = 0; offset < indexes.size(); offset++) {
            BigDecimal nextValue;
            if (offset == indexes.size() - 1) {
                nextValue = targetTotal.subtract(consumed);
            } else {
                BigDecimal sourceValue = encounters.get(indexes.get(offset)).allocation().budgetPercentage();
                nextValue = sourceValue.multiply(targetTotal)
                        .divide(sourceTotal, SCALE, RoundingMode.HALF_UP);
                consumed = consumed.add(nextValue);
            }
            distributed.add(nextValue.max(BigDecimal.ZERO));
        }
        return distributed;
    }

    private static List<BigDecimal> distributeEvenly(int count, BigDecimal total) {
        if (count <= 0) {
            return List.of();
        }
        List<BigDecimal> values = new ArrayList<>(count);
        BigDecimal base = total.divide(BigDecimal.valueOf(count), SCALE, RoundingMode.DOWN);
        BigDecimal consumed = BigDecimal.ZERO;
        for (int index = 0; index < count; index++) {
            BigDecimal nextValue = index == count - 1 ? total.subtract(consumed) : base;
            values.add(nextValue.max(BigDecimal.ZERO));
            consumed = consumed.add(nextValue);
        }
        return values;
    }
}
