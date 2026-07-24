package features.sessionplanner.api;

import java.math.BigDecimal;
import java.util.List;

/** The only collection-bearing scene detail in one workspace publication. */
public record SessionPlannerSelectedSceneSnapshot(
        boolean available,
        long sceneToken,
        String sceneTitle,
        String sceneNotes,
        long locationId,
        List<LocationChoice> locationChoices,
        BigDecimal budgetPercentage,
        int targetXp,
        long linkedEncounterPlanId,
        boolean linkedEncounterPlan,
        String linkedEncounterName,
        String linkedEncounterGeneratedLabel,
        int linkedEncounterCreatureCount,
        int linkedEncounterTotalBaseXp,
        int linkedEncounterAdjustedXp,
        double linkedEncounterXpMultiplier,
        String linkedEncounterDifficultyLabel,
        String linkedEncounterStatus,
        List<EncounterRosterLine> linkedEncounterRoster,
        List<ManualLootNote> manualLootNotes,
        List<GeneratedReward> treasures,
        SessionEncounterPlanSearchSnapshot encounterPlanSearch
) {
    public SessionPlannerSelectedSceneSnapshot {
        sceneToken = Math.max(0L, sceneToken);
        sceneTitle = text(sceneTitle);
        sceneNotes = text(sceneNotes);
        locationId = Math.max(0L, locationId);
        locationChoices = copy(locationChoices);
        budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
        targetXp = Math.max(0, targetXp);
        linkedEncounterPlanId = Math.max(0L, linkedEncounterPlanId);
        linkedEncounterName = text(linkedEncounterName);
        linkedEncounterGeneratedLabel = text(linkedEncounterGeneratedLabel);
        linkedEncounterCreatureCount = Math.max(0, linkedEncounterCreatureCount);
        linkedEncounterTotalBaseXp = Math.max(0, linkedEncounterTotalBaseXp);
        linkedEncounterAdjustedXp = Math.max(0, linkedEncounterAdjustedXp);
        linkedEncounterXpMultiplier = linkedEncounterXpMultiplier <= 0.0 ? 1.0 : linkedEncounterXpMultiplier;
        linkedEncounterDifficultyLabel = text(linkedEncounterDifficultyLabel);
        linkedEncounterStatus = text(linkedEncounterStatus);
        linkedEncounterRoster = copy(linkedEncounterRoster);
        manualLootNotes = copy(manualLootNotes);
        treasures = copy(treasures);
        encounterPlanSearch = encounterPlanSearch == null
                ? SessionEncounterPlanSearchSnapshot.idle() : encounterPlanSearch;
        if (!available && (sceneToken != 0L || !linkedEncounterRoster.isEmpty()
                || !manualLootNotes.isEmpty() || !treasures.isEmpty())) {
            throw new IllegalArgumentException("unavailable selected scene cannot carry detail");
        }
    }

    public static SessionPlannerSelectedSceneSnapshot empty() {
        return new SessionPlannerSelectedSceneSnapshot(
                false, 0L, "", "", 0L, List.of(), BigDecimal.ZERO, 0,
                0L, false, "", "", 0, 0, 0, 1.0, "", "", List.of(),
                List.of(), List.of(), SessionEncounterPlanSearchSnapshot.idle());
    }

    public SessionPlannerSelectedSceneSnapshot withEncounterPlanSearch(
            SessionEncounterPlanSearchSnapshot search
    ) {
        return new SessionPlannerSelectedSceneSnapshot(
                available, sceneToken, sceneTitle, sceneNotes, locationId, locationChoices,
                budgetPercentage, targetXp, linkedEncounterPlanId, linkedEncounterPlan,
                linkedEncounterName, linkedEncounterGeneratedLabel, linkedEncounterCreatureCount,
                linkedEncounterTotalBaseXp, linkedEncounterAdjustedXp, linkedEncounterXpMultiplier,
                linkedEncounterDifficultyLabel, linkedEncounterStatus, linkedEncounterRoster,
                manualLootNotes, treasures, search);
    }

    public record LocationChoice(long locationId, String displayName) {
        public LocationChoice {
            locationId = Math.max(0L, locationId);
            displayName = displayName == null || displayName.isBlank()
                    ? "Location #" + locationId : displayName.trim();
        }
    }

    public record EncounterRosterLine(long creatureId, int quantity, String displayName) {
        public EncounterRosterLine {
            creatureId = Math.max(0L, creatureId);
            quantity = Math.max(0, quantity);
            displayName = text(displayName);
        }
    }

    public record ManualLootNote(long noteId, String authoredText) {
        public ManualLootNote {
            noteId = Math.max(0L, noteId);
            authoredText = text(authoredText);
        }
    }

    public record GeneratedReward(
            int treasureId,
            String title,
            String note,
            String stockClass,
            String channel,
            String theme,
            String magicType,
            long targetCp,
            int nonMagicSlots,
            int magicSlots,
            List<ItemLine> itemLines,
        List<Packing> packing
    ) {
        public GeneratedReward {
            treasureId = Math.max(0, treasureId);
            title = text(title);
            note = text(note);
            stockClass = text(stockClass);
            channel = text(channel);
            theme = text(theme);
            magicType = text(magicType);
            targetCp = Math.max(0L, targetCp);
            nonMagicSlots = Math.max(0, nonMagicSlots);
            magicSlots = Math.max(0, magicSlots);
            itemLines = copy(itemLines);
            packing = copy(packing);
            if (treasureId <= 0) {
                throw new IllegalArgumentException("treasure is incomplete");
            }
        }

        public String displayLabel() {
            if (!title.isBlank()) {
                return title;
            }
            String themed = theme.isBlank() ? "Schatz" : theme;
            return channel + " · " + themed + " · " + itemLines.size() + " Positionen";
        }

    }

    public record ItemLine(
            int lineId, String role, String itemId, String text, long quantity,
            long unitCp, long actualCp, BigDecimal totalCapacity, String allowedContainers,
            String magicRarity, boolean cursed
    ) {
        public ItemLine {
            lineId = Math.max(0, lineId);
            role = SessionPlannerSelectedSceneSnapshot.text(role);
            itemId = SessionPlannerSelectedSceneSnapshot.text(itemId);
            text = SessionPlannerSelectedSceneSnapshot.text(text);
            quantity = Math.max(0L, quantity);
            unitCp = Math.max(0L, unitCp);
            actualCp = Math.max(0L, actualCp);
            totalCapacity = totalCapacity == null ? BigDecimal.ZERO : totalCapacity;
            allowedContainers = SessionPlannerSelectedSceneSnapshot.text(allowedContainers);
            magicRarity = SessionPlannerSelectedSceneSnapshot.text(magicRarity);
        }
    }

    public record Packing(int lineId, String containerType, int containerCount, String containerId, boolean valid) {
        public Packing {
            lineId = Math.max(0, lineId);
            containerType = text(containerType);
            containerCount = Math.max(0, containerCount);
            containerId = text(containerId);
        }
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
