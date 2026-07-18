package features.sessiongeneration.domain.generation;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.function.BiConsumer;

/** Canonical semantic fingerprint for normalized persisted generation content. */
public final class GenerationContentFingerprint {

    private GenerationContentFingerprint() {
    }

    public static String v1(GeneratedRun run) {
        Objects.requireNonNull(run, "run");
        CanonicalWriter writer = new CanonicalWriter();
        writer.text("session-generation-content-fingerprint");
        writer.text("v1");
        writer.text(run.runId());
        writer.text(run.engineVersion());
        writer.text(run.catalogVersion());
        writer.text(run.catalogContentHash());
        writer.integer(run.seed());
        writer.list(run.party(), (value, output) -> {
            output.integer(value.level());
            output.integer(value.players());
        });
        GeneratedRun.SessionContext session = run.session();
        writer.integer(session.partyCount());
        writer.decimal(session.adventureDayFraction());
        writer.integer(session.encounterCount());
        writer.integer(session.dayXpBudget());
        writer.integer(session.sessionXpTarget());
        writer.decimal(session.averageLevel());
        writer.integer(session.normalBudgetCp());
        writer.integer(session.overstockBudgetCp());
        writer.integer(session.nonMagicSlots());
        writer.integer(session.normalMagic());
        writer.integer(session.overstockMagic());
        writer.integer(session.treasureCount());
        writer.list(run.encounterTargets(), (value, output) -> {
            output.integer(value.encounterNumber());
            output.integer(value.targetXp());
        });
        writer.list(run.encounters(), (value, output) -> {
            output.integer(value.encounterNumber());
            output.integer(value.targetXp());
            output.integer(value.adjustedXp());
            output.text(value.difficulty().name());
            output.text(value.candidateId());
            output.text(value.monsterSummary());
            output.integer(value.monsterCount());
            output.decimal(value.multiplier());
            output.integer(value.maxChallengeCode());
            output.decimal(value.bossScore());
            output.list(value.blocks(), (block, blockOutput) -> {
                blockOutput.text(block.id());
                blockOutput.text(block.role().name());
                blockOutput.integer(block.challengeCode());
                blockOutput.text(block.challengeLabel());
                blockOutput.integer(block.unitXp());
                blockOutput.integer(block.quantity());
            });
        });
        writer.list(run.treasures(), (value, output) -> {
            output.integer(value.treasureId());
            output.text(value.stockClass().name());
            output.text(value.channel().name());
            output.integer(value.anchorEncounterNumber());
            output.text(value.theme());
            output.text(value.magicType());
            output.integer(value.targetCp());
            output.integer(value.nonMagicSlots());
            output.integer(value.magicSlots());
        });
        writer.list(run.loot(), (value, output) -> {
            output.integer(value.lineId());
            output.integer(value.treasureId());
            output.text(value.role().name());
            output.text(value.itemId());
            output.text(value.text());
            output.integer(value.quantity());
            output.integer(value.unitCp());
            output.integer(value.actualCp());
            output.decimal(value.totalCapacity());
            output.text(value.allowedContainers());
            output.text(value.magicRarity());
            output.bool(value.cursed());
        });
        writer.list(run.packing(), (value, output) -> {
            output.integer(value.lineId());
            output.integer(value.treasureId());
            output.text(value.containerType());
            output.integer(value.containerCount());
            output.text(value.containerId());
            output.bool(value.valid());
        });
        writer.integer(run.rewards().normalActualCp());
        writer.integer(run.rewards().overstockActualCp());
        writer.integer(run.rewards().magicCount());
        writer.list(run.audits(), (value, output) -> {
            output.text(value.code());
            output.text(value.status().name());
            output.text(value.detail());
        });
        return "v1:" + writer.finish();
    }

    private static final class CanonicalWriter {
        private final MessageDigest digest;

        private CanonicalWriter() {
            try {
                digest = MessageDigest.getInstance("SHA-256");
            } catch (NoSuchAlgorithmException exception) {
                throw new IllegalStateException("SHA-256 unavailable", exception);
            }
        }

        String finish() {
            return HexFormat.of().formatHex(digest.digest());
        }

        void text(String value) {
            byte[] normalized = normalizeText(value).getBytes(StandardCharsets.UTF_8);
            writeInt(normalized.length);
            digest.update(normalized);
        }

        void decimal(BigDecimal value) {
            BigDecimal normalized = Objects.requireNonNull(value, "decimal").stripTrailingZeros();
            text(normalized.signum() == 0 ? "0" : normalized.toPlainString());
        }

        void integer(long value) {
            for (int shift = Long.SIZE - Byte.SIZE; shift >= 0; shift -= Byte.SIZE) {
                digest.update((byte) (value >>> shift));
            }
        }

        void bool(boolean value) {
            digest.update((byte) (value ? 1 : 0));
        }

        <T> void list(List<T> values, BiConsumer<T, CanonicalWriter> encoder) {
            List<T> safeValues = List.copyOf(values);
            writeInt(safeValues.size());
            safeValues.forEach(value -> encoder.accept(value, this));
        }

        private static String normalizeText(String value) {
            return Objects.requireNonNullElse(value, "").replace("\r\n", "\n").replace('\r', '\n');
        }

        private void writeInt(int value) {
            for (int shift = Integer.SIZE - Byte.SIZE; shift >= 0; shift -= Byte.SIZE) {
                digest.update((byte) (value >>> shift));
            }
        }
    }
}
