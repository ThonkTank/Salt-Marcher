package features.sessionplanner.application;

import features.encounter.api.GeneratedEncounterPlanSummary;
import features.encounter.api.PreparedEncounterBatch;
import features.encounter.api.PreparedEncounterRoster;
import features.sessiongeneration.api.GenerationDraft;
import features.sessiongeneration.api.GenerationResult;
import features.sessionplanner.domain.session.SessionEncounterAllocation;
import features.sessionplanner.domain.session.SessionTreasure;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public record PreparedSessionDraft(
        SessionPreparationFingerprint source,
        GenerationDraft generationDraft,
        PreparedEncounterBatch encounterBatch,
        List<PreparedScene> scenes,
        List<PreparedRest> rests,
        List<PreparedManualLootNote> manualLootNotes,
        long selectedSceneId,
        List<SessionTreasure> preparedTreasures,
        String preparedContentFingerprint
) {

    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final int ALLOCATION_SCALE = 4;

    public PreparedSessionDraft {
        source = Objects.requireNonNull(source, "source");
        generationDraft = Objects.requireNonNull(generationDraft, "generationDraft");
        encounterBatch = Objects.requireNonNull(encounterBatch, "encounterBatch");
        scenes = List.copyOf(Objects.requireNonNull(scenes, "scenes"));
        rests = List.copyOf(Objects.requireNonNull(rests, "rests"));
        manualLootNotes = List.copyOf(Objects.requireNonNull(manualLootNotes, "manualLootNotes"));
        preparedTreasures = List.copyOf(Objects.requireNonNull(preparedTreasures, "preparedTreasures"));
        if (preparedContentFingerprint == null
                || !preparedContentFingerprint.matches("v1:[0-9a-f]{64}")) {
            throw new IllegalArgumentException("prepared content fingerprint must use canonical v1 SHA-256");
        }
        validate(source, generationDraft, encounterBatch, scenes, rests, manualLootNotes, selectedSceneId, preparedTreasures);
        String expected = fingerprint(source, generationDraft, encounterBatch, scenes, rests,
                manualLootNotes, selectedSceneId, preparedTreasures);
        if (!expected.equals(preparedContentFingerprint)) {
            throw new IllegalArgumentException("prepared content fingerprint does not match the draft");
        }
    }

    public static PreparedSessionDraft assemble(
            SessionPreparationFingerprint source,
            GenerationDraft generationDraft,
            PreparedEncounterBatch encounterBatch
    ) {
        validateForeignDrafts(source, generationDraft, encounterBatch);
        GenerationResult result = generationDraft.result();
        Map<Integer, PreparedEncounterRoster> rosters = new HashMap<>();
        encounterBatch.rosters().forEach(roster -> rosters.put(roster.encounterNumber(), roster));
        long targetTotal = result.encounters().stream().mapToLong(GenerationResult.Encounter::targetXp).sum();
        if (targetTotal <= 0L) {
            throw new IllegalArgumentException("generation target total must be positive");
        }
        List<PreparedScene> scenes = new ArrayList<>();
        Map<Integer, Long> encounterScenes = new HashMap<>();
        BigDecimal allocated = BigDecimal.ZERO;
        long nextSceneId = 1L;
        for (int index = 0; index < result.encounters().size(); index++) {
            GenerationResult.Encounter encounter = result.encounters().get(index);
            PreparedEncounterRoster roster = rosters.get(encounter.encounterNumber());
            if (roster == null) {
                throw new IllegalArgumentException("prepared encounter mapping is incomplete");
            }
            BigDecimal allocation = index == result.encounters().size() - 1
                    ? HUNDRED.subtract(allocated)
                    : BigDecimal.valueOf(encounter.targetXp()).multiply(HUNDRED)
                            .divide(BigDecimal.valueOf(targetTotal), ALLOCATION_SCALE, RoundingMode.DOWN);
            allocated = allocated.add(allocation);
            scenes.add(new PreparedScene(
                    nextSceneId,
                    encounter.encounterNumber(),
                    new SessionEncounterAllocation(allocation),
                    roster.displayLabel(),
                    roster.summary().displaySummary(),
                    0L));
            encounterScenes.put(encounter.encounterNumber(), nextSceneId++);
        }
        List<SessionTreasure> preparedTreasures = new ArrayList<>();
        for (GenerationResult.Treasure treasure : result.treasures()) {
            long sceneId;
            if (treasure.channel() == GenerationResult.RewardChannel.ENCOUNTER) {
                Long anchor = encounterScenes.get(treasure.anchorEncounterNumber());
                if (anchor == null) {
                    throw new IllegalArgumentException("encounter reward has no prepared scene anchor");
                }
                sceneId = anchor;
            } else {
                sceneId = nextSceneId++;
                scenes.add(new PreparedScene(
                        sceneId,
                        0,
                        SessionEncounterAllocation.zero(),
                        treasure.channel() == GenerationResult.RewardChannel.QUEST
                                ? "Quest-Belohnung"
                                : "Umgebungsfund",
                        treasure.theme(),
                        0L));
            }
            List<SessionTreasure.Item> items = result.lootItems().stream()
                    .filter(item -> item.treasureId() == treasure.treasureId())
                    .map(item -> new SessionTreasure.Item(
                            item.lineId(), item.role().name(), item.itemId(), item.text(), item.quantity(),
                            item.unitCp(), item.actualCp(), item.totalCapacity(), item.allowedContainers(),
                            item.magicRarity(), item.cursed()))
                    .toList();
            List<SessionTreasure.Packing> packing = result.packing().stream()
                    .filter(row -> row.treasureId() == treasure.treasureId())
                    .map(row -> new SessionTreasure.Packing(
                            row.lineId(), row.containerType(), row.containerCount(), row.containerId(), row.valid()))
                    .toList();
            preparedTreasures.add(new SessionTreasure(
                    treasure.treasureId(), sceneId, rewardLabel(treasure, result.lootItems()), "",
                    treasure.stockClass().name(), treasure.channel().name(), treasure.theme(), treasure.magicType(),
                    treasure.targetCp(), treasure.nonMagicSlots(), treasure.magicSlots(), items, packing));
        }
        long selection = scenes.isEmpty() ? 0L : scenes.getFirst().sceneId();
        List<PreparedRest> rests = List.of();
        List<PreparedManualLootNote> notes = List.of();
        return new PreparedSessionDraft(
                source,
                generationDraft,
                encounterBatch,
                scenes,
                rests,
                notes,
                selection,
                preparedTreasures,
                fingerprint(source, generationDraft, encounterBatch, scenes, rests, notes, selection, preparedTreasures));
    }

    private static void validate(
            SessionPreparationFingerprint source,
            GenerationDraft generationDraft,
            PreparedEncounterBatch batch,
            List<PreparedScene> scenes,
            List<PreparedRest> rests,
            List<PreparedManualLootNote> notes,
            long selectedSceneId,
            List<SessionTreasure> preparedTreasures
    ) {
        validateForeignDrafts(source, generationDraft, batch);
        Set<Long> sceneIds = new HashSet<>();
        Map<Integer, PreparedScene> encounterScenes = new HashMap<>();
        Map<Long, PreparedScene> scenesById = new HashMap<>();
        BigDecimal allocation = BigDecimal.ZERO;
        List<Integer> encounterNumbers = new ArrayList<>();
        for (PreparedScene scene : scenes) {
            if (!sceneIds.add(scene.sceneId())) {
                throw new IllegalArgumentException("prepared scene ids must be unique");
            }
            scenesById.put(scene.sceneId(), scene);
            allocation = allocation.add(scene.allocation().budgetPercentage());
            if (scene.encounterNumber() > 0) {
                encounterNumbers.add(scene.encounterNumber());
                if (encounterScenes.put(scene.encounterNumber(), scene) != null) {
                    throw new IllegalArgumentException("prepared encounter scene numbers must be unique");
                }
            }
        }
        if (scenes.isEmpty() || !sceneIds.contains(selectedSceneId)) {
            throw new IllegalArgumentException("prepared selection must name one prepared scene");
        }
        List<Integer> expectedEncounterNumbers = generationDraft.result().encounters().stream()
                .map(GenerationResult.Encounter::encounterNumber).toList();
        if (!encounterNumbers.equals(expectedEncounterNumbers)
                || batch.rosters().stream().map(PreparedEncounterRoster::encounterNumber).toList()
                        .equals(expectedEncounterNumbers) == false) {
            throw new IllegalArgumentException("prepared encounter order or cardinality is invalid");
        }
        if (allocation.compareTo(HUNDRED) != 0) {
            throw new IllegalArgumentException("prepared scene allocation must total exactly 100");
        }
        Set<Long> noteIds = new HashSet<>();
        for (PreparedManualLootNote note : notes) {
            if (!sceneIds.contains(note.sceneId()) || !noteIds.add(note.noteId())) {
                throw new IllegalArgumentException("prepared manual loot notes are invalid");
            }
        }
        for (PreparedRest rest : rests) {
            if (!adjacent(scenes, rest.leftSceneId(), rest.rightSceneId())) {
                throw new IllegalArgumentException("prepared rest must name an adjacent scene gap");
            }
        }
        List<GenerationResult.Treasure> treasures = generationDraft.result().treasures();
        if (preparedTreasures.size() != treasures.size()) {
            throw new IllegalArgumentException("prepared preparedTreasures must match every generated treasure");
        }
        Set<Long> rewardKeys = new HashSet<>();
        for (int index = 0; index < preparedTreasures.size(); index++) {
            SessionTreasure reward = preparedTreasures.get(index);
            GenerationResult.Treasure treasure = treasures.get(index);
            if (!sceneIds.contains(reward.sceneId()) || !rewardKeys.add(reward.treasureId())) {
                throw new IllegalArgumentException("prepared treasures are invalid");
            }
            if (reward.treasureId() != treasure.treasureId()) {
                throw new IllegalArgumentException("prepared treasures must retain generated order");
            }
            PreparedScene rewardScene = scenesById.get(reward.sceneId());
            if (treasure.channel() == GenerationResult.RewardChannel.ENCOUNTER) {
                PreparedScene expectedScene = encounterScenes.get(treasure.anchorEncounterNumber());
                if (expectedScene == null || expectedScene.sceneId() != reward.sceneId()) {
                    throw new IllegalArgumentException("encounter reward is anchored to the wrong scene");
                }
            } else if (rewardScene == null || rewardScene.encounterNumber() != 0) {
                throw new IllegalArgumentException("non-encounter reward must use an encounter-free scene");
            }
        }
        auditGenerationResult(generationDraft.result());
    }

    private static void validateForeignDrafts(
            SessionPreparationFingerprint source,
            GenerationDraft generationDraft,
            PreparedEncounterBatch batch
    ) {
        GenerationResult result = generationDraft.result();
        if (!batch.source().preparationIdentity().equals(source.identity())
                || !batch.source().generationRunIdentity().equals(result.runId().value())
                || !batch.source().engineVersion().equals(result.engineVersion())) {
            throw new IllegalArgumentException("foreign preparation identities are misaligned");
        }
        List<Integer> generationNumbers = result.encounters().stream()
                .map(GenerationResult.Encounter::encounterNumber).toList();
        List<Integer> rosterNumbers = batch.rosters().stream()
                .map(PreparedEncounterRoster::encounterNumber).toList();
        if (!generationNumbers.equals(rosterNumbers)
                || new HashSet<>(generationNumbers).size() != generationNumbers.size()) {
            throw new IllegalArgumentException("foreign encounter cardinality or order is invalid");
        }
        for (int index = 0; index < result.encounters().size(); index++) {
            GenerationResult.Encounter encounter = result.encounters().get(index);
            PreparedEncounterRoster roster = batch.rosters().get(index);
            GeneratedEncounterPlanSummary summary = roster.summary();
            if (encounter.encounterNumber() != index + 1
                    || encounter.targetXp() <= 0L
                    || encounter.blocks().isEmpty()
                    || roster.creatures().isEmpty()
                    || summary.planId() != 0L
                    || !summary.label().equals(roster.displayLabel())
                    || summary.creatureCount() != roster.creatures().stream()
                            .mapToInt(creature -> creature.quantity()).sum()
                    || summary.roster().equals(roster.creatures()) == false) {
                throw new IllegalArgumentException("prepared Encounter roster does not match its intent");
            }
            Set<String> blockIds = new HashSet<>();
            int declaredCount = 0;
            for (GenerationResult.EncounterBlock block : encounter.blocks()) {
                if (block.id() == null || block.id().isBlank() || !blockIds.add(block.id())
                        || block.requestedRole() == null
                        || block.challengeLabel() == null || block.challengeLabel().isBlank()
                        || block.monsterXp() <= 0L || block.count() <= 0) {
                    throw new IllegalArgumentException("generation encounter block is invalid");
                }
                declaredCount += block.count();
            }
            if (declaredCount != encounter.monsterCount()) {
                throw new IllegalArgumentException("generation encounter block count is inconsistent");
            }
        }
    }

    private static void auditGenerationResult(GenerationResult result) {
        if (result.audits().stream().anyMatch(audit -> audit.status() == GenerationResult.AuditStatus.FAIL)) {
            throw new IllegalArgumentException("generation contains a hard audit failure");
        }
        List<Integer> targetNumbers = result.encounterTargets().stream()
                .map(GenerationResult.EncounterTarget::encounterNumber).toList();
        List<Integer> encounterNumbers = result.encounters().stream()
                .map(GenerationResult.Encounter::encounterNumber).toList();
        if (!targetNumbers.equals(encounterNumbers)) {
            throw new IllegalArgumentException("generation target and encounter order is inconsistent");
        }
        for (int index = 0; index < result.encounterTargets().size(); index++) {
            if (result.encounterTargets().get(index).targetXp() <= 0L
                    || result.encounterTargets().get(index).targetXp()
                            != result.encounters().get(index).targetXp()) {
                throw new IllegalArgumentException("generation target XP does not match its encounter");
            }
        }
        Map<Integer, GenerationResult.Treasure> treasures = new HashMap<>();
        for (GenerationResult.Treasure treasure : result.treasures()) {
            if (treasure.treasureId() <= 0 || treasures.put(treasure.treasureId(), treasure) != null) {
                throw new IllegalArgumentException("generation treasure identities are invalid");
            }
            if (treasure.channel() == GenerationResult.RewardChannel.ENCOUNTER
                    && !encounterNumbers.contains(treasure.anchorEncounterNumber())) {
                throw new IllegalArgumentException("generation reward anchor is invalid");
            }
            if (treasure.channel() != GenerationResult.RewardChannel.ENCOUNTER
                    && treasure.anchorEncounterNumber() != 0) {
                throw new IllegalArgumentException("non-encounter reward must not have an encounter anchor");
            }
        }
        Set<String> lootKeys = new HashSet<>();
        List<String> lootOrder = new ArrayList<>();
        int expectedLineId = 1;
        for (GenerationResult.LootItem line : result.lootItems()) {
            if (line.lineId() != expectedLineId++ || line.quantity() <= 0L
                    || line.role() == null
                    || line.itemId() == null || line.itemId().isBlank()
                    || line.text() == null || line.text().isBlank()
                    || line.unitCp() < 0L || line.actualCp() < 0L
                    || line.totalCapacity() == null || line.totalCapacity().compareTo(BigDecimal.ZERO) < 0
                    || !treasures.containsKey(line.treasureId())
                    || !lootKeys.add(line.treasureId() + ":" + line.lineId())) {
                throw new IllegalArgumentException("generation loot references are invalid");
            }
            lootOrder.add(line.treasureId() + ":" + line.lineId());
        }
        Set<String> packingKeys = new HashSet<>();
        List<String> packingOrder = new ArrayList<>();
        expectedLineId = 1;
        for (GenerationResult.Packing packing : result.packing()) {
            String key = packing.treasureId() + ":" + packing.lineId();
            boolean usesLooseMarker = "none".equals(packing.containerType())
                    || "none".equals(packing.containerId());
            boolean loose = "none".equals(packing.containerType())
                    && "none".equals(packing.containerId())
                    && packing.containerCount() == 0;
            if (packing.lineId() != expectedLineId++
                    || !lootKeys.contains(key)
                    || !packingKeys.add(key)
                    || packing.containerType() == null || packing.containerType().isBlank()
                    || packing.containerId() == null || packing.containerId().isBlank()
                    || (usesLooseMarker && !loose)
                    || (!loose && packing.containerCount() <= 0)
                    || !packing.valid()) {
                throw new IllegalArgumentException("generation packing references are invalid");
            }
            packingOrder.add(key);
        }
        if (!packingKeys.equals(lootKeys) || !packingOrder.equals(lootOrder)) {
            throw new IllegalArgumentException("every generated loot line needs exactly one packing row");
        }
        long targetTotal = result.encounterTargets().stream().mapToLong(GenerationResult.EncounterTarget::targetXp).sum();
        if (targetTotal != result.session().sessionXpTarget()) {
            throw new IllegalArgumentException("generation encounter allocation is not exact");
        }
    }

    private static String fingerprint(
            SessionPreparationFingerprint source,
            GenerationDraft generationDraft,
            PreparedEncounterBatch batch,
            List<PreparedScene> scenes,
            List<PreparedRest> rests,
            List<PreparedManualLootNote> notes,
            long selectedSceneId,
            List<SessionTreasure> preparedTreasures
    ) {
        CanonicalSha256DigestWriter output = new CanonicalSha256DigestWriter()
                .writeText("prepared-session-content-v1")
                .writeText(source.identity())
                .writeLong(source.sessionId())
                .writeLong(source.sourceRevision().value())
                .writeText(generationDraft.contentFingerprint())
                .writeText(generationDraft.result().runId().value())
                .writeText(generationDraft.result().engineVersion())
                .writeText(batch.batchFingerprint())
                .writeInt(batch.rosters().size());
        for (PreparedEncounterRoster roster : batch.rosters()) {
            output.writeInt(roster.encounterNumber()).writeText(roster.rosterFingerprint());
        }
        output.writeInt(scenes.size());
        for (PreparedScene scene : scenes) {
            output.writeLong(scene.sceneId())
                    .writeInt(scene.encounterNumber())
                    .writeText(scene.allocation().budgetPercentage().stripTrailingZeros().toPlainString())
                    .writeText(scene.title())
                    .writeText(scene.notes())
                    .writeLong(scene.locationId());
        }
        output.writeInt(rests.size());
        for (PreparedRest rest : rests) {
            output.writeLong(rest.leftSceneId()).writeLong(rest.rightSceneId()).writeText(rest.kind());
        }
        output.writeInt(notes.size());
        for (PreparedManualLootNote note : notes) {
            output.writeLong(note.noteId()).writeLong(note.sceneId()).writeText(note.authoredText());
        }
        output.writeLong(selectedSceneId).writeInt(preparedTreasures.size());
        for (SessionTreasure reward : preparedTreasures) {
            output.writeLong(reward.sceneId())
                    .writeLong(reward.treasureId())
                    .writeText(reward.title())
                    .writeText(reward.note())
                    .writeText(reward.stockClass())
                    .writeText(reward.channel())
                    .writeText(reward.theme())
                    .writeText(reward.magicType())
                    .writeLong(reward.targetCp())
                    .writeInt(reward.nonMagicSlots())
                    .writeInt(reward.magicSlots())
                    .writeInt(reward.items().size());
            for (SessionTreasure.Item item : reward.items()) {
                output.writeLong(item.lineId()).writeText(item.role()).writeText(item.itemId())
                        .writeText(item.text()).writeLong(item.quantity()).writeLong(item.unitCp())
                        .writeLong(item.actualCp()).writeText(item.totalCapacity().toPlainString())
                        .writeText(item.allowedContainers()).writeText(item.magicRarity())
                        .writeBoolean(item.cursed());
            }
            output.writeInt(reward.packing().size());
            for (SessionTreasure.Packing row : reward.packing()) {
                output.writeLong(row.lineId()).writeText(row.containerType()).writeInt(row.containerCount())
                        .writeText(row.containerId()).writeBoolean(row.valid());
            }
        }
        return output.finishV1();
    }

    private static String rewardLabel(
            GenerationResult.Treasure treasure,
            List<GenerationResult.LootItem> loot
    ) {
        long lines = loot.stream().filter(line -> line.treasureId() == treasure.treasureId()).count();
        String theme = treasure.theme() == null ? "" : treasure.theme().trim();
        return (theme.isEmpty() ? "Generierte Belohnung" : theme) + " · " + lines + " Positionen";
    }

    private static boolean adjacent(List<PreparedScene> scenes, long left, long right) {
        for (int index = 0; index < scenes.size() - 1; index++) {
            if (scenes.get(index).sceneId() == left && scenes.get(index + 1).sceneId() == right) {
                return true;
            }
        }
        return false;
    }

    public record PreparedScene(
            long sceneId,
            int encounterNumber,
            SessionEncounterAllocation allocation,
            String title,
            String notes,
            long locationId
    ) {

        public PreparedScene {
            if (sceneId <= 0L || encounterNumber < 0 || allocation == null || locationId < 0L) {
                throw new IllegalArgumentException("prepared scene is invalid");
            }
            title = required(title, "title");
            notes = Objects.requireNonNullElse(notes, "").trim();
        }
    }

    public record PreparedRest(long leftSceneId, long rightSceneId, String kind) {

        public PreparedRest {
            if (leftSceneId <= 0L || rightSceneId <= 0L) {
                throw new IllegalArgumentException("prepared rest identities must be positive");
            }
            kind = required(kind, "kind");
        }
    }

    public record PreparedManualLootNote(long noteId, long sceneId, String authoredText) {

        public PreparedManualLootNote {
            if (noteId <= 0L || sceneId <= 0L) {
                throw new IllegalArgumentException("prepared manual note identities must be positive");
            }
            authoredText = required(authoredText, "authoredText");
        }
    }

    private static String required(String value, String name) {
        String normalized = Objects.requireNonNull(value, name).trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return normalized;
    }
}
