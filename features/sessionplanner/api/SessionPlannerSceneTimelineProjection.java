package features.sessionplanner.api;

import java.math.BigDecimal;
import java.util.List;

public record SessionPlannerSceneTimelineProjection(
        List<SessionScene> sessionScenes,
        List<RestGap> restGaps
) {
    public SessionPlannerSceneTimelineProjection {
        sessionScenes = copy(sessionScenes);
        restGaps = copy(restGaps);
    }

    @Override
    public List<SessionScene> sessionScenes() {
        return List.copyOf(sessionScenes);
    }

    @Override
    public List<RestGap> restGaps() {
        return List.copyOf(restGaps);
    }

    public static SessionPlannerSceneTimelineProjection empty() {
        return new SessionPlannerSceneTimelineProjection(List.of(), List.of());
    }

    public record SessionScene(
            long sceneToken,
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
            BigDecimal budgetPercentage,
            int targetXp,
            boolean selected,
            String sceneTitle,
            String sceneNotes,
            long locationId,
            List<ManualLootNote> manualLootNotes,
            List<GeneratedReward> generatedRewards
    ) {

        public SessionScene {
            sceneToken = Math.max(0L, sceneToken);
            linkedEncounterPlanId = Math.max(0L, linkedEncounterPlanId);
            linkedEncounterName = linkedEncounterName == null ? "" : linkedEncounterName.trim();
            linkedEncounterGeneratedLabel =
                    linkedEncounterGeneratedLabel == null ? "" : linkedEncounterGeneratedLabel.trim();
            linkedEncounterCreatureCount = Math.max(0, linkedEncounterCreatureCount);
            linkedEncounterTotalBaseXp = Math.max(0, linkedEncounterTotalBaseXp);
            linkedEncounterAdjustedXp = Math.max(0, linkedEncounterAdjustedXp);
            linkedEncounterXpMultiplier = linkedEncounterXpMultiplier <= 0.0 ? 1.0 : linkedEncounterXpMultiplier;
            linkedEncounterDifficultyLabel =
                    linkedEncounterDifficultyLabel == null ? "" : linkedEncounterDifficultyLabel.trim();
            linkedEncounterStatus = linkedEncounterStatus == null ? "" : linkedEncounterStatus.trim();
            linkedEncounterRoster = copy(linkedEncounterRoster);
            budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
            targetXp = Math.max(0, targetXp);
            sceneTitle = sceneTitle == null ? "" : sceneTitle.trim();
            sceneNotes = sceneNotes == null ? "" : sceneNotes.trim();
            locationId = Math.max(0L, locationId);
            manualLootNotes = copy(manualLootNotes);
            generatedRewards = copy(generatedRewards);
        }

        @Override
        public List<ManualLootNote> manualLootNotes() {
            return List.copyOf(manualLootNotes);
        }

        @Override
        public List<EncounterRosterLine> linkedEncounterRoster() {
            return List.copyOf(linkedEncounterRoster);
        }

        @Override
        public List<GeneratedReward> generatedRewards() {
            return List.copyOf(generatedRewards);
        }
    }

    public record EncounterRosterLine(long creatureId, int quantity, String displayName) {
        public EncounterRosterLine {
            creatureId = Math.max(0L, creatureId);
            quantity = Math.max(0, quantity);
            displayName = displayName == null ? "" : displayName.trim();
        }
    }

    public record RestGap(
            int gapIndex,
            long leftSceneToken,
            long rightSceneToken,
            SessionPlannerRestKind restKind
    ) {

        public RestGap {
            gapIndex = Math.max(0, gapIndex);
            leftSceneToken = Math.max(0L, leftSceneToken);
            rightSceneToken = Math.max(0L, rightSceneToken);
            restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
        }
    }

    public record ManualLootNote(long noteId, String authoredText) {
        public ManualLootNote {
            noteId = Math.max(0L, noteId);
            authoredText = authoredText == null ? "" : authoredText.trim();
        }
    }

    public record GeneratedReward(
            String generationRunId,
            int treasureId,
            Availability availability,
            String statusText,
            String fallbackLabel,
            String stockClass,
            String channel,
            int anchorEncounterNumber,
            String theme,
            String magicType,
            long targetCp,
            int nonMagicSlots,
            int magicSlots,
            List<ItemLine> itemLines,
            List<Packing> packing
    ) {
        public GeneratedReward {
            generationRunId = generationRunId == null ? "" : generationRunId.trim();
            treasureId = Math.max(0, treasureId);
            availability = availability == null ? Availability.UNAVAILABLE : availability;
            statusText = statusText == null ? "" : statusText.trim();
            fallbackLabel = availability == Availability.AVAILABLE
                    ? "" : fallbackLabel == null ? "" : fallbackLabel.trim();
            stockClass = stockClass == null ? "" : stockClass.trim();
            channel = channel == null ? "" : channel.trim();
            anchorEncounterNumber = Math.max(0, anchorEncounterNumber);
            theme = theme == null ? "" : theme.trim();
            magicType = magicType == null ? "" : magicType.trim();
            targetCp = Math.max(0L, targetCp);
            nonMagicSlots = Math.max(0, nonMagicSlots);
            magicSlots = Math.max(0, magicSlots);
            itemLines = copy(itemLines);
            packing = copy(packing);
            if (availability == Availability.AVAILABLE
                    && (generationRunId.isBlank() || treasureId <= 0 || channel.isBlank())) {
                throw new IllegalArgumentException("available generated reward is incomplete");
            }
        }

        public String displayLabel() {
            if (availability == Availability.UNAVAILABLE) {
                return fallbackLabel.isBlank() ? "Generierte Belohnung nicht verfügbar" : fallbackLabel;
            }
            String themed = theme.isBlank() ? "Generierte Belohnung" : theme;
            return channel + " · " + themed + " · " + itemLines.size() + " Positionen";
        }
    }

    public enum Availability { AVAILABLE, UNAVAILABLE }

    public record ItemLine(
            int lineId,
            String role,
            String itemId,
            String text,
            long quantity,
            long unitCp,
            long actualCp,
            BigDecimal totalCapacity,
            String allowedContainers,
            String magicRarity,
            boolean cursed
    ) {
        public ItemLine {
            lineId = Math.max(0, lineId);
            role = role == null ? "" : role.trim();
            itemId = itemId == null ? "" : itemId.trim();
            text = text == null ? "" : text.trim();
            quantity = Math.max(0L, quantity);
            unitCp = Math.max(0L, unitCp);
            actualCp = Math.max(0L, actualCp);
            totalCapacity = totalCapacity == null ? BigDecimal.ZERO : totalCapacity;
            allowedContainers = allowedContainers == null ? "" : allowedContainers.trim();
            magicRarity = magicRarity == null ? "" : magicRarity.trim();
        }
    }

    public record Packing(
            int lineId,
            String containerType,
            int containerCount,
            String containerId,
            boolean valid
    ) {
        public Packing {
            lineId = Math.max(0, lineId);
            containerType = containerType == null ? "" : containerType.trim();
            containerCount = Math.max(0, containerCount);
            containerId = containerId == null ? "" : containerId.trim();
        }
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
