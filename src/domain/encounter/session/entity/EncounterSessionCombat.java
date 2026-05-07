package src.domain.encounter.session.entity;

import static src.domain.encounter.session.value.EncounterSessionValues.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.session.service.CombatRosterBuilderService;
import src.domain.encounter.session.service.CombatRosterMutationService;
import src.domain.encounter.session.service.CombatTurnService;

final class EncounterSessionCombat {

    private static final String REINFORCEMENT_CREATURE_ROLE = "Reinforcement";
    private static final String NO_LOOT = "Kein Loot";
    private static final String OPEN_INITIATIVE_NEEDS_CREATURE_STATUS = "Kampfstart braucht mindestens eine Kreatur.";
    private static final String OPEN_INITIATIVE_NEEDS_PARTY_STATUS = "Kampfstart braucht aktive Party-Mitglieder.";
    private static final String INITIATIVE_READY_STATUS = "Initiativewerte pruefen und Kampf starten.";
    private static final String COMBAT_RUNNING_STATUS = "Kampf laeuft. HP und Initiative sind lokal editierbar.";
    private static final String PARTY_MEMBER_LOAD_FAILURE_STATUS = "SC konnte nicht geladen werden.";
    private static final String RESULTS_READY_STATUS = "Kampfergebnis bereit.";
    private static final String XP_AWARDED_STATUS = "XP an die aktive Party verteilt.";
    private static final String XP_AWARD_FAILED_STATUS = "XP konnte nicht verteilt werden.";
    private static final String RETURNED_TO_BUILDER_STATUS = "Kampfergebnis geschlossen. Combat Planner bereit.";
    private static final int FIRST_COMBAT_ROUND = 1;
    private static final int MINIMUM_PARTY_SIZE = 1;
    private static final int MULTIPLE_CREATURE_THRESHOLD = 1;

    private final List<InitiativeEntryData> pendingInitiativeRows = new ArrayList<>();
    private final CombatRoster combatRoster = new CombatRoster();
    private final CombatRosterBuilderService combatRosterBuilder = new CombatRosterBuilderService();
    private final CombatRosterMutationService combatRosterMutations = new CombatRosterMutationService();
    private final CombatTurnService combatTurns = new CombatTurnService();
    private ResultStateData resultState = ResultStateData.empty();
    private OptionalInt currentTurnIndex = OptionalInt.empty();
    private int round = FIRST_COMBAT_ROUND;

    void resetForLoadedPlan() {
        pendingInitiativeRows.clear();
        combatRoster.clear();
        resultState = ResultStateData.empty();
        currentTurnIndex = OptionalInt.empty();
        round = FIRST_COMBAT_ROUND;
    }

    void openInitiative(EncounterSessionContext context, List<EncounterCreatureData> roster) {
        if (roster.isEmpty()) {
            context.setStatus(OPEN_INITIATIVE_NEEDS_CREATURE_STATUS);
            return;
        }
        if (!context.hasActiveParty()) {
            context.setStatus(OPEN_INITIATIVE_NEEDS_PARTY_STATUS);
            return;
        }
        pendingInitiativeRows.clear();
        List<PartyMemberData> activeParty = context.activeParty();
        for (int index = 0; index < activeParty.size(); index++) {
            PartyMemberData member = activeParty.get(index);
            pendingInitiativeRows.add(new InitiativeEntryData(
                    member.id(),
                    member.name() + " (Lv. " + member.level() + ")",
                    CombatantKind.PLAYER_CHARACTER,
                    CombatRosterBuilderService.defaultPlayerInitiative(index)));
        }
        for (EncounterCreatureData creature : roster) {
            int rolled = CombatRosterBuilderService.defaultMonsterInitiative(creature.initiativeBonus());
            String label = creature.count() > MULTIPLE_CREATURE_THRESHOLD
                    ? creature.name() + " x" + creature.count()
                    : creature.name();
            pendingInitiativeRows.add(new InitiativeEntryData(
                    creature.id(),
                    label + " (" + signed(creature.initiativeBonus()) + ")",
                    CombatantKind.MONSTER,
                    rolled));
        }
        context.enterInitiative(INITIATIVE_READY_STATUS);
    }

    void confirmInitiative(List<InitiativeInput> initiatives, List<EncounterCreatureData> roster, EncounterSessionContext context) {
        combatRoster.clear();
        int fallbackIndex = 0;
        for (InitiativeInput input : safeInitiatives(initiatives)) {
            InitiativeEntryData entry = initiativeEntry(input.id()).orElse(null);
            if (entry == null) {
                continue;
            }
            if (entry.kind() == CombatantKind.PLAYER_CHARACTER) {
                fallbackIndex = combatRosterBuilder.addPlayer(
                        combatRoster,
                        entry.id(),
                        nameOnly(entry.label()),
                        input.initiative(),
                        fallbackIndex);
                continue;
            }
            EncounterCreatureData creature = rosterCreature(roster, entry.id()).orElse(null);
            if (creature == null) {
                continue;
            }
            fallbackIndex = combatRosterBuilder.addMonsters(combatRoster, creature, input.initiative(), fallbackIndex);
        }
        combatRoster.sort();
        currentTurnIndex = combatTurns.hasTurnEntries(combatRoster.combatants())
                ? OptionalInt.of(CombatTurnService.FIRST_TURN_INDEX)
                : OptionalInt.empty();
        round = FIRST_COMBAT_ROUND;
        context.enterCombat(COMBAT_RUNNING_STATUS);
    }

    void advanceTurn() {
        CombatTurnService.TurnAdvance turn = combatTurns.nextTurn(
                combatRoster.combatants(),
                currentTurnIndex.orElse(CombatTurnService.NO_ACTIVE_TURN_INDEX),
                round);
        currentTurnIndex = toOptionalTurnIndex(turn.currentTurnIndex());
        round = turn.round();
    }

    void adjustInitiative(String combatantId, int initiative) {
        combatRosterMutations.updateInitiative(
                combatRoster,
                combatTurns.turnEntry(combatRoster.combatants(), combatantId),
                initiative);
    }

    void addPartyMemberToCombat(
            long partyMemberId,
            int initiative,
            List<PartyMemberData> activeParty,
            EncounterSessionContext context
    ) {
        if (!context.isCombatMode()) {
            return;
        }
        PartyMemberData member = partyMember(activeParty, partyMemberId).orElse(null);
        if (member == null) {
            context.setStatus(PARTY_MEMBER_LOAD_FAILURE_STATUS);
            return;
        }
        String activeTurnId = activeTurnId();
        boolean added = combatRosterBuilder.addPlayerToRunningCombat(combatRoster, member.id(), member.name(), initiative);
        restoreTurnIndex(activeTurnId);
        context.setStatus(added
                ? member.name() + " betritt den laufenden Kampf."
                : member.name() + " ist bereits im Kampf.");
    }

    void addReinforcement(CreatureDetailData creature, EncounterSessionContext context) {
        String activeTurnId = activeTurnId();
        String displayName = combatRosterBuilder.addReinforcement(
                combatRoster,
                creature,
                REINFORCEMENT_CREATURE_ROLE,
                CombatRosterBuilderService.defaultMonsterInitiative(creature.initiativeBonus()));
        restoreTurnIndex(activeTurnId);
        context.setStatus(displayName + " betritt den laufenden Kampf.");
    }

    void endCombat(int activePartySize, boolean hasActiveParty, EncounterSessionContext context) {
        List<ResultEnemyData> enemies = combatRosterMutations.resultEnemies(combatRoster);
        int eligibleXp = enemies.stream()
                .filter(ResultEnemyData::defeatedByDefault)
                .mapToInt(ResultEnemyData::xp)
                .sum();
        int partySize = Math.max(MINIMUM_PARTY_SIZE, activePartySize);
        resultState = new ResultStateData(
                enemies,
                enemies.stream().filter(ResultEnemyData::defeatedByDefault).count(),
                eligibleXp,
                eligibleXp / partySize,
                NO_LOOT,
                "Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.",
                "",
                false,
                hasActiveParty,
                partySize);
        context.enterResults(RESULTS_READY_STATUS);
    }

    void awardXp(EncounterSession.RuntimeAccess access, EncounterSessionContext context) {
        if (resultState.xpAwarded() || resultState.perPlayerXp() <= 0 || !context.hasActiveParty()) {
            return;
        }
        AwardXpOutcome outcome = access.awardXp(context.activePartyIds(), resultState.perPlayerXp());
        resultState = resultState.withAwardStatus(
                outcome.success() ? XP_AWARDED_STATUS : XP_AWARD_FAILED_STATUS,
                outcome.success());
        if (outcome.success()) {
            context.refreshPartyAndBudget(access);
        }
    }

    void returnToBuilder(EncounterSessionContext context) {
        combatRoster.clear();
        pendingInitiativeRows.clear();
        resultState = ResultStateData.empty();
        currentTurnIndex = OptionalInt.empty();
        round = FIRST_COMBAT_ROUND;
        context.enterBuilder(RETURNED_TO_BUILDER_STATUS);
    }

    void mutateHp(String combatantId, int amount, boolean healing) {
        if (!combatRosterMutations.mutateHp(
                combatRoster,
                combatTurns.turnEntry(combatRoster.combatants(), combatantId),
                Math.max(0, amount),
                healing)) {
            return;
        }
        restoreTurnIndex(activeTurnId());
    }

    List<InitiativeEntryData> initiativeEntries() {
        return List.copyOf(pendingInitiativeRows);
    }

    CombatProjectionData combatProjection() {
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

    List<PartyMemberData> missingCombatPartyMembers(List<PartyMemberData> activeParty, CombatProjectionData projection) {
        List<String> activePcIds = projection.cards().stream()
                .filter(CombatCardData::playerCharacter)
                .map(CombatCardData::id)
                .toList();
        return activeParty.stream()
                .filter(member -> !activePcIds.contains(member.id()))
                .toList();
    }

    ResultStateData resultState() {
        return resultState;
    }

    private @Nullable String activeTurnId() {
        return combatTurns.activeTurnId(combatRoster.combatants(), currentTurnIndex.orElse(CombatTurnService.NO_ACTIVE_TURN_INDEX));
    }

    private void restoreTurnIndex(@Nullable String activeTurnId) {
        currentTurnIndex = toOptionalTurnIndex(combatTurns.turnIndexOf(
                combatRoster.combatants(),
                activeTurnId,
                currentTurnIndex.orElse(CombatTurnService.NO_ACTIVE_TURN_INDEX)));
    }

    private Optional<InitiativeEntryData> initiativeEntry(String id) {
        return pendingInitiativeRows.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private static Optional<EncounterCreatureData> rosterCreature(List<EncounterCreatureData> roster, String id) {
        return roster.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private static Optional<PartyMemberData> partyMember(List<PartyMemberData> activeParty, long id) {
        return activeParty.stream()
                .filter(entry -> entry.numericId() == id)
                .findFirst();
    }

    private static OptionalInt toOptionalTurnIndex(int turnIndex) {
        return turnIndex < 0 ? OptionalInt.empty() : OptionalInt.of(turnIndex);
    }

    private static List<InitiativeInput> safeInitiatives(List<InitiativeInput> initiatives) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }
    private static String nameOnly(String label) {
        int detailStart = label.indexOf(" (");
        return detailStart < 0 ? label : label.substring(0, detailStart);
    }

    private static String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
    }
}
