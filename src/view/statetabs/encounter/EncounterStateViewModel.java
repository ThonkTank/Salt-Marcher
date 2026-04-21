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
import src.domain.encounter.published.EncounterLock;
import src.domain.encounter.published.GenerateEncounterCommand;
import src.domain.encounter.published.GeneratedEncounter;
import src.domain.encounter.published.LoadEncounterBudgetQuery;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.LoadActivePartyQuery;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.view.slotcontent.state.encounter.EncounterCombatRuntimeDisplayModel;

public final class EncounterStateViewModel {

    private static final int MAX_CREATURES_PER_SLOT = 20;

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    private final EncounterApplicationService encounter;
    private final CreaturesApplicationService creatures;
    private final PartyApplicationService party;
    private final List<PartyMember> activeParty = new ArrayList<>();
    private final List<EncounterCreature> roster = new ArrayList<>();
    private final List<GeneratedEncounter> generatedAlternatives = new ArrayList<>();
    private final List<EncounterLock> lockedCreatures = new ArrayList<>();
    private final List<Long> excludedCreatureIds = new ArrayList<>();
    private final List<InitiativeEntry> pendingInitiativeRows = new ArrayList<>();
    private final EncounterCombatRuntimeDisplayModel combatRuntime = new EncounterCombatRuntimeDisplayModel();
    private final ReadOnlyObjectWrapper<Mode> mode = new ReadOnlyObjectWrapper<>(Mode.BUILDER);
    private final ReadOnlyObjectWrapper<BuilderState> builderState =
            new ReadOnlyObjectWrapper<>();
    private final ReadOnlyObjectWrapper<InitiativeState> initiativeState =
            new ReadOnlyObjectWrapper<>(InitiativeState.empty());
    private final ReadOnlyObjectWrapper<CombatState> combatState =
            new ReadOnlyObjectWrapper<>(CombatState.empty());
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
    private long nextUndoToken;
    private long nextGenerationSeed;
    private int currentTurnIndex;
    private int round = 1;

    EncounterStateViewModel(
            EncounterApplicationService encounter,
            CreaturesApplicationService creatures,
            PartyApplicationService party
    ) {
        this.encounter = java.util.Objects.requireNonNull(encounter, "encounter");
        this.creatures = java.util.Objects.requireNonNull(creatures, "creatures");
        this.party = java.util.Objects.requireNonNull(party, "party");
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

    ReadOnlyObjectProperty<CombatState> combatStateProperty() {
        return combatState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<ResultState> resultStateProperty() {
        return resultState.getReadOnlyProperty();
    }

    ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    void refreshPartyContext() {
        loadActiveParty();
        loadBudget();
        refreshBuilderState(lastSettings, contextMessage());
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
        clearPendingUndo();
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
                List.copyOf(excludedCreatureIds),
                List.copyOf(lockedCreatures)));
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

    void reroll(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            EncounterDifficultyBand difficulty,
            EncounterGenerationTuning tuning,
            List<Long> encounterTableIds
    ) {
        generate(lastSettings, types, subtypes, biomes, difficulty, tuning, encounterTableIds);
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
        clearPendingUndo();
        clearGeneratedContext();
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
                clearPendingUndo();
                clearGeneratedContext();
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
                clearPendingUndo();
                clearGeneratedContext();
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
                clearGeneratedContext();
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
        clearGeneratedContext();
        int index = Math.max(0, Math.min(removed.index(), roster.size()));
        roster.add(index, removed.creature());
        pendingUndo = null;
        status.set(removed.creature().name() + " wurde wiederhergestellt.");
        refreshBuilderState(lastSettings, "");
    }

    void lockCurrentRoster() {
        if (roster.isEmpty()) {
            status.set("Lock braucht mindestens eine Kreatur im Roster.");
            return;
        }
        lockedCreatures.clear();
        for (EncounterCreature creature : roster) {
            lockedCreatures.add(new EncounterLock(creature.creatureId(), creature.count()));
        }
        clearPendingUndo();
        status.set("Aktuelle Komposition fuer kommende Rerolls gesperrt.");
        refreshBuilderState(lastSettings, "");
    }

    void excludeCurrentRoster(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            EncounterDifficultyBand difficulty,
            EncounterGenerationTuning tuning,
            List<Long> encounterTableIds
    ) {
        if (roster.isEmpty()) {
            status.set("Exclude braucht mindestens eine Kreatur im Roster.");
            return;
        }
        for (EncounterCreature creature : roster) {
            if (!excludedCreatureIds.contains(creature.creatureId())) {
                excludedCreatureIds.add(creature.creatureId());
            }
        }
        lockedCreatures.clear();
        clearPendingUndo();
        generate(lastSettings, types, subtypes, biomes, difficulty, tuning, encounterTableIds);
        if (!excludedCreatureIds.isEmpty()) {
            status.set(status.get() + " Exclusions aktiv: " + excludedCreatureIds.size() + ".");
        }
    }

    void clearConstraints() {
        if (lockedCreatures.isEmpty() && excludedCreatureIds.isEmpty()) {
            status.set("Keine Generator-Constraints aktiv.");
            return;
        }
        lockedCreatures.clear();
        excludedCreatureIds.clear();
        clearPendingUndo();
        status.set("Generator-Constraints geloescht.");
        refreshBuilderState(lastSettings, "");
    }

    void clearRoster() {
        clearGeneratedContext();
        clearPendingUndo();
        roster.clear();
        status.set("Encounter-Roster geleert.");
        refreshBuilderState(BuilderSettings.defaultSettings(), "");
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

    void endCombat() {
        List<ResultEnemy> enemies = combatRuntime.resultEnemies().stream()
                .map(enemy -> new ResultEnemy(
                        enemy.name(),
                        enemy.status(),
                        enemy.hpLoss(),
                        enemy.xp(),
                        enemy.defeatedByDefault(),
                        enemy.loot()))
                .toList();
        int eligibleXp = enemies.stream()
                .filter(ResultEnemy::defeatedByDefault)
                .mapToInt(ResultEnemy::xp)
                .sum();
        int partySize = Math.max(1, activeParty.size());
        resultState.set(new ResultState(
                enemies,
                enemies.stream().filter(ResultEnemy::defeatedByDefault).count(),
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

    private String contextMessage() {
        if (activeParty.isEmpty()) {
            return "Bitte zuerst aktive Party-Mitglieder anlegen.";
        }
        return "";
    }

    private void refreshBuilderState(BuilderSettings settings, String message) {
        builderState.set(builderState(settings, message));
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
                settings == null ? BuilderSettings.defaultSettings() : settings,
                !roster.isEmpty() && !activeParty.isEmpty(),
                generatedAlternatives.size() > 1,
                generatedAlternatives.size() > 1,
                !activeParty.isEmpty(),
                !roster.isEmpty(),
                !roster.isEmpty(),
                !lockedCreatures.isEmpty() || !excludedCreatureIds.isEmpty(),
                constraintsLabel(),
                pendingUndo,
                message == null ? "" : message);
    }

    private String constraintsLabel() {
        if (lockedCreatures.isEmpty() && excludedCreatureIds.isEmpty()) {
            return "";
        }
        List<String> labels = new ArrayList<>();
        if (!lockedCreatures.isEmpty()) {
            labels.add("Locks " + lockedCreatures.size());
        }
        if (!excludedCreatureIds.isEmpty()) {
            labels.add("Excluded " + excludedCreatureIds.size());
        }
        return String.join(" | ", labels);
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
        List<CombatCard> cards = projection.cards().stream()
                .map(card -> new CombatCard(
                        card.id(),
                        card.name(),
                        card.playerCharacter(),
                        card.active(),
                        card.alive(),
                        card.currentHp(),
                        card.maxHp(),
                        card.armorClass(),
                        card.initiative(),
                        card.count(),
                        card.detail()))
                .toList();
        combatState.set(new CombatState(
                projection.round(),
                projection.status(),
                cards,
                projection.allEnemiesDefeated()));
    }

    private @Nullable CreatureDetail loadCreature(long creatureId) {
        CreatureDetailResult result = creatures.loadCreatureDetail(new LoadCreatureDetailQuery(creatureId));
        if (result.status() != CreatureLookupStatus.SUCCESS) {
            return null;
        }
        return result.detail();
    }

    private void clearGeneratedContext() {
        generatedAlternatives.clear();
        selectedAlternativeIndex = 0;
        generatedAdjustedXp = 0;
        generatedDifficulty = "";
        generatedTitle = "";
    }

    private void clearPendingUndo() {
        pendingUndo = null;
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
            BuilderSettings settings,
            boolean canStartCombat,
            boolean canPreviousAlternative,
            boolean canNextAlternative,
            boolean canReroll,
            boolean canLockCurrent,
            boolean canExcludeCurrent,
            boolean canClearConstraints,
            String constraintsLabel,
            @Nullable RemovedRosterEntry pendingUndo,
            String message
    ) {
        public BuilderState {
            party = party == null ? List.of() : List.copyOf(party);
            roster = roster == null ? List.of() : List.copyOf(roster);
            templateLabel = templateLabel == null ? "" : templateLabel;
            constraintsLabel = constraintsLabel == null ? "" : constraintsLabel;
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

    public record CombatCard(
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
    }

    public record CombatState(
            int round,
            String status,
            List<CombatCard> cards,
            boolean allEnemiesDefeated
    ) {
        public CombatState {
            cards = cards == null ? List.of() : List.copyOf(cards);
        }

        static CombatState empty() {
            return new CombatState(1, "", List.of(), false);
        }
    }

    public record ResultEnemy(
            String name,
            String status,
            int hpLoss,
            int xp,
            boolean defeatedByDefault,
            String loot
    ) {
    }

    public record ResultState(
            List<ResultEnemy> enemies,
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

        ResultState withAwardStatus(String text, boolean awarded) {
            return new ResultState(
                    enemies,
                    defeatedCount,
                    eligibleXp,
                    perPlayerXp,
                    goldSummary,
                    lootDetail,
                    text,
                    awarded,
                    !awarded && canAwardXp,
                    partySize);
        }
    }

}
