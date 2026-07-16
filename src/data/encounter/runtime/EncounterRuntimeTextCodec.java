package src.data.encounter.runtime;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import src.domain.encounter.model.generation.EncounterGenerationInputs;
import src.domain.encounter.model.generation.EncounterRequestedDifficulty;
import src.domain.encounter.model.generation.EncounterTuningIntent;
import src.domain.encounter.model.session.Combatant;
import src.domain.encounter.model.session.CombatantKind;
import src.domain.encounter.model.session.EncounterCreatureData;
import src.domain.encounter.model.session.EncounterSessionMemento;
import src.domain.encounter.model.session.GeneratedEncounterData;
import src.domain.encounter.model.session.InitiativeEntryData;
import src.domain.encounter.model.session.RemovedRosterEntryData;
import src.domain.encounter.model.session.ResultEnemyData;
import src.domain.encounter.model.session.ResultStateData;

final class EncounterRuntimeTextCodec {
    private static final String SEPARATOR = "|";

    List<String> encode(EncounterSessionMemento value) {
        List<String> rows = new ArrayList<>();
        rows.add(join("H", value.mode(), text(value.status()), value.nextUndoToken(),
                list(value.generatedAdvisories()), value.selectedAlternativeIndex(), value.generatedAdjustedXp(),
                text(value.generatedDifficulty()), text(value.generatedTitle()), value.generationHistoryPresent(),
                value.activeSavedPlanId(), value.currentTurnIndex(), value.round()));
        EncounterGenerationInputs input = value.builderInputs();
        rows.add(join("I", input.targetDifficulty().name(), input.tuning().balanceLevel(), input.tuning().amountValue(),
                input.tuning().diversityLevel(), input.worldLocationId(), list(input.creatureTypes()),
                list(input.creatureSubtypes()), list(input.biomes()), longs(input.encounterTableIds()),
                longs(input.worldFactionIds()), caps(input.finiteCreatureStockCaps())));
        for (EncounterCreatureData creature : value.roster()) {
            rows.add("R" + SEPARATOR + creature(creature));
        }
        value.pendingUndo().ifPresent(undo -> rows.add(join("U", undo.token(), undo.index())
                + SEPARATOR + creature(undo.creature())));
        for (int index = 0; index < value.generatedAlternatives().size(); index++) {
            GeneratedEncounterData alternative = value.generatedAlternatives().get(index);
            rows.add(join("A", index, text(alternative.title()), text(alternative.difficultyLabel()),
                    alternative.adjustedXp(), list(alternative.advisoryMessages())));
            for (EncounterCreatureData creature : alternative.roster()) {
                rows.add(join("AR", index) + SEPARATOR + creature(creature));
            }
        }
        for (InitiativeEntryData entry : value.initiativeEntries()) {
            rows.add(join("Q", text(entry.id()), text(entry.label()), entry.kind().name(), entry.initiative()));
        }
        for (Combatant combatant : value.combatants()) {
            rows.add(join("C", text(combatant.id()), text(combatant.name()), combatant.kind().name(),
                    combatant.creatureId(), combatant.worldNpcId(), combatant.currentHp(), combatant.maxHp(),
                    combatant.ac(), combatant.initiative(), combatant.count(), combatant.xp(), text(combatant.detail()),
                    text(combatant.loot()), combatant.order()));
        }
        ResultStateData result = value.resultState();
        rows.add(join("E", result.defeatedCount(), result.eligibleXp(), result.perPlayerXp(),
                text(result.goldSummary()), text(result.lootDetail()), text(result.awardStatus()),
                result.xpAwarded(), result.canAwardXp(), result.partySize()));
        for (ResultEnemyData enemy : result.enemies()) {
            rows.add(join("ER", text(enemy.name()), enemy.creatureId(), enemy.worldNpcId(), text(enemy.status()),
                    enemy.hpLoss(), enemy.xp(), enemy.defeatedByDefault(), text(enemy.loot())));
        }
        return List.copyOf(rows);
    }

    EncounterSessionMemento decode(List<String> rows) {
        Header header = null;
        EncounterGenerationInputs inputs = EncounterGenerationInputs.empty();
        List<EncounterCreatureData> roster = new ArrayList<>();
        Optional<RemovedRosterEntryData> undo = Optional.empty();
        Map<Integer, AlternativeBuilder> alternatives = new LinkedHashMap<>();
        List<InitiativeEntryData> initiatives = new ArrayList<>();
        List<Combatant> combatants = new ArrayList<>();
        ResultHeader resultHeader = ResultHeader.empty();
        List<ResultEnemyData> resultEnemies = new ArrayList<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            String[] fields = row.split("\\|", -1);
            switch (fields[0]) {
                case "H" -> header = Header.parse(fields);
                case "I" -> inputs = input(fields);
                case "R" -> roster.add(creature(fields, 1));
                case "U" -> undo = Optional.of(new RemovedRosterEntryData(longValue(fields[1]), intValue(fields[2]), creature(fields, 3)));
                case "A" -> alternatives.put(intValue(fields[1]), AlternativeBuilder.parse(fields));
                case "AR" -> alternatives.computeIfAbsent(intValue(fields[1]), ignored -> AlternativeBuilder.empty())
                        .roster.add(creature(fields, 2));
                case "Q" -> initiatives.add(new InitiativeEntryData(string(fields[1]), string(fields[2]),
                        CombatantKind.valueOf(fields[3]), intValue(fields[4])));
                case "C" -> combatants.add(combatant(fields));
                case "E" -> resultHeader = ResultHeader.parse(fields);
                case "ER" -> resultEnemies.add(resultEnemy(fields));
                default -> { }
            }
        }
        if (header == null) {
            throw new IllegalArgumentException("Encounter runtime header missing");
        }
        List<GeneratedEncounterData> generated = alternatives.values().stream().map(AlternativeBuilder::build).toList();
        return new EncounterSessionMemento(EncounterSessionMemento.CURRENT_FORMAT_VERSION, header.mode, header.status,
                inputs, roster, undo, header.nextUndoToken, generated, header.generatedAdvisories,
                header.selectedAlternativeIndex, header.generatedAdjustedXp, header.generatedDifficulty,
                header.generatedTitle, header.history, header.activePlanId, initiatives, combatants,
                header.turnIndex, header.round,
                new ResultStateData(resultEnemies, resultHeader.defeated, resultHeader.eligibleXp,
                        resultHeader.perPlayerXp, resultHeader.gold, resultHeader.loot, resultHeader.award,
                        resultHeader.awarded, resultHeader.canAward, resultHeader.partySize));
    }

    private static EncounterGenerationInputs input(String[] f) {
        return new EncounterGenerationInputs(strings(f[6]), strings(f[7]), strings(f[8]),
                EncounterRequestedDifficulty.valueOf(f[1]),
                new EncounterTuningIntent(intValue(f[2]), doubleValue(f[3]), intValue(f[4])),
                longList(f[9]), longList(f[10]), longValue(f[5]), capMap(f[11]));
    }

    private static Combatant combatant(String[] f) {
        return new Combatant(string(f[1]), string(f[2]), CombatantKind.valueOf(f[3]), longValue(f[4]),
                longValue(f[5]), intValue(f[6]), intValue(f[7]), intValue(f[8]), intValue(f[9]),
                intValue(f[10]), intValue(f[11]), string(f[12]), string(f[13]), intValue(f[14]));
    }

    private static ResultEnemyData resultEnemy(String[] f) {
        return new ResultEnemyData(string(f[1]), longValue(f[2]), longValue(f[3]), string(f[4]),
                intValue(f[5]), intValue(f[6]), Boolean.parseBoolean(f[7]), string(f[8]));
    }

    private static String creature(EncounterCreatureData c) {
        return join(text(c.id()), c.creatureId(), c.worldNpcId(), text(c.name()), text(c.challengeRating()), c.xp(),
                c.hp(), c.armorClass(), c.initiativeBonus(), text(c.creatureType()), text(c.encounterRole()),
                c.count(), list(c.tags()));
    }

    private static EncounterCreatureData creature(String[] f, int offset) {
        return new EncounterCreatureData(string(f[offset]), longValue(f[offset + 1]), longValue(f[offset + 2]),
                string(f[offset + 3]), string(f[offset + 4]), intValue(f[offset + 5]), intValue(f[offset + 6]),
                intValue(f[offset + 7]), intValue(f[offset + 8]), string(f[offset + 9]), string(f[offset + 10]),
                intValue(f[offset + 11]), strings(f[offset + 12]));
    }

    private static String join(Object... values) {
        return java.util.Arrays.stream(values).map(String::valueOf).collect(java.util.stream.Collectors.joining(SEPARATOR));
    }
    private static String text(String value) { return Base64.getUrlEncoder().withoutPadding().encodeToString((value == null ? "" : value).getBytes(StandardCharsets.UTF_8)); }
    private static String string(String value) { return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8); }
    private static String list(List<String> values) { return values == null ? "" : values.stream().map(EncounterRuntimeTextCodec::text).collect(java.util.stream.Collectors.joining(",")); }
    private static List<String> strings(String value) { return value == null || value.isBlank() ? List.of() : java.util.Arrays.stream(value.split(",", -1)).map(EncounterRuntimeTextCodec::string).toList(); }
    private static String longs(List<Long> values) { return values == null ? "" : values.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(",")); }
    private static List<Long> longList(String value) { return value == null || value.isBlank() ? List.of() : java.util.Arrays.stream(value.split(",")).map(Long::valueOf).toList(); }
    private static String caps(Map<Long, Integer> values) { return values.entrySet().stream().map(entry -> entry.getKey() + ":" + entry.getValue()).collect(java.util.stream.Collectors.joining(",")); }
    private static Map<Long, Integer> capMap(String value) { Map<Long, Integer> result = new LinkedHashMap<>(); if (value != null && !value.isBlank()) for (String pair : value.split(",")) { String[] p = pair.split(":"); result.put(Long.valueOf(p[0]), Integer.valueOf(p[1])); } return Map.copyOf(result); }
    private static int intValue(String value) { return Integer.parseInt(value); }
    private static long longValue(String value) { return Long.parseLong(value); }
    private static double doubleValue(String value) { return Double.parseDouble(value); }

    private record Header(int mode, String status, long nextUndoToken, List<String> generatedAdvisories,
            int selectedAlternativeIndex, int generatedAdjustedXp, String generatedDifficulty, String generatedTitle,
            boolean history, long activePlanId, int turnIndex, int round) {
        static Header parse(String[] f) { return new Header(intValue(f[1]), string(f[2]), longValue(f[3]), strings(f[4]),
                intValue(f[5]), intValue(f[6]), string(f[7]), string(f[8]), Boolean.parseBoolean(f[9]),
                longValue(f[10]), intValue(f[11]), intValue(f[12])); }
    }
    private static final class AlternativeBuilder {
        private String title = ""; private String difficulty = ""; private int xp; private List<String> advisories = List.of();
        private final List<EncounterCreatureData> roster = new ArrayList<>();
        static AlternativeBuilder parse(String[] f) { AlternativeBuilder b = new AlternativeBuilder(); b.title = string(f[2]); b.difficulty = string(f[3]); b.xp = intValue(f[4]); b.advisories = strings(f[5]); return b; }
        static AlternativeBuilder empty() { return new AlternativeBuilder(); }
        GeneratedEncounterData build() { return new GeneratedEncounterData(title, difficulty, xp, roster, advisories); }
    }
    private record ResultHeader(long defeated, int eligibleXp, int perPlayerXp, String gold, String loot,
            String award, boolean awarded, boolean canAward, int partySize) {
        static ResultHeader parse(String[] f) { return new ResultHeader(longValue(f[1]), intValue(f[2]), intValue(f[3]),
                string(f[4]), string(f[5]), string(f[6]), Boolean.parseBoolean(f[7]), Boolean.parseBoolean(f[8]), intValue(f[9])); }
        static ResultHeader empty() { return new ResultHeader(0, 0, 0, "", "", "", false, false, 1); }
    }
}
