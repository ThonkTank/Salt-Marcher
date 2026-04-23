package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.LoadCreatureDetailQuery;
import src.domain.encounter.EncounterApplicationService;
import src.domain.encounter.published.EncounterBudgetResult;
import src.domain.encounter.published.EncounterBudgetSummary;
import src.domain.encounter.published.EncounterDifficultyBand;
import src.domain.encounter.published.EncounterGenerationAdvisory;
import src.domain.encounter.published.EncounterGenerationDiagnostics;
import src.domain.encounter.published.EncounterGenerationTuning;
import src.domain.encounter.published.EncounterGenerationResult;
import src.domain.encounter.published.EncounterGenerationStatus;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.published.LoadEncounterBudgetQuery;
import src.domain.encounter.published.ListSavedEncounterPlansQuery;
import src.domain.encounter.published.LoadSavedEncounterPlanQuery;
import src.domain.encounter.published.SaveEncounterPlanCommand;
import src.domain.encounter.published.SavedEncounterPlan;
import src.domain.encounter.published.SavedEncounterPlanCreature;
import src.domain.encounter.published.SavedEncounterPlanListResult;
import src.domain.encounter.published.SavedEncounterPlanResult;
import src.domain.encounter.published.SavedEncounterPlanStatus;
import src.domain.encounter.published.SavedEncounterPlanSummary;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.view.slotcontent.state.encounter.EncounterCombatRuntimeDisplayModel;
import src.view.slotcontent.state.encounter.EncounterCombatRuntimeDisplayModel.CombatCardSnapshot;
import src.view.slotcontent.state.encounter.EncounterCombatRuntimeDisplayModel.CombatProjection;
import src.view.slotcontent.state.encounter.EncounterCombatRuntimeDisplayModel.ResultEnemySnapshot;

public final class EncounterStateViewModel {

    private static final int MAX_CREATURES_PER_SLOT = 20;

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    private final EncounterApplicationService encounter;
    private final EncounterApplicationService savedEncounters;
    private final CreaturesApplicationService creatures;
    private final PartyApplicationService party;
    private final List<PartyMember> activeParty = new ArrayList<>();
    private final List<EncounterCreature> roster = new ArrayList<>();
    private final List<GeneratedEncounter> generatedAlternatives = new ArrayList<>();
    private final List<SavedEncounterPlanSummary> savedPlans = new ArrayList<>();
    private final List<InitiativeEntry> pendingInitiativeRows = new ArrayList<>();
    private final EncounterCombatRuntimeDisplayModel combatRuntime = new EncounterCombatRuntimeDisplayModel();
    private final ReadOnlyObjectWrapper<Mode> mode = new ReadOnlyObjectWrapper<>(Mode.BUILDER);
    private final ReadOnlyObjectWrapper<BuilderState> builderState =
            new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<InitiativeState> initiativeState =
            new ReadOnlyObjectWrapper<>(InitiativeState.empty());
    private final ReadOnlyObjectWrapper<CombatProjection> combatState =
            new ReadOnlyObjectWrapper<>(CombatProjection.empty());
    private final ReadOnlyObjectWrapper<ResultState> resultState =
            new ReadOnlyObjectWrapper<>(ResultState.empty());
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper("Encounter bereit.");

    private @Nullable EncounterBudgetSummary budget;
    private BuilderSettings lastSettings = BuilderSettings.defaultSettings();
    private int selectedAlternativeIndex;
    private int generatedAdjustedXp;
    private String generatedDifficulty = "";
    private String generatedTitle = "";
    private @Nullable RemovedRosterEntry pendingUndo;
    private long activeSavedPlanId;
    private long nextUndoToken;
    private long nextGenerationSeed;
    private int currentTurnIndex;
    private int round = 1;

    EncounterStateViewModel(
            EncounterApplicationService encounter,
            EncounterApplicationService savedEncounters,
            CreaturesApplicationService creatures,
            PartyApplicationService party
    ) {
        this.encounter = java.util.Objects.requireNonNull(encounter, "encounter");
        this.savedEncounters = java.util.Objects.requireNonNull(savedEncounters, "savedEncounters");
        this.creatures = java.util.Objects.requireNonNull(creatures, "creatures");
        this.party = java.util.Objects.requireNonNull(party, "party");
        refreshSavedPlans("");
        refreshPartyContext();
    }

    ReadOnlyObjectProperty<Mode> modeProperty() {
        return mode.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<BuilderState> builderStateProperty() {
        return builderState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<InitiativeState> initiativeStateProperty() {
        return initiativeState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<CombatProjection> combatStateProperty() {
        return combatState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ResultState> resultStateProperty() {
        return resultState.getReadOnlyProperty();
    }

    ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    List<PartyMember> missingCombatPartyMembers() {
        List<String> activePcIds = combatState.get().cards().stream()
                .filter(CombatCardSnapshot::playerCharacter)
                .map(CombatCardSnapshot::id)
                .toList();
        return activeParty.stream()
                .filter(member -> !activePcIds.contains(member.id()))
                .toList();
    }

    void refreshPartyContext() {
        loadActiveParty();
        loadBudget();
        refreshBuilderState(
                lastSettings,
                activeParty.isEmpty() ? "Bitte zuerst aktive Party-Mitglieder anlegen." : "");
    }

    void generate(
            BuilderSettings settings,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            EncounterDifficultyBand difficulty,
            EncounterGenerationTuning tuning,
            List<Long> encounterTableIds
    ) {
        lastSettings = settings == null ? BuilderSettings.defaultSettings() : settings;
        List<String> effectiveTypes = safeStrings(types);
        List<String> effectiveSubtypes = safeStrings(subtypes);
        List<String> effectiveBiomes = safeStrings(biomes);
        EncounterDifficultyBand effectiveDifficulty =
                difficulty == null ? EncounterDifficultyBand.autoBand() : difficulty;
        pendingUndo = null;
        activeSavedPlanId = 0L;
        refreshPartyContext();
        if (activeParty.isEmpty()) {
            status.set("Die aktive Party hat keine Mitglieder.");
            refreshBuilderState(lastSettings, "Bitte zuerst aktive Party-Mitglieder anlegen.");
            return;
        }
        EncounterGenerationResult result = encounter.generate(new GenerateEncounterCommand(
                effectiveTypes,
                effectiveSubtypes,
                effectiveBiomes,
                effectiveDifficulty,
                5,
                tuning == null ? EncounterGenerationTuning.autoTuning() : tuning,
                nextGenerationSeed(),
                safeIds(encounterTableIds),
                List.of(),
                List.of()));
        if (result.status() != EncounterGenerationStatus.SUCCESS || result.encounters().isEmpty()) {
            generatedAlternatives.clear();
            selectedAlternativeIndex = 0;
            status.set(result.message().isBlank() ? generationStatusText(result.status()) : result.message());
            refreshBuilderState(lastSettings, status.get());
            return;
        }
        generatedAlternatives.clear();
        generatedAlternatives.addAll(result.encounters());
        selectedAlternativeIndex = 0;
        applyGeneratedEncounter(generatedAlternatives.getFirst());
        status.set(generationSuccessText(result));
    }

    void saveCurrentPlan() {
        if (roster.isEmpty()) {
            status.set("Speichern braucht mindestens eine Kreatur im Encounter.");
            refreshBuilderState(lastSettings, status.get());
            return;
        }
        SavedEncounterPlanResult result = savedEncounters.savePlan(new SaveEncounterPlanCommand(
                activeSavedPlanId <= 0L ? null : activeSavedPlanId,
                saveName(),
                generatedTitle,
                roster.stream()
                        .map(creature -> new SavedEncounterPlanCreature(creature.creatureId(), creature.count()))
                        .toList()));
        if (result.status() != SavedEncounterPlanStatus.SUCCESS || result.plan() == null) {
            status.set(result.message().isBlank() ? "Encounter konnte nicht gespeichert werden." : result.message());
            refreshSavedPlans(status.get());
            return;
        }
        activeSavedPlanId = result.plan().id();
        status.set(result.plan().name() + " gespeichert.");
        refreshSavedPlans(status.get());
    }

    void openSavedPlan(long planId) {
        SavedEncounterPlanResult result = savedEncounters.loadPlan(new LoadSavedEncounterPlanQuery(planId));
        SavedEncounterPlan plan = result.plan();
        if (result.status() != SavedEncounterPlanStatus.SUCCESS || plan == null) {
            status.set(result.message().isBlank() ? "Encounter konnte nicht geoeffnet werden." : result.message());
            refreshSavedPlans(status.get());
            return;
        }
        roster.clear();
        for (SavedEncounterPlanCreature creature : plan.creatures()) {
            CreatureDetail detail = loadCreature(creature.creatureId());
            if (detail != null) {
                roster.add(fromDetail(detail, creature.quantity(), "Saved", List.of()));
            }
        }
        generatedAlternatives.clear();
        pendingInitiativeRows.clear();
        combatRuntime.clear();
        resultState.set(ResultState.empty());
        combatState.set(CombatProjection.empty());
        initiativeState.set(InitiativeState.empty());
        selectedAlternativeIndex = 0;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = plan.generatedLabel().isBlank() ? plan.name() : plan.generatedLabel();
        pendingUndo = null;
        activeSavedPlanId = plan.id();
        round = 1;
        currentTurnIndex = 0;
        mode.set(Mode.BUILDER);
        status.set(plan.name() + " geoeffnet.");
        refreshSavedPlans(status.get());
    }

    void shiftGeneratedAlternative(int delta) {
        if (generatedAlternatives.isEmpty()) {
            return;
        }
        selectedAlternativeIndex = Math.floorMod(
                selectedAlternativeIndex + delta,
                generatedAlternatives.size());
        applyGeneratedEncounter(generatedAlternatives.get(selectedAlternativeIndex));
    }

    void addCreature(long creatureId) {
        CreatureDetail detail = loadCreature(creatureId);
        if (detail == null) {
            status.set("Kreatur konnte nicht geladen werden.");
            return;
        }
        if (mode.get() == Mode.COMBAT) {
            String activeTurnId = combatRuntime.activeTurnId(currentTurnIndex);
            int initiative = 12 + Math.max(-3, Math.min(6, detail.initiativeBonus()));
            String displayName = combatRuntime.addMonsterReinforcement(
                    detail.name(),
                    detail.id(),
                    Math.max(1, detail.hitPoints()),
                    detail.armorClass(),
                    detail.xp(),
                    detail.challengeRating(),
                    detail.creatureType(),
                    "Reinforcement",
                    initiative);
            currentTurnIndex = combatRuntime.turnIndexOf(activeTurnId, currentTurnIndex);
            refreshCombatState();
            status.set(displayName + " betritt den laufenden Kampf.");
            return;
        }
        pendingUndo = null;
        activeSavedPlanId = 0L;
        generatedAlternatives.clear();
        selectedAlternativeIndex = 0;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreature existing = roster.get(index);
            if (existing.creatureId() == detail.id()) {
                roster.set(index, existing.withCount(existing.count() + 1, MAX_CREATURES_PER_SLOT));
                status.set(detail.name() + " wurde zum Encounter hinzugefuegt.");
                refreshBuilderState(lastSettings, "");
                return;
            }
        }
        roster.add(fromDetail(detail, 1, "Manual", List.of()));
        status.set(detail.name() + " wurde zum Encounter hinzugefuegt.");
        refreshBuilderState(lastSettings, "");
    }

    void incrementCreature(long creatureId) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreature creature = roster.get(index);
            if (creature.creatureId() == creatureId) {
                pendingUndo = null;
                activeSavedPlanId = 0L;
                generatedAlternatives.clear();
                selectedAlternativeIndex = 0;
                generatedAdjustedXp = 0;
                generatedDifficulty = "";
                generatedTitle = "";
                roster.set(index, creature.withCount(creature.count() + 1, MAX_CREATURES_PER_SLOT));
                status.set(creature.name() + " Anzahl angepasst.");
                refreshBuilderState(lastSettings, "");
                return;
            }
        }
    }

    void decrementCreature(long creatureId) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreature creature = roster.get(index);
            if (creature.creatureId() == creatureId) {
                if (creature.count() <= 1) {
                    status.set(creature.name() + " bleibt mindestens einmal im Roster.");
                    return;
                }
                pendingUndo = null;
                activeSavedPlanId = 0L;
                generatedAlternatives.clear();
                selectedAlternativeIndex = 0;
                generatedAdjustedXp = 0;
                generatedDifficulty = "";
                generatedTitle = "";
                roster.set(index, creature.withCount(creature.count() - 1, MAX_CREATURES_PER_SLOT));
                status.set(creature.name() + " Anzahl angepasst.");
                refreshBuilderState(lastSettings, "");
                return;
            }
        }
    }

    void removeCreature(long creatureId) {
        for (int index = 0; index < roster.size(); index++) {
            EncounterCreature creature = roster.get(index);
            if (creature.creatureId() == creatureId) {
                generatedAlternatives.clear();
                activeSavedPlanId = 0L;
                selectedAlternativeIndex = 0;
                generatedAdjustedXp = 0;
                generatedDifficulty = "";
                generatedTitle = "";
                roster.remove(index);
                pendingUndo = new RemovedRosterEntry(++nextUndoToken, index, creature);
                status.set(creature.name() + " wurde entfernt.");
                refreshBuilderState(lastSettings, "");
                return;
            }
        }
    }

    void undoRemove(long token) {
        RemovedRosterEntry removed = pendingUndo;
        if (removed == null || removed.token() != token) {
            return;
        }
        generatedAlternatives.clear();
        activeSavedPlanId = 0L;
        selectedAlternativeIndex = 0;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
        int index = Math.max(0, Math.min(removed.index(), roster.size()));
        roster.add(index, removed.creature());
        pendingUndo = null;
        status.set(removed.creature().name() + " wurde wiederhergestellt.");
        refreshBuilderState(lastSettings, "");
    }

    void openInitiative() {
        if (roster.isEmpty()) {
            status.set("Kampfstart braucht mindestens eine Kreatur.");
            return;
        }
        if (activeParty.isEmpty()) {
            loadActiveParty();
        }
        if (activeParty.isEmpty()) {
            status.set("Kampfstart braucht aktive Party-Mitglieder.");
            return;
        }
        pendingInitiativeRows.clear();
        for (int index = 0; index < activeParty.size(); index++) {
            PartyMember member = activeParty.get(index);
            pendingInitiativeRows.add(new InitiativeEntry(
                    member.id(),
                    member.name() + " (Lv. " + member.level() + ")",
                    "SC",
                    10 + index));
        }
        for (EncounterCreature creature : roster) {
            int rolled = 12 + Math.max(-3, Math.min(6, creature.initiativeBonus()));
            String label = creature.count() > 1
                    ? creature.name() + " x" + creature.count()
                    : creature.name();
            pendingInitiativeRows.add(new InitiativeEntry(
                    creature.id(),
                    label + " (" + signed(creature.initiativeBonus()) + ")",
                    "Monster",
                    rolled));
        }
        initiativeState.set(new InitiativeState(List.copyOf(pendingInitiativeRows)));
        mode.set(Mode.INITIATIVE);
        status.set("Initiativewerte pruefen und Kampf starten.");
    }

    void backToBuilder() {
        mode.set(Mode.BUILDER);
        status.set("Zurueck zur Encounter-Erstellung.");
    }

    void confirmInitiative(List<InitiativeInput> initiatives) {
        combatRuntime.clear();
        int fallbackIndex = 0;
        for (InitiativeInput input : safeInputs(initiatives)) {
            InitiativeEntry entry = initiativeEntry(input.id());
            int initiative = input.initiative();
            if (entry == null) {
                continue;
            }
            if ("SC".equals(entry.kind())) {
                fallbackIndex = combatRuntime.addPlayer(
                        entry.id(),
                        nameOnly(entry.label()),
                        initiative,
                        fallbackIndex);
            } else {
                EncounterCreature creature = creature(entry.id());
                if (creature != null) {
                    fallbackIndex = combatRuntime.addMonsters(
                            creature.id(),
                            creature.name(),
                            creature.creatureId(),
                            creature.count(),
                            creature.hp(),
                            creature.ac(),
                            creature.xp(),
                            creature.cr(),
                            creature.type(),
                            creature.role(),
                            initiative,
                            fallbackIndex);
                }
            }
        }
        combatRuntime.sort();
        currentTurnIndex = combatRuntime.hasTurnEntries() ? 0 : -1;
        round = 1;
        mode.set(Mode.COMBAT);
        refreshCombatState();
        status.set("Kampf laeuft. HP und Initiative sind lokal editierbar.");
    }

    void nextTurn() {
        var turn = combatRuntime.nextTurn(currentTurnIndex, round);
        currentTurnIndex = turn.currentTurnIndex();
        round = turn.round();
        refreshCombatState();
    }

    void setInitiative(String combatantId, int initiative) {
        combatRuntime.setInitiative(combatantId, initiative);
        refreshCombatState();
    }

    void addPartyMemberToCombat(long partyMemberId, int initiative) {
        if (mode.get() != Mode.COMBAT) {
            return;
        }
        PartyMember member = partyMember(partyMemberId);
        if (member == null) {
            status.set("SC konnte nicht geladen werden.");
            return;
        }
        String activeTurnId = combatRuntime.activeTurnId(currentTurnIndex);
        boolean added = combatRuntime.addPlayerToRunningCombat(member.id(), member.name(), initiative);
        currentTurnIndex = combatRuntime.turnIndexOf(activeTurnId, currentTurnIndex);
        refreshCombatState();
        status.set(added
                ? member.name() + " betritt den laufenden Kampf."
                : member.name() + " ist bereits im Kampf.");
    }

    void endCombat() {
        List<ResultEnemySnapshot> enemies = combatRuntime.resultEnemies();
        int eligibleXp = enemies.stream()
                .filter(ResultEnemySnapshot::defeatedByDefault)
                .mapToInt(ResultEnemySnapshot::xp)
                .sum();
        int partySize = Math.max(1, activeParty.size());
        resultState.set(new ResultState(
                enemies,
                enemies.stream().filter(ResultEnemySnapshot::defeatedByDefault).count(),
                eligibleXp,
                eligibleXp / partySize,
                "Kein Loot",
                "Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.",
                "",
                false,
                !activeParty.isEmpty(),
                partySize));
        mode.set(Mode.RESULTS);
        status.set("Kampfergebnis bereit.");
    }

    void awardXp() {
        ResultState current = resultState.get();
        if (current == null || current.xpAwarded() || current.perPlayerXp() <= 0 || activeParty.isEmpty()) {
            return;
        }
        MutationResult result = party.awardXp(new AwardPartyXpCommand(
                activeParty.stream().map(PartyMember::numericId).toList(),
                current.perPlayerXp()));
        boolean success = result != null && result.status() == MutationStatus.SUCCESS;
        resultState.set(current.withAwardStatus(
                success ? "XP an die aktive Party verteilt." : "XP konnte nicht verteilt werden.",
                success));
        if (success) {
            refreshPartyContext();
        }
    }

    void returnToBuilderAfterResults() {
        combatRuntime.clear();
        pendingInitiativeRows.clear();
        round = 1;
        currentTurnIndex = 0;
        mode.set(Mode.BUILDER);
        status.set("Kampf abgeschlossen. Neuer Encounter kann erstellt werden.");
    }

    private void applyGeneratedEncounter(GeneratedEncounter generated) {
        roster.clear();
        for (src.domain.encounter.published.EncounterCreature creature : generated.creatures()) {
            CreatureDetail detail = loadCreature(creature.creatureId());
            roster.add(detail == null
                    ? fromGeneratedFallback(creature)
                    : fromDetail(detail, creature.quantity(), creature.role(), creature.tags()));
        }
        generatedAdjustedXp = generated.adjustedXp();
        generatedDifficulty = difficultyLabel(generated.achievedDifficulty());
        generatedTitle = generated.title();
        refreshBuilderState(lastSettings, generated.highlights().isEmpty()
                ? "Encounter-Option " + (selectedAlternativeIndex + 1) + " von " + generatedAlternatives.size()
                : String.join(" ", generated.highlights()));
    }

    void mutateHp(String combatantId, int amount, boolean healing) {
        if (combatRuntime.mutateHp(combatantId, Math.max(0, amount), healing)) {
            refreshCombatState();
        }
    }

    private void loadActiveParty() {
        ActivePartyResult result = party.loadActiveParty(new LoadActivePartyQuery());
        activeParty.clear();
        if (result.status() != ReadStatus.SUCCESS) {
            return;
        }
        for (PartyMemberSummary member : result.members()) {
            if (member != null && member.id() != null) {
                activeParty.add(new PartyMember("pc-" + member.id(), member.id(), member.name(), member.level()));
            }
        }
    }

    private void loadBudget() {
        EncounterBudgetResult result = encounter.loadBudget(new LoadEncounterBudgetQuery());
        budget = result.status() == EncounterGenerationStatus.SUCCESS ? result.budget() : null;
    }

    private void refreshBuilderState(BuilderSettings settings, String message) {
        builderState.set(builderState(settings, message));
    }

    private void refreshSavedPlans(String message) {
        SavedEncounterPlanListResult result = savedEncounters.listPlans(new ListSavedEncounterPlansQuery());
        savedPlans.clear();
        if (result.status() == SavedEncounterPlanStatus.SUCCESS) {
            savedPlans.addAll(result.plans());
        } else if (!result.message().isBlank()) {
            status.set(result.message());
        }
        refreshBuilderState(lastSettings, message);
    }

    private BuilderState builderState(BuilderSettings settings, String message) {
        EncounterBudgetSummary currentBudget = budget;
        int adjustedXp = generatedAdjustedXp > 0 ? generatedAdjustedXp : roster.stream().mapToInt(EncounterCreature::totalXp).sum();
        DifficultySummary difficulty = currentBudget == null
                ? new DifficultySummary(0, 0, 0, 0, adjustedXp, roster.isEmpty() ? "" : "Keine Party")
                : new DifficultySummary(
                        currentBudget.easyXp(),
                        currentBudget.mediumXp(),
                        currentBudget.hardXp(),
                        currentBudget.deadlyXp(),
                        adjustedXp,
                        generatedDifficulty.isBlank() ? evaluateDifficulty(adjustedXp, currentBudget) : generatedDifficulty);
        return new BuilderState(
                List.copyOf(activeParty),
                List.copyOf(roster),
                titleLabel(),
                difficulty,
                List.copyOf(savedPlans),
                settings == null ? BuilderSettings.defaultSettings() : settings,
                !roster.isEmpty() && !activeParty.isEmpty(),
                generatedAlternatives.size() > 1,
                generatedAlternatives.size() > 1,
                !roster.isEmpty(),
                pendingUndo,
                message == null ? "" : message);
    }

    private String saveName() {
        if (!generatedTitle.isBlank()) {
            return generatedTitle;
        }
        return roster.isEmpty() ? "Encounter" : "Manuelles Encounter";
    }

    private String titleLabel() {
        if (generatedTitle.isBlank()) {
            return roster.isEmpty() ? "" : "Manuelles Encounter";
        }
        if (generatedAlternatives.size() <= 1) {
            return generatedTitle;
        }
        return generatedTitle + " (" + (selectedAlternativeIndex + 1) + "/" + generatedAlternatives.size() + ")";
    }

    private void refreshCombatState() {
        var projection = combatRuntime.combatProjection(currentTurnIndex, round);
        currentTurnIndex = projection.currentTurnIndex();
        combatState.set(projection);
    }

    private @Nullable CreatureDetail loadCreature(long creatureId) {
        CreatureDetailResult result = creatures.loadCreatureDetail(new LoadCreatureDetailQuery(creatureId));
        if (result.status() != CreatureLookupStatus.SUCCESS) {
            return null;
        }
        return result.detail();
    }

    private static EncounterCreature fromDetail(
            CreatureDetail detail,
            int quantity,
            String role,
            List<String> tags
    ) {
        return new EncounterCreature(
                "monster-" + detail.id(),
                detail.id(),
                detail.name(),
                detail.challengeRating(),
                detail.xp(),
                Math.max(1, detail.hitPoints()),
                detail.armorClass(),
                detail.initiativeBonus(),
                detail.creatureType(),
                role == null || role.isBlank() ? "Creature" : role,
                Math.max(1, quantity),
                tags);
    }

    private static EncounterCreature fromGeneratedFallback(src.domain.encounter.published.EncounterCreature creature) {
        return new EncounterCreature(
                "monster-" + creature.creatureId(),
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                1,
                10,
                0,
                "",
                creature.role(),
                creature.quantity(),
                creature.tags());
    }

    private static String evaluateDifficulty(int adjustedXp, EncounterBudgetSummary budget) {
        if (adjustedXp >= budget.deadlyXp()) {
            return "Deadly";
        }
        if (adjustedXp >= budget.hardXp()) {
            return "Hard";
        }
        if (adjustedXp >= budget.mediumXp()) {
            return "Medium";
        }
        return adjustedXp <= 0 ? "" : "Easy";
    }

    private static String difficultyLabel(EncounterDifficultyBand band) {
        return switch (band == null ? EncounterDifficultyBand.MEDIUM : band) {
            case AUTO -> "Auto";
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
            case DEADLY -> "Deadly";
        };
    }

    private String generationSuccessText(EncounterGenerationResult result) {
        StringBuilder text = new StringBuilder(generatedAlternatives.size() + " Encounter-Optionen generiert.");
        EncounterGenerationDiagnostics diagnostics = result.diagnostics();
        if (diagnostics != null) {
            text.append(" Ziel: ")
                    .append(difficultyLabel(diagnostics.resolvedDifficulty()))
                    .append(", Tuning: ")
                    .append(tuningLabel(diagnostics.resolvedTuning()))
                    .append('.');
        }
        if (result.advisories().contains(EncounterGenerationAdvisory.FALLBACK_USED)) {
            text.append(" Fallback verwendet.");
        }
        return text.toString();
    }

    private static String tuningLabel(EncounterGenerationTuning tuning) {
        EncounterGenerationTuning effective = tuning == null ? EncounterGenerationTuning.defaultTuning() : tuning;
        return "B" + effective.balanceLevel()
                + "/M" + Math.round(effective.amountValue())
                + "/D" + effective.diversityLevel();
    }

    private static String generationStatusText(EncounterGenerationStatus status) {
        return switch (status == null ? EncounterGenerationStatus.defaultFailure() : status) {
            case NO_ACTIVE_PARTY -> "Die aktive Party hat keine Mitglieder.";
            case NO_CREATURES -> "Keine Kreaturen passen zu diesen Filtern.";
            case NO_SOLUTION -> "Keine passende Encounter-Komposition gefunden.";
            case INVALID_REQUEST -> "Encounter-Filter sind ungueltig.";
            case STORAGE_ERROR -> "Encounter konnte nicht generiert werden.";
            case SUCCESS -> "Encounter generiert.";
        };
    }

    private @Nullable InitiativeEntry initiativeEntry(String id) {
        for (InitiativeEntry entry : pendingInitiativeRows) {
            if (entry.id().equals(id)) {
                return entry;
            }
        }
        return null;
    }

    private @Nullable EncounterCreature creature(String id) {
        for (EncounterCreature creature : roster) {
            if (creature.id().equals(id)) {
                return creature;
            }
        }
        return null;
    }

    private @Nullable PartyMember partyMember(long id) {
        for (PartyMember member : activeParty) {
            if (member.numericId() == id) {
                return member;
            }
        }
        return null;
    }

    private static List<InitiativeInput> safeInputs(List<InitiativeInput> initiatives) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    private static List<String> safeStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static List<Long> safeIds(List<Long> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String nameOnly(String label) {
        int detailStart = label.indexOf(" (");
        return detailStart < 0 ? label : label.substring(0, detailStart);
    }

    private static String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
    }

    private long nextGenerationSeed() {
        nextGenerationSeed += 1L;
        return nextGenerationSeed;
    }

    public record BuilderSettings(
            String difficultyLabel,
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        public static BuilderSettings defaultSettings() {
            return new BuilderSettings("Auto", -1, -1.0, -1);
        }
    }

    public record PartyMember(String id, long numericId, String name, int level) {
    }

    public record EncounterCreature(
            String id,
            long creatureId,
            String name,
            String cr,
            int xp,
            int hp,
            int ac,
            int initiativeBonus,
            String type,
            String role,
            int count,
            List<String> tags
    ) {
        public EncounterCreature {
            count = Math.max(1, count);
            tags = tags == null ? List.of() : List.copyOf(tags);
        }

        int totalXp() {
            return xp * count;
        }

        EncounterCreature withCount(int nextCount, int maxCount) {
            return new EncounterCreature(
                    id,
                    creatureId,
                    name,
                    cr,
                    xp,
                    hp,
                    ac,
                    initiativeBonus,
                    type,
                    role,
                    Math.max(1, Math.min(maxCount, nextCount)),
                    tags);
        }
    }

    public record RemovedRosterEntry(long token, int index, EncounterCreature creature) {
    }

    public record DifficultySummary(
            int easy,
            int medium,
            int hard,
            int deadly,
            int adjustedXp,
            String difficulty
    ) {
    }

    public record BuilderState(
            List<PartyMember> party,
            List<EncounterCreature> roster,
            String templateLabel,
            DifficultySummary difficulty,
            List<SavedEncounterPlanSummary> savedPlans,
            BuilderSettings settings,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canSavePlan,
            @Nullable RemovedRosterEntry pendingUndo,
            String message
    ) {
        public BuilderState {
            party = party == null ? List.of() : List.copyOf(party);
            roster = roster == null ? List.of() : List.copyOf(roster);
            savedPlans = savedPlans == null ? List.of() : List.copyOf(savedPlans);
            templateLabel = templateLabel == null ? "" : templateLabel;
            message = message == null ? "" : message;
        }
    }

    public record InitiativeEntry(String id, String label, String kind, int initiative) {
    }

    public record InitiativeInput(String id, int initiative) {
    }

    public record InitiativeState(List<InitiativeEntry> entries) {
        public InitiativeState {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }

        static InitiativeState empty() {
            return new InitiativeState(List.of());
        }
    }

    public record ResultState(
            List<ResultEnemySnapshot> enemies,
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
        public ResultState {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
            partySize = Math.max(1, partySize);
        }

        static ResultState empty() {
            return new ResultState(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false, 1);
        }

        @SuppressWarnings("ParameterName")
        ResultState withAwardStatus(String awardStatus, boolean awarded) {
            return new ResultState(
                    enemies,
                    defeatedCount,
                    eligibleXp,
                    perPlayerXp,
                    goldSummary,
                    lootDetail,
                    awardStatus,
                    awarded,
                    !awarded && canAwardXp,
                    partySize);
        }
    }

}
