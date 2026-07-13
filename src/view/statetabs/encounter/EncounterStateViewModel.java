package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.SelectCreatureDetailCommand;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.ApplyEncounterStateCommand;
import src.domain.encounter.published.EncounterStateSnapshot;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.published.SetWorldNpcLifecycleStatusCommand;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.GodClass", "PMD.TooManyMethods"})
final class EncounterStateViewModel {

    private static final long UNRESOLVED_ID = 0L;
    private static final CreatureDetailSink NO_CREATURE_DETAIL_SINK = creatureId -> { };

    private final EncounterApplicationService encounters;
    private final WorldPlannerApplicationService worldPlanner;
    private final CreaturesApplicationService creatures;
    private final CreatureDetailSink creatureDetailSink;
    private final ReadOnlyObjectWrapper<EncounterStateSnapshot.Mode> activeMode =
            new ReadOnlyObjectWrapper<>(EncounterStateSnapshot.Mode.BUILDER);
    private final ReadOnlyObjectWrapper<BuilderPanel> builderPanel =
            new ReadOnlyObjectWrapper<>(BuilderPanel.empty());
    private final ReadOnlyObjectWrapper<InitiativePanel> initiativePanel =
            new ReadOnlyObjectWrapper<>(InitiativePanel.empty());
    private final ReadOnlyObjectWrapper<CombatPanel> combatPanel =
            new ReadOnlyObjectWrapper<>(CombatPanel.empty());
    private final ReadOnlyObjectWrapper<ResultsPanel> resultsPanel =
            new ReadOnlyObjectWrapper<>(ResultsPanel.empty());

    private List<EnemyView> resultEnemies = List.of();
    private int resultPartySize = 1;
    private String resultGoldSummary = "Kein Loot";
    private String resultLootDetail = "";
    private String resultAwardStatus = "";
    private boolean resultXpAwarded;
    private boolean resultCanAwardXp;
    private double resultThresholdFraction = 1.0;
    private double resultXpFraction = 1.0;

    EncounterStateViewModel(
            EncounterApplicationService encounters,
            WorldPlannerApplicationService worldPlanner,
            CreaturesApplicationService creatures,
            CreatureDetailSink creatureDetailSink
    ) {
        this.encounters = Objects.requireNonNull(encounters, "encounters");
        this.worldPlanner = worldPlanner;
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.creatureDetailSink = creatureDetailSink == null ? NO_CREATURE_DETAIL_SINK : creatureDetailSink;
    }

    ReadOnlyObjectProperty<EncounterStateSnapshot.Mode> activeModeProperty() {
        return activeMode.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<BuilderPanel> builderPanelProperty() {
        return builderPanel.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<InitiativePanel> initiativePanelProperty() {
        return initiativePanel.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<CombatPanel> combatPanelProperty() {
        return combatPanel.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ResultsPanel> resultsPanelProperty() {
        return resultsPanel.getReadOnlyProperty();
    }

    void apply(EncounterStateSnapshot snapshot) {
        EncounterStateSnapshot safeSnapshot = snapshot == null ? EncounterStateSnapshot.empty("") : snapshot;
        activeMode.set(safeMode(safeSnapshot.activeMode()));
        builderPanel.set(toBuilderPanel(safeSnapshot.builderPane(), safeSnapshot.statusLine()));
        initiativePanel.set(toInitiativePanel(safeSnapshot.initiativePane()));
        combatPanel.set(toCombatPanel(safeSnapshot.combatPane()));
        showResults(safeSnapshot.resolutionPane());
    }

    void generate() {
        applyCommand(ApplyEncounterStateCommand.generate());
    }

    void shiftAlternative(int alternativeShift) {
        applyCommand(ApplyEncounterStateCommand.shiftAlternative(alternativeShift));
    }

    void saveCurrentPlan(String planName) {
        applyCommand(ApplyEncounterStateCommand.saveCurrentPlan(planName));
    }

    void openSavedPlan(long selectedPlanId) {
        applyCommand(ApplyEncounterStateCommand.openSavedPlan(selectedPlanId));
    }

    void changeRosterCount(long creatureId, int delta) {
        applyCommand(delta > 0
                ? ApplyEncounterStateCommand.incrementCreature(creatureId)
                : ApplyEncounterStateCommand.decrementCreature(creatureId));
    }

    void removeCreature(long creatureId) {
        applyCommand(ApplyEncounterStateCommand.removeCreature(creatureId));
    }

    void undoRemove(long undoToken) {
        applyCommand(ApplyEncounterStateCommand.undoRemove(undoToken));
    }

    void clearGenerationHistory() {
        applyCommand(ApplyEncounterStateCommand.clearGenerationHistory());
    }

    void openInitiative() {
        applyCommand(ApplyEncounterStateCommand.openInitiative());
    }

    void openCreatureDetail(long creatureId) {
        if (creatureId <= UNRESOLVED_ID) {
            return;
        }
        creatures.selectCreatureDetail(new SelectCreatureDetailCommand(creatureId));
        creatureDetailSink.openCreatureDetail(creatureId);
    }

    void backToBuilder() {
        applyCommand(ApplyEncounterStateCommand.backToBuilder());
    }

    void confirmInitiative(List<InitiativeEntry> entries) {
        List<String> ids = new ArrayList<>();
        List<Integer> initiatives = new ArrayList<>();
        for (InitiativeEntry entry : entries == null ? List.<InitiativeEntry>of() : entries) {
            ids.add(entry.id());
            initiatives.add(Integer.valueOf(entry.initiative()));
        }
        applyCommand(ApplyEncounterStateCommand.confirmInitiative(ids, initiatives));
    }

    void advanceTurn() {
        applyCommand(ApplyEncounterStateCommand.advanceTurn());
    }

    void endCombat() {
        applyCommand(ApplyEncounterStateCommand.endCombat());
    }

    void mutateHitPoints(String combatantId, int amount, boolean healing) {
        applyCommand(ApplyEncounterStateCommand.mutateHitPoints(combatantId, amount, healing));
    }

    void adjustInitiative(String combatantId, int initiative) {
        applyCommand(ApplyEncounterStateCommand.adjustInitiative(combatantId, initiative));
    }

    void addPartyMemberToCombat(long partyMemberId, int initiative) {
        applyCommand(ApplyEncounterStateCommand.addPartyMemberToCombat(partyMemberId, initiative));
    }

    void updateResultSelection(ResultSelectionDraft draft) {
        showSelection(draft);
    }

    void awardXp(ResultSelectionDraft draft) {
        showSelection(draft);
        applyCommand(ApplyEncounterStateCommand.awardXp());
    }

    void returnToBuilderAfterResults(ResultSelectionDraft draft) {
        showSelection(draft);
        markSelectedWorldNpcsDefeated(draft.selectedEnemies());
        applyCommand(ApplyEncounterStateCommand.returnToBuilderAfterResults());
    }

    private void applyCommand(ApplyEncounterStateCommand command) {
        encounters.applyState(Objects.requireNonNull(command, "command"));
    }

    private void markSelectedWorldNpcsDefeated(List<Boolean> selectedEnemies) {
        if (worldPlanner == null) {
            return;
        }
        for (WorldNpcDefeatView worldNpc : selectedWorldNpcDefeats(selectedEnemies)) {
            if (worldNpc.worldNpcId() > UNRESOLVED_ID) {
                worldPlanner.setNpcLifecycleStatus(SetWorldNpcLifecycleStatusCommand.defeated(
                        worldNpc.worldNpcId(),
                        worldNpc.expectedCreatureStatblockId()));
            }
        }
    }

    private void showResults(EncounterStateSnapshot.ResolutionPane source) {
        EncounterStateSnapshot.ResolutionPane safeSource = source == null
                ? EncounterStateSnapshot.ResolutionPane.empty()
                : source;
        resultEnemies = safeSource.enemyResults().stream().map(EnemyView::from).toList();
        resultPartySize = Math.max(1, safeSource.partySize());
        resultGoldSummary = safe(safeSource.goldSummary());
        resultLootDetail = safe(safeSource.lootDetail());
        resultAwardStatus = safe(safeSource.awardStatus());
        resultXpAwarded = safeSource.xpAwarded();
        resultCanAwardXp = safeSource.canAwardXp();
        rebuildResults(defaultSelections(resultEnemies), resultThresholdFraction, resultXpFraction);
    }

    private void showSelection(ResultSelectionDraft draft) {
        ResultSelectionDraft safeDraft = draft == null ? ResultSelectionDraft.defaultDraft() : draft;
        rebuildResults(safeDraft.selectedEnemies(), safeDraft.thresholdFraction(), safeDraft.xpFraction());
    }

    private void rebuildResults(
            List<Boolean> selectedEnemies,
            double nextThresholdFraction,
            double nextXpFraction
    ) {
        resultThresholdFraction = EncounterStateVocabulary.clampPercent(nextThresholdFraction);
        resultXpFraction = EncounterStateVocabulary.clampPercent(nextXpFraction);
        List<Boolean> selected = normalizeSelections(selectedEnemies, resultEnemies);
        int selectedXp = 0;
        long selectedCount = 0L;
        List<EnemyView> nextEnemies = new ArrayList<>(resultEnemies.size());
        for (int index = 0; index < resultEnemies.size(); index++) {
            EnemyView enemy = resultEnemies.get(index);
            boolean enemySelected = selected.get(index).booleanValue();
            if (enemySelected) {
                selectedXp += enemy.xp();
                selectedCount++;
            }
            nextEnemies.add(enemy.withSelected(enemySelected));
        }
        int thresholdPercent = (int) Math.round(resultThresholdFraction * 100);
        int xpPercent = (int) Math.round(resultXpFraction * 100);
        int awardedXp = (int) Math.round(selectedXp * resultXpFraction);
        int perPlayer = awardedXp / resultPartySize;
        resultsPanel.set(new ResultsPanel(
                nextEnemies,
                selectedCount + " Gegner besiegt | " + selectedXp + " XP",
                perPlayer + " XP",
                "pro Spieler  (" + resultPartySize + " Spieler | " + awardedXp + " XP gesamt)",
                resultGoldSummary,
                resultLootDetail,
                resultAwardStatus,
                !resultCanAwardXp || resultXpAwarded,
                resultThresholdFraction,
                resultXpFraction,
                thresholdPercent + "%",
                xpPercent + "%"));
    }

    private List<WorldNpcDefeatView> selectedWorldNpcDefeats(List<Boolean> selectedEnemies) {
        List<Boolean> selected = normalizeSelections(selectedEnemies, resultEnemies);
        List<WorldNpcDefeatView> worldNpcIds = new ArrayList<>();
        for (int index = 0; index < resultEnemies.size(); index++) {
            EnemyView enemy = resultEnemies.get(index);
            if (selected.get(index).booleanValue() && enemy.worldNpcId() > UNRESOLVED_ID) {
                worldNpcIds.add(new WorldNpcDefeatView(enemy.worldNpcId(), enemy.creatureId()));
            }
        }
        return List.copyOf(worldNpcIds);
    }

    private static BuilderPanel toBuilderPanel(
            EncounterStateSnapshot.BuilderPane source,
            String statusMessage
    ) {
        EncounterStateSnapshot.BuilderPane safeSource = source == null
                ? EncounterStateSnapshot.BuilderPane.empty()
                : source;
        EncounterStateSnapshot.ThresholdMeter difficulty = safeSource.thresholds();
        return new BuilderPanel(
                safeSource.partySummary(),
                safeSource.templateTitle(),
                new DifficultySummary(
                        difficulty.easyThreshold(),
                        difficulty.mediumThreshold(),
                        difficulty.hardThreshold(),
                        difficulty.deadlyThreshold(),
                        difficulty.adjustedXp(),
                        difficulty.difficultyLabel()),
                statusMessage,
                safeSource.generationHints(),
                safeSource.savedPlanChoices().stream().map(EncounterStateViewModel::savedPlan).toList(),
                builderSettings(safeSource.currentSettings()),
                safeSource.rosterCards().stream().map(EncounterStateViewModel::rosterCard).toList(),
                safeSource.rosterEmpty(),
                safeSource.startCombatEnabled(),
                safeSource.previousAlternativeEnabled(),
                safeSource.nextAlternativeEnabled(),
                safeSource.savePlanEnabled(),
                safeSource.clearHistoryEnabled(),
                safeSource.undoNotice() == null
                        ? null
                        : new UndoRemoveView(
                                safeSource.undoNotice().undoToken(),
                                safeSource.undoNotice().creatureName()));
    }

    private static InitiativePanel toInitiativePanel(EncounterStateSnapshot.InitiativePane source) {
        EncounterStateSnapshot.InitiativePane safeSource = source == null
                ? EncounterStateSnapshot.InitiativePane.empty()
                : source;
        return new InitiativePanel(safeSource.rows().stream()
                .map(entry -> new InitiativeEntry(
                        entry.combatantId(),
                        entry.displayLabel(),
                        entry.kindLabel(),
                        entry.initiativeValue()))
                .toList());
    }

    private static CombatPanel toCombatPanel(EncounterStateSnapshot.CombatPane source) {
        EncounterStateSnapshot.CombatPane safeSource = source == null
                ? EncounterStateSnapshot.CombatPane.empty()
                : source;
        return new CombatPanel(
                safeSource.roundIndex(),
                safeSource.combatStatus(),
                safeSource.combatCards().stream()
                        .map(card -> new CombatCard(
                                card.combatantId(),
                                card.displayName(),
                                card.playerCharacter(),
                                card.activeTurn(),
                                card.alive(),
                                card.currentHp(),
                                card.maxHp(),
                                card.armorClass(),
                                card.initiativeValue(),
                                card.count(),
                                card.detailText()))
                        .toList(),
                safeSource.allEnemiesDefeated(),
                safeSource.addablePartyMembers().stream()
                        .map(member -> new PartyMemberCandidate(
                                member.partyMemberId(),
                                member.displayName(),
                                member.level()))
                        .toList());
    }

    private static EncounterStateSnapshot.Mode safeMode(EncounterStateSnapshot.Mode mode) {
        return mode == null ? EncounterStateSnapshot.Mode.BUILDER : mode;
    }

    private static SavedPlanView savedPlan(SavedEncounterPlanSummary plan) {
        return new SavedPlanView(plan.planId(), plan.name(), plan.summaryText());
    }

    private static RosterCardView rosterCard(EncounterStateSnapshot.RosterCard creature) {
        return new RosterCardView(
                creature.creatureId(),
                creature.worldNpcId(),
                creature.displayName(),
                creature.challengeRating(),
                creature.xpTotal(),
                creature.armorClass(),
                creature.creatureType(),
                creature.encounterRole(),
                creature.count());
    }

    private static BuilderSettings builderSettings(EncounterStateSnapshot.BuilderSettings builderInputs) {
        EncounterStateSnapshot.BuilderSettings safeInputs = builderInputs == null
                ? EncounterStateSnapshot.BuilderSettings.defaultSettings()
                : builderInputs;
        return new BuilderSettings(
                safeInputs.difficultyLabel(),
                safeInputs.balanceLevel(),
                safeInputs.amountValue(),
                safeInputs.diversityLevel());
    }

    private static List<Boolean> defaultSelections(List<EnemyView> enemies) {
        return enemies.stream().map(EnemyView::defeatedByDefault).toList();
    }

    private static List<Boolean> normalizeSelections(List<Boolean> selectedEnemies, List<EnemyView> enemies) {
        List<Boolean> selected = new ArrayList<>(enemies.size());
        for (int index = 0; index < enemies.size(); index++) {
            boolean fallback = enemies.get(index).defeatedByDefault();
            if (selectedEnemies == null || index >= selectedEnemies.size()) {
                selected.add(Boolean.valueOf(fallback));
            } else {
                selected.add(Boolean.valueOf(Boolean.TRUE.equals(selectedEnemies.get(index))));
            }
        }
        return List.copyOf(selected);
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    @FunctionalInterface
    interface CreatureDetailSink {
        void openCreatureDetail(long creatureId);
    }

    record BuilderSettings(String difficultyLabel, int balanceLevel, double amountValue, int diversityLevel) {
        BuilderSettings {
            difficultyLabel = safe(difficultyLabel);
        }

        static BuilderSettings defaultSettings() {
            return new BuilderSettings("Auto", -1, -1.0, -1);
        }
    }

    record DifficultySummary(int easy, int medium, int hard, int deadly, int adjustedXp, String difficulty) {
        DifficultySummary {
            difficulty = safe(difficulty);
        }
    }

    record BuilderPanel(
            String partyLabel,
            String templateLabel,
            DifficultySummary difficulty,
            String statusMessage,
            List<String> generationAdvisoryMessages,
            List<SavedPlanView> savedPlans,
            BuilderSettings settings,
            List<RosterCardView> roster,
            boolean showRosterPlaceholder,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            boolean canClearGenerationHistory,
            @Nullable UndoRemoveView pendingUndo
    ) {
        BuilderPanel {
            partyLabel = safe(partyLabel);
            templateLabel = safe(templateLabel);
            difficulty = difficulty == null ? new DifficultySummary(0, 0, 0, 0, 0, "") : difficulty;
            statusMessage = safe(statusMessage);
            generationAdvisoryMessages = generationAdvisoryMessages == null
                    ? List.of()
                    : List.copyOf(generationAdvisoryMessages);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            settings = settings == null ? BuilderSettings.defaultSettings() : settings;
            roster = roster == null ? List.of() : List.copyOf(roster);
        }

        static BuilderPanel empty() {
            return new BuilderPanel(
                    "",
                    "",
                    new DifficultySummary(0, 0, 0, 0, 0, ""),
                    "",
                    List.of(),
                    List.of(),
                    BuilderSettings.defaultSettings(),
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

    record SavedPlanView(long id, String name, String summaryText) {
        SavedPlanView {
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
        }
    }

    record RosterCardView(
            long creatureId,
            long worldNpcId,
            String name,
            String challengeRating,
            int xp,
            int armorClass,
            String type,
            String role,
            int count
    ) {
        RosterCardView {
            creatureId = Math.max(0L, creatureId);
            worldNpcId = Math.max(0L, worldNpcId);
            name = safe(name);
            challengeRating = safe(challengeRating);
            type = safe(type);
            role = safe(role);
            count = Math.max(1, count);
        }

        boolean namedNpc() {
            return worldNpcId > 0L;
        }
    }

    record UndoRemoveView(long token, String creatureName) {
        UndoRemoveView {
            creatureName = safe(creatureName);
        }
    }

    record InitiativeEntry(String id, String label, String kind, int initiative) {
        InitiativeEntry {
            id = safe(id);
            label = safe(label);
            kind = safe(kind);
        }
    }

    record InitiativePanel(List<InitiativeEntry> entries) {
        InitiativePanel {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }

        static InitiativePanel empty() {
            return new InitiativePanel(List.of());
        }
    }

    record HpMeterDisplay(double fraction, String text, String accessibleText, String fillStyleClass) {
        HpMeterDisplay {
            fraction = EncounterStateVocabulary.clampPercent(fraction);
            text = safe(text);
            accessibleText = accessibleText == null || accessibleText.isBlank() ? text : accessibleText;
            fillStyleClass = safe(fillStyleClass);
        }
    }

    record CombatCard(
            String id,
            String name,
            boolean playerCharacter,
            boolean active,
            boolean alive,
            int currentHp,
            int maxHp,
            int armorClass,
            int initiative,
            int count,
            String detail
    ) {
        CombatCard {
            id = safe(id);
            name = safe(name);
            detail = safe(detail);
            count = Math.max(1, count);
        }
    }

    record PartyMemberCandidate(long memberId, String name, int level) {
        PartyMemberCandidate {
            memberId = Math.max(0L, memberId);
            name = safe(name);
        }
    }

    record CombatPanel(
            int round,
            String status,
            List<CombatCard> cards,
            boolean allEnemiesDefeated,
            List<PartyMemberCandidate> missingPartyMembers
    ) {
        CombatPanel {
            status = safe(status);
            cards = cards == null ? List.of() : List.copyOf(cards);
            missingPartyMembers = missingPartyMembers == null ? List.of() : List.copyOf(missingPartyMembers);
        }

        static CombatPanel empty() {
            return new CombatPanel(0, "", List.of(), false, List.of());
        }
    }

    record EnemyView(
            String name,
            long creatureId,
            long worldNpcId,
            String status,
            int xp,
            boolean defeatedByDefault,
            String loot,
            boolean selected
    ) {
        EnemyView {
            name = safe(name);
            creatureId = Math.max(0L, creatureId);
            worldNpcId = Math.max(0L, worldNpcId);
            status = safe(status);
            loot = safe(loot);
        }

        static EnemyView from(EncounterStateSnapshot.ResultEnemy enemy) {
            return new EnemyView(
                    enemy.displayName(),
                    enemy.creatureId(),
                    enemy.worldNpcId(),
                    enemy.statusLabel(),
                    enemy.xp(),
                    enemy.defeatedByDefault(),
                    enemy.loot(),
                    enemy.defeatedByDefault());
        }

        EnemyView withSelected(boolean nextSelected) {
            return new EnemyView(name, creatureId, worldNpcId, status, xp, defeatedByDefault, loot, nextSelected);
        }
    }

    record ResultsPanel(
            List<EnemyView> enemies,
            String subtitle,
            String xp,
            String party,
            String gold,
            String loot,
            String awardStatus,
            boolean awardButtonDisabled,
            double thresholdFraction,
            double xpFraction,
            String thresholdValue,
            String fractionValue
    ) {
        ResultsPanel {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            subtitle = safe(subtitle);
            xp = safe(xp);
            party = safe(party);
            gold = safe(gold);
            loot = safe(loot);
            awardStatus = safe(awardStatus);
            thresholdFraction = EncounterStateVocabulary.clampPercent(thresholdFraction);
            xpFraction = EncounterStateVocabulary.clampPercent(xpFraction);
            thresholdValue = safe(thresholdValue);
            fractionValue = safe(fractionValue);
        }

        static ResultsPanel empty() {
            return new ResultsPanel(
                    List.of(),
                    "0 Gegner besiegt | 0 XP",
                    "0 XP",
                    "",
                    "Kein Loot",
                    "",
                    "",
                    true,
                    1.0,
                    1.0,
                    "100%",
                    "100%");
        }
    }

    record ResultSelectionDraft(List<Boolean> selectedEnemies, double thresholdFraction, double xpFraction) {
        ResultSelectionDraft {
            selectedEnemies = selectedEnemies == null ? List.of() : List.copyOf(selectedEnemies);
            thresholdFraction = EncounterStateVocabulary.clampPercent(thresholdFraction);
            xpFraction = EncounterStateVocabulary.clampPercent(xpFraction);
        }

        static ResultSelectionDraft defaultDraft() {
            return new ResultSelectionDraft(List.of(), 1.0, 1.0);
        }
    }

    private record WorldNpcDefeatView(long worldNpcId, long expectedCreatureStatblockId) {
        WorldNpcDefeatView {
            worldNpcId = Math.max(0L, worldNpcId);
            expectedCreatureStatblockId = Math.max(0L, expectedCreatureStatblockId);
        }
    }
}
