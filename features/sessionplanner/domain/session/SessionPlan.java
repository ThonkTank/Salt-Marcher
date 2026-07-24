package features.sessionplanner.domain.session;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public record SessionPlan(
        long sessionId,
        SessionRevision revision,
        String displayName,
        List<Long> participantRefs,
        EncounterDays encounterDays,
        List<SessionEncounter> encounters,
        List<SessionRestPlacement> restPlacements,
        List<SessionManualLootNote> manualLootNotes,
        List<SessionTreasure> treasures,
        long selectedEncounterId,
        String statusText,
        long nextEncounterId,
        long nextLootId
) {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int SCALE = 4;
    private static final long UNRESOLVED_ID = 0L;
    private static final int SINGLE_ENCOUNTER_COUNT = 1;

    public SessionPlan {
        sessionId = Math.max(1L, sessionId);
        revision = revision == null ? SessionRevision.initial() : revision;
        displayName = normalizeDisplayName(displayName, sessionId);
        participantRefs = participantRefs == null ? List.of() : List.copyOf(participantRefs);
        if (participantRefs.stream().anyMatch(id -> id == null || id <= 0L)
                || participantRefs.stream().distinct().count() != participantRefs.size()) {
            throw new IllegalArgumentException("session participant references must be positive and unique");
        }
        encounterDays = encounterDays == null ? EncounterDays.one() : encounterDays;
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        restPlacements = restPlacements == null ? List.of() : List.copyOf(restPlacements);
        manualLootNotes = manualLootNotes == null ? List.of() : List.copyOf(manualLootNotes);
        treasures = treasures == null ? List.of() : List.copyOf(treasures);
        validateManualLootNotes(encounters, manualLootNotes);
        validateTreasures(encounters, treasures);
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
                SessionRevision.initial(),
                "Session #" + Math.max(1L, sessionId),
                participantRefs,
                encounterDays,
                List.of(),
                List.of(),
                List.of(),
                List.<SessionTreasure>of(),
                0L,
                "",
                1L,
                1L);
    }

    public SessionPlan clearStatus() {
        return copy(
                participantRefs,
                encounterDays,
                encounters,
                restPlacements,
                manualLootNotes,
                treasures,
                selectedEncounterId,
                "",
                nextEncounterId,
                nextLootId);
    }

    public SessionPlan withStatus(String statusText) {
        return copy(
                participantRefs,
                encounterDays,
                encounters,
                restPlacements,
                manualLootNotes,
                treasures,
                selectedEncounterId,
                statusText,
                nextEncounterId,
                nextLootId);
    }

    public SessionPlan rename(String nextDisplayName) {
        return new SessionPlan(
                sessionId,
                revision,
                normalizeDisplayName(nextDisplayName, sessionId),
                participantRefs,
                encounterDays,
                encounters,
                restPlacements,
                manualLootNotes,
                treasures,
                selectedEncounterId,
                "Session umbenannt.",
                nextEncounterId,
                nextLootId);
    }

    public SessionPlan addParticipant(long characterId) {
        if (characterId <= UNRESOLVED_ID) {
            return this;
        }
        if (participantRefs.contains(characterId)) {
            return withStatus("Charakter ist bereits Teil der Session.");
        }
        List<Long> nextParticipants = new ArrayList<>(participantRefs);
        nextParticipants.add(characterId);
        return copy(nextParticipants, encounterDays, encounters, restPlacements, manualLootNotes, treasures, selectedEncounterId,
                "Charakter zur Session hinzugefuegt.", nextEncounterId, nextLootId);
    }

    public SessionPlan removeParticipant(long characterId) {
        if (characterId <= UNRESOLVED_ID) {
            return this;
        }
        List<Long> nextParticipants = new ArrayList<>(participantRefs);
        boolean removed = nextParticipants.remove(Long.valueOf(characterId));
        if (!removed) {
            return this;
        }
        return copy(nextParticipants, encounterDays, encounters, restPlacements, manualLootNotes, treasures, selectedEncounterId,
                "Charakter aus der Session entfernt.", nextEncounterId, nextLootId);
    }

    public SessionPlan setEncounterDays(EncounterDays encounterDays) {
        return copy(participantRefs, encounterDays == null ? EncounterDays.one() : encounterDays, encounters, restPlacements, manualLootNotes, treasures,
                selectedEncounterId, "Session-Tage aktualisiert.", nextEncounterId, nextLootId);
    }

    public SessionPlan addScene() {
        long sceneId = nextEncounterId;
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        nextEncounters.add(new SessionEncounter(sceneId, UNRESOLVED_ID, SessionEncounterAllocation.zero()));
        List<SessionEncounter> rebalanced = rebalanceAllocationsEvenly(nextEncounters);
        long nextSelected = selectedEncounterId <= UNRESOLVED_ID ? sceneId : selectedEncounterId;
        return copy(participantRefs, encounterDays, rebalanced, restPlacements, manualLootNotes, treasures, nextSelected,
                "Szene hinzugefuegt.", nextEncounterId + 1, nextLootId);
    }

    public SessionPlan attachEncounter(long sceneId, long encounterPlanId) {
        int index = encounterIndex(encounters, sceneId);
        if (index < 0 || sceneId != selectedEncounterId || encounterPlanId <= UNRESOLVED_ID) {
            return this;
        }
        SessionEncounter existing = encounters.get(index);
        if (existing.encounterPlanId() == encounterPlanId) {
            return this;
        }
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        nextEncounters.set(index, existing.withEncounterPlan(encounterPlanId));
        return copy(participantRefs, encounterDays, nextEncounters, restPlacements, manualLootNotes,
                treasures, selectedEncounterId,
                existing.encounterPlanId() > UNRESOLVED_ID
                        ? "Encounter-Verknüpfung ersetzt." : "Encounter verknüpft.",
                nextEncounterId, nextLootId);
    }

    public SessionPlan detachEncounter(long sceneId) {
        int index = encounterIndex(encounters, sceneId);
        if (index < 0 || sceneId != selectedEncounterId
                || encounters.get(index).encounterPlanId() <= UNRESOLVED_ID) {
            return this;
        }
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        nextEncounters.set(index, encounters.get(index).withEncounterPlan(UNRESOLVED_ID));
        return copy(participantRefs, encounterDays, nextEncounters, restPlacements, manualLootNotes,
                treasures, selectedEncounterId, "Encounter-Verknüpfung entfernt.",
                nextEncounterId, nextLootId);
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
        return copy(
                participantRefs,
                encounterDays,
                normalized,
                nextRestPlacements,
                pruneManualLootNotes(encounterId),
                pruneTreasures(encounterId),
                nextSelected,
                "Encounter entfernt.",
                nextEncounterId,
                nextLootId);
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
        if (encounters.size() == SINGLE_ENCOUNTER_COUNT) {
            return copy(participantRefs, encounterDays,
                    List.of(encounters.get(0).withAllocation(SessionEncounterAllocation.hundred())),
                    restPlacements,
                    manualLootNotes,
                    treasures,
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
        return copy(participantRefs, encounterDays, nextEncounters, restPlacements, manualLootNotes, treasures, selectedEncounterId,
                "Encounter-Budget aktualisiert.", nextEncounterId, nextLootId);
    }

    public SessionPlan updateEncounterScene(long encounterId, String sceneTitle, String sceneNotes, long locationId) {
        int targetIndex = encounterIndex(encounters, encounterId);
        if (targetIndex < 0) {
            return this;
        }
        SessionEncounter existing = encounters.get(targetIndex);
        SessionEncounter updated = existing.withScene(sceneTitle, sceneNotes, locationId);
        if (existing.equals(updated)) {
            return this;
        }
        List<SessionEncounter> nextEncounters = new ArrayList<>(encounters);
        nextEncounters.set(targetIndex, updated);
        return copy(participantRefs, encounterDays, nextEncounters, restPlacements, manualLootNotes, treasures, selectedEncounterId,
                "Szene aktualisiert.", nextEncounterId, nextLootId);
    }

    public SessionPlan selectEncounter(long encounterId) {
        return encounterIndex(encounters, encounterId) < 0
                ? this
                : copy(participantRefs, encounterDays, encounters, restPlacements, manualLootNotes, treasures, encounterId,
                "Encounter ausgewaehlt.", nextEncounterId, nextLootId);
    }

    public SessionPlan setRestPlacement(SessionRestPlacement placement) {
        if (placement == null || !isAdjacent(encounters, placement.leftEncounterId(), placement.rightEncounterId())) {
            return this;
        }
        SessionPlan cleared = clearRestPlacement(placement.leftEncounterId(), placement.rightEncounterId());
        List<SessionRestPlacement> nextRestPlacements = new ArrayList<>(cleared.restPlacements);
        nextRestPlacements.add(placement);
        return cleared.copy(cleared.participantRefs, cleared.encounterDays, cleared.encounters, nextRestPlacements, cleared.manualLootNotes, cleared.treasures,
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
                ? copy(participantRefs, encounterDays, encounters, nextRestPlacements, manualLootNotes, treasures, selectedEncounterId,
                "Rast entfernt.", nextEncounterId, nextLootId)
                : this;
    }

    public SessionPlan addManualLootNote(long sceneId, String authoredText) {
        if (encounterIndex(encounters, sceneId) < 0 || authoredText == null || authoredText.isBlank()) {
            return this;
        }
        List<SessionManualLootNote> nextManualLootNotes = new ArrayList<>(manualLootNotes);
        nextManualLootNotes.add(new SessionManualLootNote(
                nextLootId,
                sceneId,
                authoredText));
        return copy(
                participantRefs,
                encounterDays,
                encounters,
                restPlacements,
                nextManualLootNotes,
                treasures,
                selectedEncounterId,
                "Beutenotiz hinzugefuegt.",
                nextEncounterId,
                nextLootId + 1);
    }

    public SessionPlan updateManualLootNote(long sceneId, long noteId, String authoredText) {
        if (encounterIndex(encounters, sceneId) < 0 || authoredText == null || authoredText.isBlank()) {
            return this;
        }
        List<SessionManualLootNote> nextManualLootNotes = new ArrayList<>(manualLootNotes);
        for (int index = 0; index < nextManualLootNotes.size(); index++) {
            SessionManualLootNote note = nextManualLootNotes.get(index);
            if (note.noteId() == noteId && note.sceneId() == sceneId) {
                String normalized = authoredText.trim();
                if (note.authoredText().equals(normalized)) {
                    return this;
                }
                nextManualLootNotes.set(index, new SessionManualLootNote(noteId, sceneId, normalized));
                return copy(participantRefs, encounterDays, encounters, restPlacements,
                        nextManualLootNotes, treasures, selectedEncounterId,
                        "Beutenotiz aktualisiert.", nextEncounterId, nextLootId);
            }
        }
        return this;
    }

    public SessionPlan removeManualLootNote(long sceneId, long noteId) {
        List<SessionManualLootNote> nextManualLootNotes = new ArrayList<>(manualLootNotes);
        boolean removed = false;
        Iterator<SessionManualLootNote> iterator = nextManualLootNotes.iterator();
        while (iterator.hasNext()) {
            SessionManualLootNote note = iterator.next();
            if (note.noteId() == noteId && note.sceneId() == sceneId) {
                iterator.remove();
                removed = true;
            }
        }
        return removed
                ? copy(participantRefs, encounterDays, encounters, restPlacements, nextManualLootNotes, treasures, selectedEncounterId,
                "Beutenotiz entfernt.", nextEncounterId, nextLootId)
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
        return copy(participantRefs, encounterDays, nextEncounters, nextRestPlacements, manualLootNotes, treasures, selectedEncounterId,
                "Encounter verschoben.", nextEncounterId, nextLootId);
    }

    private SessionPlan copy(
            List<Long> participantRefs,
            EncounterDays encounterDays,
            List<SessionEncounter> encounters,
            List<SessionRestPlacement> restPlacements,
            List<SessionManualLootNote> manualLootNotes,
            List<SessionTreasure> treasures,
            long selectedEncounterId,
            String statusText,
            long nextEncounterId,
            long nextLootId
    ) {
        return new SessionPlan(
                sessionId,
                revision,
                displayName,
                participantRefs,
                encounterDays,
                encounters,
                restPlacements,
                manualLootNotes,
                treasures,
                selectedEncounterId,
                statusText,
                nextEncounterId,
                nextLootId);
    }

    private static String normalizeDisplayName(String name, long sessionId) {
        if (name == null || name.isBlank()) {
            return "Session #" + Math.max(1L, sessionId);
        }
        return name.trim();
    }

    private static void validateTreasures(
            List<SessionEncounter> scenes,
            List<SessionTreasure> rewards
    ) {
        Set<Long> sceneIds = new HashSet<>();
        for (SessionEncounter scene : scenes) {
            sceneIds.add(scene.encounterId());
        }
        Set<Long> treasureIds = new HashSet<>();
        for (SessionTreasure treasure : rewards) {
            if (!sceneIds.contains(treasure.sceneId())) {
                throw new IllegalArgumentException("Treasure references an unknown scene");
            }
            if (!treasureIds.add(treasure.treasureId())) {
                throw new IllegalArgumentException("Treasure identity must be unique within a session");
            }
        }
    }

    private static void validateManualLootNotes(
            List<SessionEncounter> scenes,
            List<SessionManualLootNote> notes
    ) {
        Set<Long> sceneIds = scenes.stream()
                .map(SessionEncounter::encounterId)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
        Set<Long> noteIds = new HashSet<>();
        for (SessionManualLootNote note : notes) {
            if (!sceneIds.contains(note.sceneId())) {
                throw new IllegalArgumentException("Manual loot note references an unknown scene");
            }
            if (!noteIds.add(note.noteId())) {
                throw new IllegalArgumentException("Manual loot note identity must be unique within a session");
            }
        }
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
        Iterator<SessionRestPlacement> iterator = nextRestPlacements.iterator();
        while (iterator.hasNext()) {
            SessionRestPlacement placement = iterator.next();
            if (!isAdjacent(encounters, placement.leftEncounterId(), placement.rightEncounterId())) {
                iterator.remove();
            }
        }
        return nextRestPlacements;
    }

    private List<SessionManualLootNote> pruneManualLootNotes(long sceneId) {
        List<SessionManualLootNote> nextManualLootNotes = new ArrayList<>(manualLootNotes);
        nextManualLootNotes.removeIf(note -> note.sceneId() == sceneId);
        return nextManualLootNotes;
    }

    private List<SessionTreasure> pruneTreasures(long sceneId) {
        return treasures.stream()
                .filter(reward -> reward.sceneId() != sceneId)
                .toList();
    }

    public SessionPlan replaceGeneratedContent(
            List<SessionEncounter> generatedScenes,
            List<SessionTreasure> rewards
    ) {
        List<SessionEncounter> safeScenes = generatedScenes == null ? List.of() : List.copyOf(generatedScenes);
        List<SessionTreasure> safeRewards = rewards == null ? List.of() : List.copyOf(rewards);
        long nextSceneId = safeScenes.stream().mapToLong(SessionEncounter::encounterId).max().orElse(0L) + 1L;
        long selectedSceneId = safeScenes.isEmpty() ? 0L : safeScenes.getFirst().encounterId();
        return new SessionPlan(
                sessionId,
                revision,
                displayName,
                participantRefs,
                encounterDays,
                safeScenes,
                List.of(),
                List.of(),
                safeRewards,
                selectedSceneId,
                "Generierte Session angewandt.",
                Math.max(1L, nextSceneId),
                Math.max(1L, safeRewards.stream().mapToLong(SessionTreasure::treasureId).max().orElse(0L) + 1L));
    }

    public SessionPlan addTreasure(long sceneId) {
        if (encounterIndex(encounters, sceneId) < 0) {
            return this;
        }
        long treasureId = nextAvailableTreasureId();
        List<SessionTreasure> nextTreasures = new ArrayList<>(treasures);
        nextTreasures.add(new SessionTreasure(
                treasureId, sceneId, "Neuer Schatz", "", "", "", "", "", 0L, 0, 0,
                List.of(), List.of()));
        return copy(participantRefs, encounterDays, encounters, restPlacements, manualLootNotes,
                nextTreasures, selectedEncounterId, "Schatz hinzugefügt.", nextEncounterId,
                Math.max(nextLootId, treasureId + 1L));
    }

    private long nextAvailableTreasureId() {
        long candidate = Math.max(1L, nextLootId);
        Set<Long> used = treasures.stream().map(SessionTreasure::treasureId)
                .collect(java.util.stream.Collectors.toSet());
        while (used.contains(candidate)) {
            candidate++;
        }
        return candidate;
    }

    public SessionPlan updateTreasure(long sceneId, SessionTreasure treasure) {
        if (treasure == null || treasure.sceneId() != sceneId || encounterIndex(encounters, sceneId) < 0) {
            return this;
        }
        List<SessionTreasure> nextTreasures = new ArrayList<>(treasures);
        for (int index = 0; index < nextTreasures.size(); index++) {
            if (nextTreasures.get(index).treasureId() == treasure.treasureId()) {
                nextTreasures.set(index, treasure);
                return copy(participantRefs, encounterDays, encounters, restPlacements, manualLootNotes,
                        nextTreasures, selectedEncounterId, "Schatz aktualisiert.", nextEncounterId, nextLootId);
            }
        }
        nextTreasures.add(treasure);
        return copy(participantRefs, encounterDays, encounters, restPlacements, manualLootNotes,
                nextTreasures, selectedEncounterId, "Schatz hinzugefügt.", nextEncounterId,
                Math.max(nextLootId, treasure.treasureId() + 1L));
    }

    public SessionPlan removeTreasure(long sceneId, long treasureId) {
        List<SessionTreasure> nextTreasures = new ArrayList<>(treasures);
        boolean removed = nextTreasures.removeIf(treasure -> treasure.sceneId() == sceneId
                && treasure.treasureId() == treasureId);
        return removed
                ? copy(participantRefs, encounterDays, encounters, restPlacements, manualLootNotes,
                        nextTreasures, selectedEncounterId, "Schatz entfernt.", nextEncounterId, nextLootId)
                : this;
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
