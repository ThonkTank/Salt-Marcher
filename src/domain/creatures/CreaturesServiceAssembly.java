package src.domain.creatures;

import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureEncounterCandidatesModel;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.CreatureLookupStatus;
import src.domain.creatures.published.CreatureReferenceApi;

public final class CreaturesServiceAssembly {

    private CreaturesServiceAssembly() {
    }

    public static Component create(CreatureCatalogPort catalogPort) {
        CreatureFilterOptionsModel filterOptions = new CreatureFilterOptionsModel();
        CreatureCatalogModel catalog = new CreatureCatalogModel();
        CreatureDetailModel detail = new CreatureDetailModel();
        CreatureEncounterCandidatesModel encounterCandidates = new CreatureEncounterCandidatesModel();
        CreaturesApplicationService application = new CreaturesApplicationService(
                catalogPort, filterOptions, catalog, detail, encounterCandidates);
        CreatureReferenceApi references = creatureId -> {
            if (creatureId <= 0L) {
                return new CreatureDetailResult(CreatureLookupStatus.NOT_FOUND, null);
            }
            try {
                var found = catalogPort.loadCreatureDetail(creatureId);
                return new CreatureDetailResult(
                        found == null ? CreatureLookupStatus.NOT_FOUND : CreatureLookupStatus.SUCCESS,
                        CreatureCatalogProjection.creatureDetail(found));
            } catch (IllegalStateException exception) {
                return new CreatureDetailResult(CreatureLookupStatus.STORAGE_ERROR, null);
            }
        };
        return new Component(application, references, filterOptions, catalog, detail, encounterCandidates);
    }

    public record Component(
            CreaturesApplicationService application,
            CreatureReferenceApi references,
            CreatureFilterOptionsModel filterOptions,
            CreatureCatalogModel catalog,
            CreatureDetailModel detail,
            CreatureEncounterCandidatesModel encounterCandidates
    ) {
    }
}
