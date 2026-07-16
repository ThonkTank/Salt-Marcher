package src.data.sessiongeneration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.Test;
import src.domain.sessiongeneration.GenerationRequest;
import src.domain.sessiongeneration.GenerationResult;
import src.domain.sessiongeneration.SheetV1GenerationEngine;

class SessionGenerationPersistenceTest {

    @Test
    void binaryCodecRoundTripsTheCompleteFormulaMasterResult() {
        GenerationResultBinaryCodec codec = new GenerationResultBinaryCodec();
        GenerationResult generated = engine().generate(request(), 91L);

        GenerationResult decoded = codec.decode(codec.encode(generated));

        assertEquals(generated, decoded);
    }

    @Test
    void binaryCodecStillReadsVersionOneWithoutStructuredMagicMetadata() {
        GenerationResultBinaryCodec codec = new GenerationResultBinaryCodec();
        GenerationResult generated = engine().generate(request(), 92L);

        GenerationResult decoded = codec.decode(codec.encodeVersion1(generated));

        assertEquals(generated.encounters(), decoded.encounters());
        assertEquals(generated.formattedText(), decoded.formattedText());
        assertTrue(decoded.treasures().stream().flatMap(treasure -> treasure.loot().stream())
                .allMatch(line -> line.baseLootItemId().isBlank()
                        && line.magicSource().isBlank() && line.curseId().isBlank()));
    }

    @Test
    void sqliteRepositoryAllocatesAndReloadsImmutableRuns() {
        SqliteSessionGenerationRepository repository = new SqliteSessionGenerationRepository();
        long generationId = repository.nextGenerationId();
        GenerationResult generated = engine().generate(request(), generationId);

        repository.save(generated);

        assertEquals(generated, repository.load(generationId).orElseThrow());
        assertEquals(generationId + 1L, repository.nextGenerationId());
        assertThrows(IllegalStateException.class, () -> repository.save(generated));
    }

    private static SheetV1GenerationEngine engine() {
        return new SheetV1GenerationEngine(new TsvSessionGenerationCatalog());
    }

    private static GenerationRequest request() {
        return GenerationRequest.sheetV1(Map.of(3, 2, 4, 2), new BigDecimal("0.6"), 3, 179974L);
    }
}
