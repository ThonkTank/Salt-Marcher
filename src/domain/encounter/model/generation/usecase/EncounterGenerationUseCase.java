package src.domain.encounter.model.generation.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.encounter.model.generation.model.EncounterGeneratedAlternative;
import src.domain.encounter.model.generation.model.EncounterGenerationRequest;
import src.domain.encounter.model.generation.model.EncounterGenerationResult;
import src.domain.encounter.model.reference.port.ApplicationEncounterCreatureCatalogPort;
import src.domain.encounter.model.reference.port.ApplicationEncounterTableCandidatePort;
import src.domain.encounter.model.reference.repository.EncounterCreatureRepository;
import src.domain.encounter.model.reference.repository.EncounterTableCandidateRepository;
import src.domain.encounter.model.session.repository.EncounterPartyFactsRepository;

public final class EncounterGenerationUseCase {

    private static final int SEARCH_LIMIT = 240;

    private final EncounterPartyFactsRepository party;
    private final EncounterCreatureRepository creatures;
    private final ApplicationEncounterCreatureCatalogPort creatureCatalog;
    private final @Nullable EncounterTableCandidateRepository encounterTables;
    private final @Nullable ApplicationEncounterTableCandidatePort tableCandidates;

    public EncounterGenerationUseCase(
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog
    ) {
        this(party, creatures, creatureCatalog, null, null);
    }

    public EncounterGenerationUseCase(
            EncounterPartyFactsRepository party,
            EncounterCreatureRepository creatures,
            ApplicationEncounterCreatureCatalogPort creatureCatalog,
            @Nullable EncounterTableCandidateRepository encounterTables,
            @Nullable ApplicationEncounterTableCandidatePort tableCandidates
    ) {
        this.party = Objects.requireNonNull(party, "party");
        this.creatures = Objects.requireNonNull(creatures, "creatures");
        this.creatureCatalog = Objects.requireNonNull(creatureCatalog, "creatureCatalog");
        this.encounterTables = encounterTables;
        this.tableCandidates = tableCandidates;
    }

    public EncounterGenerationResult execute(EncounterGenerationRequest request) {
        EncounterGenerationPreparationUseCase preparation = PrepareEncounterGenerationUseCase.prepare(
                party,
                creatures,
                creatureCatalog,
                encounterTables,
                tableCandidates,
                request,
                SEARCH_LIMIT);
        if (!preparation.success()) {
            return new EncounterGenerationResult(
                    false,
                    List.of(),
                    preparation.message(),
                    preparation.diagnostics(),
                    preparation.autoResolved(),
                    preparation.fallbackUsed());
        }
        List<EncounterGeneratedAlternative> generatedEncounters = new AssembleEncounterResultUseCase(creatures, creatureCatalog)
                .assemble(preparation.drafts(), request.alternativeCount());
        return new EncounterGenerationResult(
                true,
                generatedEncounters,
                preparation.message(),
                preparation.diagnostics(),
                preparation.autoResolved(),
                preparation.fallbackUsed());
    }
}
