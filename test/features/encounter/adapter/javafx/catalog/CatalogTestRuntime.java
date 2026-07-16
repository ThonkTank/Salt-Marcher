package features.encounter.adapter.javafx.catalog;

import shell.api.InspectorSink;
import features.encounter.adapter.sqlite.repository.SqliteEncounterPlanRepository;
import features.party.adapter.sqlite.repository.SqlitePartyRosterRepository;
import features.creatures.CreaturesServiceAssembly;
import features.creatures.domain.catalog.port.CreatureCatalogPort;
import features.encounter.EncounterServiceAssembly;
import features.encountertable.EncounterTableServiceAssembly;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;
import features.party.PartyServiceAssembly;
import features.worldplanner.api.WorldPlannerSnapshotModel;

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

    features.encounter.api.EncounterBuilderInputsModel builderInputs() {
        return encounter.builderInputs();
    }
}
