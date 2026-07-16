package src.data.sessiongeneration;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.sessiongeneration.GenerationRequest;
import src.domain.sessiongeneration.GenerationResult;
import src.domain.sessiongeneration.GenerationResult.AuditResult;
import src.domain.sessiongeneration.GenerationResult.EncounterBlock;
import src.domain.sessiongeneration.GenerationResult.EncounterPlan;
import src.domain.sessiongeneration.GenerationResult.LootLine;
import src.domain.sessiongeneration.GenerationResult.RarityTarget;
import src.domain.sessiongeneration.GenerationResult.RewardSummary;
import src.domain.sessiongeneration.GenerationResult.SessionContext;
import src.domain.sessiongeneration.GenerationResult.TreasureResult;

final class GenerationResultBinaryCodec {

    private static final int MAGIC = 0x534D4731;
    private static final int VERSION = 2;

    byte[] encode(GenerationResult result) {
        return encode(result, VERSION);
    }

    byte[] encodeVersion1(GenerationResult result) {
        return encode(result, 1);
    }

    private byte[] encode(GenerationResult result, int version) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                DataOutputStream output = new DataOutputStream(bytes)) {
            output.writeInt(MAGIC);
            output.writeInt(version);
            output.writeLong(result.generationId());
            writeRequest(output, result.request());
            writeSession(output, result.session());
            writeEncounters(output, result.encounters());
            writeTreasures(output, result.treasures(), version);
            writeSummary(output, result.summary());
            writeString(output, result.formattedText());
            writeAudits(output, result.audits());
            writeString(output, result.dataContentHash());
            output.flush();
            return bytes.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Could not encode generation result.", exception);
        }
    }

    GenerationResult decode(byte[] payload) {
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(payload))) {
            if (input.readInt() != MAGIC) {
                throw new IllegalStateException("Unsupported generation result payload.");
            }
            int version = input.readInt();
            if (version < 1 || version > VERSION) throw new IllegalStateException(
                    "Unsupported generation result payload version: " + version);
            long id = input.readLong();
            GenerationRequest request = readRequest(input);
            SessionContext session = readSession(input);
            List<EncounterPlan> encounters = readList(input, this::readEncounter);
            List<TreasureResult> treasures = readList(input, stream -> readTreasure(stream, version));
            RewardSummary summary = readSummary(input);
            String formattedText = readString(input);
            List<AuditResult> audits = readList(input, stream -> new AuditResult(
                    readString(stream), stream.readBoolean(), readString(stream)));
            String contentHash = readString(input);
            return new GenerationResult(
                    id, request, session, encounters, treasures, summary, formattedText, audits, contentHash);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not decode generation result.", exception);
        }
    }

    private static void writeRequest(DataOutputStream output, GenerationRequest request) throws IOException {
        List<Map.Entry<Integer, Integer>> players = request.playersByLevel().entrySet().stream()
                .sorted(Map.Entry.comparingByKey()).toList();
        output.writeInt(players.size());
        for (Map.Entry<Integer, Integer> entry : players) {
            output.writeInt(entry.getKey());
            output.writeInt(entry.getValue());
        }
        writeString(output, request.adventureDayFraction().toPlainString());
        output.writeBoolean(request.encounterCount() != null);
        if (request.encounterCount() != null) output.writeInt(request.encounterCount());
        output.writeLong(request.seed());
        writeString(output, request.rulesetVersion());
        writeString(output, request.locale());
    }

    private static GenerationRequest readRequest(DataInputStream input) throws IOException {
        Map<Integer, Integer> players = new LinkedHashMap<>();
        int count = input.readInt();
        for (int index = 0; index < count; index++) players.put(input.readInt(), input.readInt());
        BigDecimal fraction = new BigDecimal(readString(input));
        Integer encounterCount = input.readBoolean() ? input.readInt() : null;
        return new GenerationRequest(
                players, fraction, encounterCount, input.readLong(), readString(input), readString(input));
    }

    private static void writeSession(DataOutputStream output, SessionContext session) throws IOException {
        output.writeInt(session.partyCount());
        output.writeInt(session.dayXpBudget());
        output.writeInt(session.sessionXpTarget());
        writeString(output, session.averageLevel().toPlainString());
        output.writeLong(session.normalBudgetCp());
        output.writeLong(session.overstockBudgetCp());
        output.writeInt(session.nonMagicSlots());
        output.writeInt(session.treasureCount());
        output.writeInt(session.rarityTargets().size());
        for (RarityTarget target : session.rarityTargets()) {
            writeString(output, target.rarity());
            output.writeInt(target.normalCount());
            output.writeInt(target.overstockCount());
        }
    }

    private static SessionContext readSession(DataInputStream input) throws IOException {
        int partyCount = input.readInt();
        int dayXp = input.readInt();
        int sessionXp = input.readInt();
        BigDecimal average = new BigDecimal(readString(input));
        long normal = input.readLong();
        long overstock = input.readLong();
        int slots = input.readInt();
        int treasureCount = input.readInt();
        List<RarityTarget> rarities = readList(input, stream -> new RarityTarget(
                readString(stream), stream.readInt(), stream.readInt()));
        return new SessionContext(
                partyCount, dayXp, sessionXp, average, normal, overstock, slots, treasureCount, rarities);
    }

    private static void writeEncounters(DataOutputStream output, List<EncounterPlan> encounters) throws IOException {
        output.writeInt(encounters.size());
        for (EncounterPlan encounter : encounters) {
            output.writeInt(encounter.encounterNumber());
            output.writeInt(encounter.targetXp());
            output.writeInt(encounter.adjustedXp());
            writeString(output, encounter.difficulty());
            output.writeInt(encounter.blocks().size());
            for (EncounterBlock block : encounter.blocks()) {
                writeString(output, block.role());
                writeString(output, block.challengeRating());
                output.writeInt(block.challengeRatingCode());
                output.writeInt(block.quantity());
                output.writeInt(block.unitXp());
            }
            output.writeDouble(encounter.xpMultiplier());
            output.writeInt(encounter.bossRank());
            writeString(output, encounter.line());
        }
    }

    private EncounterPlan readEncounter(DataInputStream input) throws IOException {
        int number = input.readInt();
        int target = input.readInt();
        int adjusted = input.readInt();
        String difficulty = readString(input);
        List<EncounterBlock> blocks = readList(input, stream -> new EncounterBlock(
                readString(stream), readString(stream), stream.readInt(), stream.readInt(), stream.readInt()));
        return new EncounterPlan(
                number, target, adjusted, difficulty, blocks,
                input.readDouble(), input.readInt(), readString(input));
    }

    private static void writeTreasures(
            DataOutputStream output,
            List<TreasureResult> treasures,
            int version
    ) throws IOException {
        output.writeInt(treasures.size());
        for (TreasureResult treasure : treasures) {
            output.writeInt(treasure.treasureId());
            writeString(output, treasure.stockClass());
            writeString(output, treasure.rewardChannel());
            output.writeBoolean(treasure.anchorEncounterNumber() != null);
            if (treasure.anchorEncounterNumber() != null) output.writeInt(treasure.anchorEncounterNumber());
            writeString(output, treasure.theme());
            output.writeLong(treasure.targetCp());
            output.writeLong(treasure.actualCp());
            output.writeInt(treasure.loot().size());
            for (LootLine line : treasure.loot()) writeLootLine(output, line, version);
        }
    }

    private TreasureResult readTreasure(DataInputStream input, int version) throws IOException {
        int id = input.readInt();
        String stock = readString(input);
        String channel = readString(input);
        Integer anchor = input.readBoolean() ? input.readInt() : null;
        String theme = readString(input);
        long target = input.readLong();
        long actual = input.readLong();
        List<LootLine> loot = readList(input, stream -> readLootLine(stream, version));
        return new TreasureResult(id, stock, channel, anchor, theme, target, actual, loot);
    }

    private static void writeLootLine(DataOutputStream output, LootLine line, int version) throws IOException {
        output.writeInt(line.lineId());
        writeString(output, line.role());
        writeString(output, line.item());
        output.writeInt(line.quantity());
        output.writeLong(line.unitCp());
        output.writeLong(line.actualCp());
        writeString(output, line.container());
        writeString(output, line.rarity());
        output.writeBoolean(line.cursed());
        writeString(output, line.text());
        if (version >= 2) {
            writeString(output, line.baseLootItemId());
            writeString(output, line.magicSource());
            writeString(output, line.curseId());
        }
    }

    private LootLine readLootLine(DataInputStream input, int version) throws IOException {
        int lineId = input.readInt();
        String role = readString(input);
        String item = readString(input);
        int quantity = input.readInt();
        long unitCp = input.readLong();
        long actualCp = input.readLong();
        String container = readString(input);
        String rarity = readString(input);
        boolean cursed = input.readBoolean();
        String text = readString(input);
        String baseItemId = version >= 2 ? readString(input) : "";
        String magicSource = version >= 2 ? readString(input) : "";
        String curseId = version >= 2 ? readString(input) : "";
        return new LootLine(
                lineId, role, item, quantity, unitCp, actualCp, container, rarity, cursed, text,
                baseItemId, magicSource, curseId);
    }

    private static void writeSummary(DataOutputStream output, RewardSummary summary) throws IOException {
        output.writeLong(summary.normalActualCp());
        output.writeLong(summary.overstockActualCp());
        output.writeInt(summary.magicCount());
        output.writeInt(summary.rarities().size());
        for (String rarity : summary.rarities()) writeString(output, rarity);
    }

    private static RewardSummary readSummary(DataInputStream input) throws IOException {
        long normal = input.readLong();
        long overstock = input.readLong();
        int magicCount = input.readInt();
        List<String> rarities = readList(input, GenerationResultBinaryCodec::readString);
        return new RewardSummary(normal, overstock, magicCount, rarities);
    }

    private static void writeAudits(DataOutputStream output, List<AuditResult> audits) throws IOException {
        output.writeInt(audits.size());
        for (AuditResult audit : audits) {
            writeString(output, audit.name());
            output.writeBoolean(audit.passed());
            writeString(output, audit.detail());
        }
    }

    private static void writeString(DataOutputStream output, String value) throws IOException {
        byte[] bytes = (value == null ? "" : value).getBytes(StandardCharsets.UTF_8);
        output.writeInt(bytes.length);
        output.write(bytes);
    }

    private static String readString(DataInputStream input) throws IOException {
        int length = input.readInt();
        if (length < 0 || length > 16_777_216) throw new IOException("Invalid string length: " + length);
        return new String(input.readNBytes(length), StandardCharsets.UTF_8);
    }

    private static <T> List<T> readList(DataInputStream input, Reader<T> reader) throws IOException {
        int count = input.readInt();
        if (count < 0 || count > 1_000_000) throw new IOException("Invalid list length: " + count);
        List<T> result = new ArrayList<>(count);
        for (int index = 0; index < count; index++) result.add(reader.read(input));
        return List.copyOf(result);
    }

    @FunctionalInterface
    private interface Reader<T> {
        T read(DataInputStream input) throws IOException;
    }
}
