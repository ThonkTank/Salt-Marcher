package src.domain.encounter.session.service;

import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import src.domain.encounter.session.entity.CombatRuntime;
import src.domain.encounter.session.entity.EncounterSessionRuntimeData;
import src.domain.encounter.session.entity.EncounterSessionState;
import src.domain.encounter.session.entity.EncounterSessionViewState;

public final class EncounterSessionCombatService {

    private static final int FIRST_COMBAT_ROUND = 1;
    private static final String NO_LOOT = "Kein Loot";

    private EncounterSessionCombatService() {
    }

    public static void openInitiative(EncounterSessionState state) {
        if (state.builder().roster().isEmpty()) {
            state.context().setStatus("Kampfstart braucht mindestens eine Kreatur.");
            return;
        }
        if (state.context().activeParty().isEmpty()) {
            state.context().setStatus("Kampfstart braucht aktive Party-Mitglieder.");
            return;
        }
        state.combat().pendingInitiativeRows().clear();
        for (int index = 0; index < state.context().activeParty().size(); index++) {
            EncounterSessionViewState.PartyMemberData member = state.context().activeParty().get(index);
            state.combat().pendingInitiativeRows().add(new EncounterSessionViewState.InitiativeEntryData(
                    member.id(),
                    member.name() + " (Lv. " + member.level() + ")",
                    EncounterSessionViewState.CombatantKind.PLAYER_CHARACTER,
                    CombatRuntime.defaultPlayerInitiative(index)));
        }
        for (EncounterSessionViewState.EncounterCreatureData creature : state.builder().roster()) {
            int rolled = CombatRuntime.defaultMonsterInitiative(creature.initiativeBonus());
            String label = creature.count() > 1 ? creature.name() + " x" + creature.count() : creature.name();
            state.combat().pendingInitiativeRows().add(new EncounterSessionViewState.InitiativeEntryData(
                    creature.id(),
                    label + " (" + signed(creature.initiativeBonus()) + ")",
                    EncounterSessionViewState.CombatantKind.MONSTER,
                    rolled));
        }
        state.combat().setInitiativeState(new EncounterSessionViewState.InitiativeStateData(
                List.copyOf(state.combat().pendingInitiativeRows())));
        state.context().setMode(EncounterSessionViewState.Mode.INITIATIVE);
        state.context().setStatus("Initiativewerte prüfen und Kampf starten.");
    }

    public static void backToBuilder(EncounterSessionState state) {
        state.context().setMode(EncounterSessionViewState.Mode.BUILDER);
        state.context().setStatus("Zurück zur Encounter-Erstellung.");
    }

    public static void confirmInitiative(
            EncounterSessionState state,
            List<EncounterSessionViewState.InitiativeInputData> initiatives
    ) {
        state.combat().combatRuntime().clear();
        int fallbackIndex = 0;
        for (EncounterSessionViewState.InitiativeInputData input : safeInputs(initiatives)) {
            Optional<EncounterSessionViewState.InitiativeEntryData> entry = initiativeEntry(state, input.id());
            if (entry.isEmpty()) {
                continue;
            }
            EncounterSessionViewState.InitiativeEntryData current = entry.orElseThrow();
            if (current.kind() == EncounterSessionViewState.CombatantKind.PLAYER_CHARACTER) {
                fallbackIndex = state.combat().combatRuntime().addPlayer(
                        current.id(),
                        nameOnly(current.label()),
                        input.initiative(),
                        fallbackIndex);
            } else {
                Optional<EncounterSessionViewState.EncounterCreatureData> creature = creature(state, current.id());
                if (creature.isPresent()) {
                    EncounterSessionViewState.EncounterCreatureData currentCreature = creature.orElseThrow();
                    fallbackIndex = state.combat().combatRuntime().addMonsters(
                            currentCreature.id(),
                            currentCreature.name(),
                            currentCreature.creatureId(),
                            currentCreature.count(),
                            currentCreature.hp(),
                            currentCreature.ac(),
                            currentCreature.xp(),
                            currentCreature.cr(),
                            currentCreature.type(),
                            currentCreature.role(),
                            input.initiative(),
                            fallbackIndex);
                }
            }
        }
        state.combat().combatRuntime().sort();
        state.combat().setCurrentTurnIndex(state.combat().combatRuntime().hasTurnEntries()
                ? OptionalInt.of(CombatRuntime.FIRST_TURN_INDEX)
                : OptionalInt.empty());
        state.combat().setRound(FIRST_COMBAT_ROUND);
        state.context().setMode(EncounterSessionViewState.Mode.COMBAT);
        refreshCombatState(state);
        state.context().setStatus("Kampf laeuft. HP und Initiative sind lokal editierbar.");
    }

    public static void nextTurn(EncounterSessionState state) {
        CombatRuntime.TurnAdvance turn = state.combat().combatRuntime().nextTurn(
                state.combat().currentTurnIndex().orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX),
                state.combat().round());
        state.combat().setCurrentTurnIndex(toOptionalTurnIndex(turn.currentTurnIndex()));
        state.combat().setRound(turn.round());
        refreshCombatState(state);
    }

    public static void setInitiative(EncounterSessionState state, String combatantId, int initiative) {
        state.combat().combatRuntime().setInitiative(combatantId, initiative);
        refreshCombatState(state);
    }

    public static void addPartyMemberToCombat(EncounterSessionState state, long partyMemberId, int initiative) {
        if (state.context().mode() != EncounterSessionViewState.Mode.COMBAT) {
            return;
        }
        Optional<EncounterSessionViewState.PartyMemberData> member = partyMember(state, partyMemberId);
        if (member.isEmpty()) {
            state.context().setStatus("SC konnte nicht geladen werden.");
            return;
        }
        EncounterSessionViewState.PartyMemberData currentMember = member.orElseThrow();
        String activeTurnId = state.combat().combatRuntime().activeTurnId(
                state.combat().currentTurnIndex().orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX));
        boolean added = state.combat().combatRuntime().addPlayerToRunningCombat(
                currentMember.id(),
                currentMember.name(),
                initiative);
        state.combat().setCurrentTurnIndex(toOptionalTurnIndex(state.combat().combatRuntime().turnIndexOf(
                activeTurnId,
                state.combat().currentTurnIndex().orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX))));
        refreshCombatState(state);
        state.context().setStatus(added
                ? currentMember.name() + " betritt den laufenden Kampf."
                : currentMember.name() + " ist bereits im Kampf.");
    }

    public static void endCombat(EncounterSessionState state) {
        List<EncounterSessionViewState.ResultEnemyData> enemies = state.combat().combatRuntime().resultEnemies();
        int eligibleXp = enemies.stream()
                .filter(EncounterSessionViewState.ResultEnemyData::defeatedByDefault)
                .mapToInt(EncounterSessionViewState.ResultEnemyData::xp)
                .sum();
        int partySize = Math.max(1, state.context().activeParty().size());
        state.combat().setResultState(new EncounterSessionViewState.ResultStateData(
                enemies,
                enemies.stream().filter(EncounterSessionViewState.ResultEnemyData::defeatedByDefault).count(),
                eligibleXp,
                eligibleXp / partySize,
                NO_LOOT,
                "Loot-Persistenz ist in diesem Generator-Pass nicht angebunden.",
                "",
                false,
                !state.context().activeParty().isEmpty(),
                partySize));
        state.context().setMode(EncounterSessionViewState.Mode.RESULTS);
        state.context().setStatus("Kampfergebnis bereit.");
    }

    public static void awardXp(EncounterSessionState state, EncounterSessionRuntimeAccess access) {
        if (state.combat().resultState().xpAwarded()
                || state.combat().resultState().perPlayerXp() <= 0
                || state.context().activeParty().isEmpty()) {
            return;
        }
        EncounterSessionRuntimeData.AwardXpOutcome result = access.awardXp(
                state.context().activeParty().stream().map(EncounterSessionViewState.PartyMemberData::numericId).toList(),
                state.combat().resultState().perPlayerXp());
        state.combat().setResultState(state.combat().resultState().withAwardStatus(
                result.success() ? "XP an die aktive Party verteilt." : "XP konnte nicht verteilt werden.",
                result.success()));
        if (result.success()) {
            state.context().replaceActiveParty(access.loadActiveParty());
            state.context().setBudget(access.loadBudget());
        }
    }

    public static void returnToBuilderAfterResults(EncounterSessionState state) {
        state.combat().combatRuntime().clear();
        state.combat().pendingInitiativeRows().clear();
        state.combat().setRound(FIRST_COMBAT_ROUND);
        state.combat().setCurrentTurnIndex(OptionalInt.of(CombatRuntime.FIRST_TURN_INDEX));
        state.combat().setInitiativeState(EncounterSessionViewState.InitiativeStateData.empty());
        state.combat().setCombatState(EncounterSessionViewState.CombatProjectionData.empty());
        state.combat().setResultState(EncounterSessionViewState.ResultStateData.empty());
        state.context().setMode(EncounterSessionViewState.Mode.BUILDER);
        state.context().setStatus("Kampfergebnis geschlossen. Combat Planner bereit.");
    }

    public static void mutateHp(EncounterSessionState state, String combatantId, int amount, boolean healing) {
        if (state.combat().combatRuntime().mutateHp(combatantId, Math.max(0, amount), healing)) {
            refreshCombatState(state);
        }
    }

    public static void addReinforcement(
            EncounterSessionState state,
            EncounterSessionRuntimeData.CreatureDetailData creature,
            String reinforcementRole
    ) {
        String activeTurnId = state.combat().combatRuntime().activeTurnId(
                state.combat().currentTurnIndex().orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX));
        String displayName = state.combat().combatRuntime().addMonsterReinforcement(
                creature.name(),
                creature.id(),
                minimumHitPoints(creature.hitPoints()),
                creature.armorClass(),
                creature.xp(),
                creature.challengeRating(),
                creature.creatureType(),
                reinforcementRole,
                CombatRuntime.defaultMonsterInitiative(creature.initiativeBonus()));
        state.combat().setCurrentTurnIndex(toOptionalTurnIndex(state.combat().combatRuntime().turnIndexOf(
                activeTurnId,
                state.combat().currentTurnIndex().orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX))));
        refreshCombatState(state);
        state.context().setStatus(displayName + " betritt den laufenden Kampf.");
    }

    public static void refreshCombatState(EncounterSessionState state) {
        EncounterSessionViewState.CombatProjectionData projection = state.combat().combatRuntime().combatProjection(
                state.combat().currentTurnIndex().orElse(CombatRuntime.NO_ACTIVE_TURN_INDEX),
                state.combat().round());
        state.combat().setCurrentTurnIndex(toOptionalTurnIndex(projection.currentTurnIndex()));
        state.combat().setCombatState(projection);
    }

    private static Optional<EncounterSessionViewState.InitiativeEntryData> initiativeEntry(
            EncounterSessionState state,
            String id
    ) {
        return state.combat().pendingInitiativeRows().stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private static Optional<EncounterSessionViewState.EncounterCreatureData> creature(
            EncounterSessionState state,
            String id
    ) {
        return state.builder().roster().stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    private static Optional<EncounterSessionViewState.PartyMemberData> partyMember(
            EncounterSessionState state,
            long id
    ) {
        return state.context().activeParty().stream()
                .filter(entry -> entry.numericId() == id)
                .findFirst();
    }

    private static OptionalInt toOptionalTurnIndex(int turnIndex) {
        return turnIndex < 0 ? OptionalInt.empty() : OptionalInt.of(turnIndex);
    }

    private static List<EncounterSessionViewState.InitiativeInputData> safeInputs(
            List<EncounterSessionViewState.InitiativeInputData> initiatives
    ) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    private static int minimumHitPoints(int hitPoints) {
        return Math.max(1, hitPoints);
    }

    private static String nameOnly(String label) {
        int detailStart = label.indexOf(" (");
        return detailStart < 0 ? label : label.substring(0, detailStart);
    }

    private static String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
    }
}
