package features.sessiongeneration.domain.generation;

import features.sessiongeneration.domain.catalog.GenerationCatalog.CatalogSnapshot;
import features.sessiongeneration.domain.generation.GeneratedRun.Audit;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

public final class SessionGenerationEngine {

    public static final String ENGINE_VERSION = "saltmarcher-v1";

    private final SessionContextStage sessionStage = new SessionContextStage();
    private final EncounterGenerationStage encounterStage = new EncounterGenerationStage();
    private final TreasurePlanningStage treasureStage = new TreasurePlanningStage();
    private final LootGenerationStage lootStage = new LootGenerationStage();
    private final PackingStage packingStage = new PackingStage();
    private final GenerationOutputStage outputStage = new GenerationOutputStage();

    public GeneratedRun generate(GenerationInput input, CatalogSnapshot catalog) {
        Objects.requireNonNull(input, "input");
        Objects.requireNonNull(catalog, "catalog");
        SessionContextStage.Result session = sessionStage.calculate(input, catalog);
        EncounterGenerationStage.Result encounters = encounterStage.generate(input, catalog, session.context());
        var treasures = treasureStage.plan(session.context(), encounters.encounters(), catalog, input.seed());
        KeyedEntropy entropy = new KeyedEntropy(input.seed());
        var loot = lootStage.generate(
                session.context(), session.magicRarities(), treasures, catalog, entropy);
        var packing = packingStage.pack(loot, catalog.containers(), entropy);
        var rewards = outputStage.summarize(treasures, loot);
        String output = outputStage.format(encounters.encounters(), treasures, loot, rewards);
        GeneratedRun provisional = new GeneratedRun(
                runId(input, catalog.contentHash()), ENGINE_VERSION, catalog.version(), catalog.contentHash(),
                input.seed(), input.party(), session.context(), encounters.targets(), encounters.encounters(),
                treasures, loot, packing, rewards, output, List.of());
        List<Audit> audits = outputStage.audit(provisional, encounters.completeCoverage());
        return new GeneratedRun(
                provisional.runId(), provisional.engineVersion(), provisional.catalogVersion(),
                provisional.catalogContentHash(), provisional.seed(), provisional.party(), provisional.session(),
                provisional.encounterTargets(), provisional.encounters(), provisional.treasures(), provisional.loot(),
                provisional.packing(), provisional.rewards(), provisional.formattedText(), audits);
    }

    private static String runId(GenerationInput input, String catalogHash) {
        StringBuilder canonical = new StringBuilder(ENGINE_VERSION).append('|').append(catalogHash)
                .append('|').append(input.seed()).append('|').append(input.adventureDayFraction().stripTrailingZeros())
                .append('|').append(input.encounterCount().isPresent() ? input.encounterCount().getAsInt() : "auto");
        input.party().forEach(entry -> canonical.append('|').append(entry.level()).append(':').append(entry.players()));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
