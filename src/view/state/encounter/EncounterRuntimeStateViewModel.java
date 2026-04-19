package src.view.state.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

public final class EncounterRuntimeStateViewModel {

    public enum Mode {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    private static final List<PartyMember> DEMO_PARTY = List.of(
            new PartyMember("pc-1", "Mira", 5),
            new PartyMember("pc-2", "Tarek", 5),
            new PartyMember("pc-3", "Nuala", 4),
            new PartyMember("pc-4", "Brom", 4));
    private static final List<EncounterCreature> DEMO_GENERATED_ROSTER = List.of(
            new EncounterCreature("ghoul", "Ghoul", "1", 200, 22, 12, 2, "Undead", "SKIRMISHER"),
            new EncounterCreature("cult-fanatic", "Cult Fanatic", "2", 450, 33, 13, 2, "Humanoid", "SUPPORT"),
            new EncounterCreature("shadow", "Shadow", "1/2", 100, 16, 12, 2, "Undead", "MINION"));

    private final ReadOnlyObjectWrapper<Mode> mode = new ReadOnlyObjectWrapper<>(Mode.BUILDER);
    private final ReadOnlyObjectWrapper<BuilderState> builderState =
            new ReadOnlyObjectWrapper<>(emptyBuilderState());
    private final ReadOnlyObjectWrapper<InitiativeState> initiativeState =
            new ReadOnlyObjectWrapper<>(InitiativeState.empty());
    private final ReadOnlyObjectWrapper<CombatState> combatState =
            new ReadOnlyObjectWrapper<>(CombatState.empty());
    private final ReadOnlyObjectWrapper<ResultState> resultState =
            new ReadOnlyObjectWrapper<>(ResultState.empty());
    private final ReadOnlyStringWrapper status = new ReadOnlyStringWrapper(
            "Demo-UI bereit. Katalog- und Combat-Services werden spaeter angebunden.");

    private final List<EncounterCreature> roster = new ArrayList<>();
    private final List<InitiativeEntry> pendingInitiativeRows = new ArrayList<>();
    private final List<Combatant> combatants = new ArrayList<>();
    private int currentTurnIndex;
    private int round = 1;
    private int generationCount;
    private boolean xpAwarded;

    public ReadOnlyObjectProperty<Mode> modeProperty() {
        return mode.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<BuilderState> builderStateProperty() {
        return builderState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<InitiativeState> initiativeStateProperty() {
        return initiativeState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<CombatState> combatStateProperty() {
        return combatState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<ResultState> resultStateProperty() {
        return resultState.getReadOnlyProperty();
    }

    public ReadOnlyStringProperty statusProperty() {
        return status.getReadOnlyProperty();
    }

    public void generate(BuilderSettings settings) {
        generationCount++;
        roster.clear();
        roster.addAll(DEMO_GENERATED_ROSTER);
        if (generationCount % 2 == 0) {
            roster.add(new EncounterCreature(
                    "reef-shark",
                    "Reef Shark",
                    "1/2",
                    100,
                    22,
                    12,
                    2,
                    "Beast",
                    "MINION"));
        }
        status.set("Demo-Encounter generiert: " + label(settings.difficultyLabel()) + ".");
        refreshBuilderState(settings);
    }

    public void addDemoCreature() {
        roster.add(new EncounterCreature(
                "sahuagin",
                "Sahuagin",
                "1/2",
                100,
                22,
                12,
                1,
                "Humanoid",
                "SOLDIER"));
        status.set("Demo-Kreatur aus dem spaeteren Catalog-Hook hinzugefuegt.");
        refreshBuilderState(BuilderSettings.defaultSettings());
    }

    public void clearRoster() {
        roster.clear();
        status.set("Encounter-Roster geleert.");
        refreshBuilderState(BuilderSettings.defaultSettings());
    }

    public void openInitiative() {
        if (roster.isEmpty()) {
            status.set("Kampfstart braucht mindestens eine Kreatur.");
            return;
        }
        pendingInitiativeRows.clear();
        for (int index = 0; index < DEMO_PARTY.size(); index++) {
            PartyMember member = DEMO_PARTY.get(index);
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

    public void backToBuilder() {
        mode.set(Mode.BUILDER);
        status.set("Zurueck zur Encounter-Erstellung.");
    }

    public void confirmInitiative(List<InitiativeInput> initiatives) {
        combatants.clear();
        int fallbackIndex = 0;
        for (InitiativeInput input : safeInputs(initiatives)) {
            InitiativeEntry entry = initiativeEntry(input.id());
            int initiative = input.initiative();
            if (entry == null) {
                continue;
            }
            if ("SC".equals(entry.kind())) {
                combatants.add(Combatant.pc(entry.id(), nameOnly(entry.label()), initiative, fallbackIndex++));
            } else {
                EncounterCreature creature = creature(entry.id());
                if (creature != null) {
                    combatants.add(Combatant.monster(creature, initiative, fallbackIndex++));
                }
            }
        }
        combatants.sort((left, right) -> {
            int byInitiative = Integer.compare(right.initiative(), left.initiative());
            return byInitiative != 0 ? byInitiative : Integer.compare(left.order(), right.order());
        });
        currentTurnIndex = combatants.isEmpty() ? -1 : 0;
        round = 1;
        mode.set(Mode.COMBAT);
        refreshCombatState();
        status.set("Demo-Kampf laeuft. HP und Initiative sind lokal editierbar.");
    }

    public void nextTurn() {
        if (combatants.isEmpty()) {
            return;
        }
        int next = currentTurnIndex;
        for (int attempts = 0; attempts < combatants.size(); attempts++) {
            next = (next + 1) % combatants.size();
            if (next == 0) {
                round++;
            }
            if (combatants.get(next).alive()) {
                currentTurnIndex = next;
                refreshCombatState();
                return;
            }
        }
        refreshCombatState();
    }

    public void applyDamage(String combatantId, int amount) {
        mutateHp(combatantId, -Math.max(0, amount));
    }

    public void heal(String combatantId, int amount) {
        mutateHp(combatantId, Math.max(0, amount));
    }

    public void setInitiative(String combatantId, int initiative) {
        for (int index = 0; index < combatants.size(); index++) {
            Combatant combatant = combatants.get(index);
            if (combatant.id().equals(combatantId)) {
                combatants.set(index, combatant.withInitiative(initiative));
                break;
            }
        }
        combatants.sort((left, right) -> {
            int byInitiative = Integer.compare(right.initiative(), left.initiative());
            return byInitiative != 0 ? byInitiative : Integer.compare(left.order(), right.order());
        });
        currentTurnIndex = Math.max(0, Math.min(currentTurnIndex, combatants.size() - 1));
        refreshCombatState();
    }

    public void endCombat() {
        List<ResultEnemy> enemies = combatants.stream()
                .filter(combatant -> !combatant.pc())
                .map(combatant -> new ResultEnemy(
                        combatant.name(),
                        combatant.alive() ? "Lebt" : "Tot",
                        Math.max(0, combatant.maxHp() - combatant.currentHp()),
                        combatant.xp(),
                        !combatant.alive(),
                        combatant.loot()))
                .toList();
        int eligibleXp = enemies.stream()
                .filter(enemy -> enemy.defeatedByDefault())
                .mapToInt(ResultEnemy::xp)
                .sum();
        int perPlayerXp = eligibleXp / Math.max(1, DEMO_PARTY.size());
        xpAwarded = false;
        resultState.set(new ResultState(
                enemies,
                enemies.stream().filter(ResultEnemy::defeatedByDefault).count(),
                eligibleXp,
                perPlayerXp,
                "42 gp",
                "Loot-Pool gesamt (42 gp durch tote Gegner)",
                "",
                false,
                true));
        mode.set(Mode.RESULTS);
        status.set("Kampfergebnis bereit.");
    }

    public void awardXp() {
        ResultState current = resultState.get();
        xpAwarded = true;
        resultState.set(current.withAwardStatus("XP an die Demo-Party verteilt.", true));
    }

    public void returnToBuilderAfterResults() {
        combatants.clear();
        pendingInitiativeRows.clear();
        round = 1;
        currentTurnIndex = 0;
        mode.set(Mode.BUILDER);
        status.set("Kampf abgeschlossen. Neuer Encounter kann erstellt werden.");
    }

    private void mutateHp(String combatantId, int delta) {
        for (int index = 0; index < combatants.size(); index++) {
            Combatant combatant = combatants.get(index);
            if (combatant.id().equals(combatantId) && !combatant.pc()) {
                int hp = Math.max(0, Math.min(combatant.maxHp(), combatant.currentHp() + delta));
                combatants.set(index, combatant.withHp(hp));
                break;
            }
        }
        refreshCombatState();
    }

    private void refreshBuilderState(BuilderSettings settings) {
        builderState.set(builderState(settings));
    }

    private BuilderState emptyBuilderState() {
        return builderState(BuilderSettings.defaultSettings());
    }

    private BuilderState builderState(BuilderSettings settings) {
        int adjustedXp = roster.stream().mapToInt(EncounterCreature::totalXp).sum();
        String difficulty = adjustedXp >= 1_600 ? "Deadly" : adjustedXp >= 900 ? "Hard" : adjustedXp >= 600 ? "Medium" : "Easy";
        return new BuilderState(
                List.copyOf(DEMO_PARTY),
                List.copyOf(roster),
                new DifficultySummary(300, 600, 900, 1_600, adjustedXp, difficulty),
                settings == null ? BuilderSettings.defaultSettings() : settings,
                !roster.isEmpty(),
                roster.isEmpty()
                        ? "Monster per Catalog-Hook hinzufuegen oder Demo-Encounter generieren."
                        : "Demo-Roster bereit fuer Initiative und Kampfstart.");
    }

    private void refreshCombatState() {
        List<CombatCard> cards = new ArrayList<>();
        int aliveEnemies = 0;
        int totalEnemies = 0;
        for (int index = 0; index < combatants.size(); index++) {
            Combatant combatant = combatants.get(index);
            boolean active = index == currentTurnIndex && combatant.alive();
            if (!combatant.pc()) {
                totalEnemies++;
                if (combatant.alive()) {
                    aliveEnemies++;
                }
            }
            cards.add(new CombatCard(
                    combatant.id(),
                    combatant.name(),
                    combatant.pc(),
                    active,
                    combatant.alive(),
                    combatant.currentHp(),
                    combatant.maxHp(),
                    combatant.ac(),
                    combatant.initiative(),
                    combatant.count(),
                    combatant.detail()));
        }
        String statusText = aliveEnemies + "/" + totalEnemies + " - " + liveDifficulty(totalEnemies, aliveEnemies);
        combatState.set(new CombatState(round, statusText, cards, totalEnemies > 0 && aliveEnemies == 0));
    }

    private String liveDifficulty(int totalEnemies, int aliveEnemies) {
        if (totalEnemies == 0) {
            return "Keine Gegner";
        }
        if (aliveEnemies == 0) {
            return "Besiegt";
        }
        return aliveEnemies < totalEnemies ? "Medium" : "Hard";
    }

    private InitiativeEntry initiativeEntry(String id) {
        for (InitiativeEntry entry : pendingInitiativeRows) {
            if (entry.id().equals(id)) {
                return entry;
            }
        }
        return null;
    }

    private EncounterCreature creature(String id) {
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

    private static String nameOnly(String label) {
        int detailStart = label.indexOf(" (");
        return detailStart < 0 ? label : label.substring(0, detailStart);
    }

    private static String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
    }

    private static String label(String value) {
        return value == null || value.isBlank() ? "Auto" : value;
    }

    public record BuilderSettings(
            String difficultyLabel,
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {
        public static BuilderSettings defaultSettings() {
            return new BuilderSettings("Auto", 3, 3.0, 3);
        }
    }

    public record PartyMember(String id, String name, int level) {
    }

    public record EncounterCreature(
            String id,
            String name,
            String cr,
            int xp,
            int hp,
            int ac,
            int initiativeBonus,
            String type,
            String role,
            int count
    ) {
        public EncounterCreature(
                String id,
                String name,
                String cr,
                int xp,
                int hp,
                int ac,
                int initiativeBonus,
                String type,
                String role
        ) {
            this(id, name, cr, xp, hp, ac, initiativeBonus, type, role, 1);
        }

        int totalXp() {
            return xp * count;
        }
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
            DifficultySummary difficulty,
            BuilderSettings settings,
            boolean canStartCombat,
            String message
    ) {
        public BuilderState {
            party = party == null ? List.of() : List.copyOf(party);
            roster = roster == null ? List.of() : List.copyOf(roster);
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
            boolean canAwardXp
    ) {
        public ResultState {
            enemies = enemies == null ? List.of() : List.copyOf(enemies);
        }

        static ResultState empty() {
            return new ResultState(List.of(), 0, 0, 0, "Kein Loot", "", "", false, false);
        }

        ResultState withAwardStatus(String status, boolean awarded) {
            return new ResultState(
                    enemies,
                    defeatedCount,
                    eligibleXp,
                    perPlayerXp,
                    goldSummary,
                    lootDetail,
                    status,
                    awarded,
                    !awarded && canAwardXp);
        }
    }

    private record Combatant(
            String id,
            String name,
            boolean pc,
            int currentHp,
            int maxHp,
            int ac,
            int initiative,
            int count,
            int xp,
            String detail,
            String loot,
            int order
    ) {
        static Combatant pc(String id, String name, int initiative, int order) {
            return new Combatant(id, name, true, 0, 0, 0, initiative, 1, 0, "SC", "", order);
        }

        static Combatant monster(EncounterCreature creature, int initiative, int order) {
            int hp = creature.hp() * Math.max(1, creature.count());
            return new Combatant(
                    creature.id(),
                    creature.count() > 1 ? creature.name() + " x" + creature.count() : creature.name(),
                    false,
                    hp,
                    hp,
                    creature.ac(),
                    initiative,
                    creature.count(),
                    creature.totalXp(),
                    "CR " + creature.cr() + " | " + creature.type() + " | " + creature.role().toLowerCase(Locale.ROOT),
                    "14 gp",
                    order);
        }

        boolean alive() {
            return pc || currentHp > 0;
        }

        Combatant withHp(int hitPoints) {
            return new Combatant(id, name, pc, hitPoints, maxHp, ac, initiative, count, xp, detail, loot, order);
        }

        Combatant withInitiative(int value) {
            return new Combatant(id, name, pc, currentHp, maxHp, ac, value, count, xp, detail, loot, order);
        }
    }
}
