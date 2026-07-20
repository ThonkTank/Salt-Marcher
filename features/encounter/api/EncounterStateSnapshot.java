package features.encounter.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record EncounterStateSnapshot(
        Mode activeMode,
        BuilderPane builderPane,
        InitiativePane initiativePane,
        CombatPane combatPane,
        ResolutionPane resolutionPane,
        String statusLine
) {

    public EncounterStateSnapshot {
        activeMode = activeMode == null ? Mode.BUILDER : activeMode;
        builderPane = builderPane == null ? BuilderPane.empty() : builderPane;
        initiativePane = initiativePane == null ? InitiativePane.empty() : initiativePane;
        combatPane = combatPane == null ? CombatPane.empty() : combatPane;
        resolutionPane = resolutionPane == null ? ResolutionPane.empty() : resolutionPane;
        statusLine = statusLine == null ? "" : statusLine;
    }

    public static EncounterStateSnapshot empty(String statusLine) {
        return new EncounterStateSnapshot(Mode.BUILDER, BuilderPane.empty(), InitiativePane.empty(), CombatPane.empty(), ResolutionPane.empty(), statusLine);
    }

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    public record BuilderPane(
            String partySummary,
            String templateTitle,
            ThresholdMeter thresholds,
            BuilderSettings currentSettings,
            List<String> generationHints,
            List<SavedEncounterPlanSummary> savedPlanChoices,
            List<RosterCard> rosterCards,
            boolean rosterEmpty,
            boolean startCombatEnabled,
            boolean previousAlternativeEnabled,
            boolean nextAlternativeEnabled,
            boolean savePlanEnabled,
            boolean clearHistoryEnabled,
            @Nullable UndoNotice undoNotice
    ) {
        public BuilderPane {
            partySummary = partySummary == null ? "" : partySummary;
            templateTitle = templateTitle == null ? "" : templateTitle;
            thresholds = thresholds == null ? ThresholdMeter.empty() : thresholds;
            currentSettings = currentSettings == null ? BuilderSettings.defaultSettings() : currentSettings;
            generationHints = generationHints == null ? List.of() : List.copyOf(generationHints);
            savedPlanChoices = savedPlanChoices == null ? List.of() : List.copyOf(savedPlanChoices);
            rosterCards = rosterCards == null ? List.of() : List.copyOf(rosterCards);
        }

        public static BuilderPane empty() {
            return new BuilderPane(
                    "",
                    "",
                    ThresholdMeter.empty(),
                    BuilderSettings.defaultSettings(),
                    List.of(),
                    List.of(),
                    List.of(),
                    true,
                    false,
                    false,
                    false,
                    false,
                    false,
                    null);
        }
    }

    public record ThresholdMeter(
            int easyThreshold,
            int mediumThreshold,
            int hardThreshold,
            int deadlyThreshold,
            int adjustedXp,
            String difficultyLabel
    ) {
        public ThresholdMeter {
            difficultyLabel = difficultyLabel == null ? "" : difficultyLabel;
        }

        public static ThresholdMeter empty() {
            return new ThresholdMeter(0, 0, 0, 0, 0, "");
        }
    }

    public record BuilderSettings(
            String difficultyLabel,
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        public BuilderSettings {
            difficultyLabel = difficultyLabel == null ? "Auto" : difficultyLabel;
        }

        public static BuilderSettings defaultSettings() {
            return new BuilderSettings("Auto", -1, -1.0, -1);
        }
    }

    public record RosterCard(
            long creatureId,
            long worldNpcId,
            String displayName,
            String challengeRating,
            int xpTotal,
            int armorClass,
            String creatureType,
            String encounterRole,
            int count
    ) {
        public RosterCard {
            creatureId = Math.max(0L, creatureId);
            worldNpcId = Math.max(0L, worldNpcId);
            displayName = displayName == null ? "" : displayName;
            challengeRating = challengeRating == null ? "" : challengeRating;
            creatureType = creatureType == null ? "" : creatureType;
            encounterRole = encounterRole == null ? "" : encounterRole;
            count = Math.max(1, count);
        }
    }

    public record UndoNotice(long undoToken, String creatureName) {
        public UndoNotice {
            creatureName = creatureName == null ? "" : creatureName;
        }
    }

    public record InitiativePane(List<InitiativeRow> rows) {
        public InitiativePane {
            rows = rows == null ? List.of() : List.copyOf(rows);
        }

        public static InitiativePane empty() {
            return new InitiativePane(List.of());
        }
    }

    public record InitiativeRow(String combatantId, String displayLabel, String kindLabel, int initiativeValue) {
        public InitiativeRow {
            combatantId = combatantId == null ? "" : combatantId;
            displayLabel = displayLabel == null ? "" : displayLabel;
            kindLabel = kindLabel == null ? "" : kindLabel;
        }
    }

    public record CombatPane(
            int roundIndex,
            String combatStatus,
            List<CombatCard> combatCards,
            boolean allEnemiesDefeated,
            List<PartyCandidate> addablePartyMembers
    ) {
        public CombatPane {
            combatStatus = combatStatus == null ? "" : combatStatus;
            combatCards = combatCards == null ? List.of() : List.copyOf(combatCards);
            addablePartyMembers = addablePartyMembers == null ? List.of() : List.copyOf(addablePartyMembers);
        }

        public static CombatPane empty() {
            return new CombatPane(1, "", List.of(), false, List.of());
        }
    }

    public record CombatCard(
            String combatantId,
            String displayName,
            boolean playerCharacter,
            long worldNpcId,
            boolean activeTurn,
            boolean alive,
            int currentHp,
            int maxHp,
            int armorClass,
            int initiativeValue,
            int count,
            String detailText
    ) {
        public CombatCard {
            combatantId = combatantId == null ? "" : combatantId;
            displayName = displayName == null ? "" : displayName;
            worldNpcId = Math.max(0L, worldNpcId);
            detailText = detailText == null ? "" : detailText;
        }
    }

    public record PartyCandidate(long partyMemberId, String displayName, int level) {
        public PartyCandidate {
            displayName = displayName == null ? "" : displayName;
        }
    }

    public record ResolutionPane(
            List<ResultEnemy> enemyResults,
            long defeatedCount,
            int eligibleXp,
            int perPlayerXp,
            String goldSummary,
            String lootDetail,
            String awardStatus,
            boolean xpAwarded,
            boolean canAwardXp,
            int partySize
    ) {
        public ResolutionPane {
            enemyResults = enemyResults == null ? List.of() : List.copyOf(enemyResults);
            goldSummary = goldSummary == null ? "Kein Loot" : goldSummary;
            lootDetail = lootDetail == null ? "" : lootDetail;
            awardStatus = awardStatus == null ? "" : awardStatus;
            partySize = Math.max(1, partySize);
        }

        public static ResolutionPane empty() {
            return new ResolutionPane(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false, 1);
        }
    }

    public record ResultEnemy(
            String displayName,
            long creatureId,
            long worldNpcId,
            String statusLabel,
            int hpLoss,
            int xp,
            boolean defeatedByDefault,
            String loot
    ) {
        public ResultEnemy {
            displayName = displayName == null ? "" : displayName;
            creatureId = Math.max(0L, creatureId);
            worldNpcId = Math.max(0L, worldNpcId);
            statusLabel = statusLabel == null ? "" : statusLabel;
            loot = loot == null ? "" : loot;
        }
    }
}
