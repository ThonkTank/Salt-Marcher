package src.view.leftbartabs.catalog;

import shell.api.InspectorSink;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.domain.creatures.CreaturesServiceAssembly;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.encounter.EncounterServiceAssembly;
import src.domain.encountertable.EncounterTableServiceAssembly;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.party.PartyServiceAssembly;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;

final class CatalogTestRuntime {

    private final CreaturesServiceAssembly.Component creatures;
    private final EncounterTableServiceAssembly.Component tables;
    private final EncounterServiceAssembly.Component encounter;
    private final WorldPlannerSnapshotModel worldPlanner;

    private CatalogTestRuntime(
            CreaturesServiceAssembly.Component creatures,
            EncounterTableServiceAssembly.Component tables,
            EncounterServiceAssembly.Component encounter,
            WorldPlannerSnapshotModel worldPlanner
    ) {
        this.creatures = creatures;
        this.tables = tables;
        this.encounter = encounter;
        this.worldPlanner = worldPlanner;
    }

    static CatalogTestRuntime create(
            CreatureCatalogPort creatureCatalog,
            EncounterTableCatalogPort encounterTables,
            WorldPlannerSnapshotModel worldPlanner
    ) {
        CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(creatureCatalog);
        EncounterTableServiceAssembly.Component tables = EncounterTableServiceAssembly.create(encounterTables);
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new SqlitePartyRosterRepository());
        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                creatures.application(), creatures.detail(), creatures.encounterCandidates(),
                tables.application(), tables.candidates(), worldPlanner,
                party.application(), party.activeParty(), party.activeComposition(),
                party.adventuringDaySummary(), party.mutation(), new SqliteEncounterPlanRepository());
        return new CatalogTestRuntime(creatures, tables, encounter, worldPlanner);
    }

    CatalogContribution contribution(InspectorSink inspector) {
        return new CatalogContribution(
                creatures.application(), tables.application(), encounter.application(),
                encounter.builderInputs(), creatures.filterOptions(), creatures.catalog(), creatures.detail(),
                tables.catalog(), encounter.tuningPreview(), worldPlanner, inspector);
    }

    src.domain.encounter.published.EncounterBuilderInputsModel builderInputs() {
        return encounter.builderInputs();
    }
}
