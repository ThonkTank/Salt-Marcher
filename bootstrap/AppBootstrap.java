package bootstrap;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.jspecify.annotations.Nullable;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellStateTabSpec;
import shell.api.ShellTopBarSpec;
import shell.host.AppShell;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.data.encounter.repository.SqliteEncounterPlanRepository;
import src.data.encountertable.query.SqliteEncounterTableCatalogAdapter;
import src.data.hex.repository.SqliteHexMapRepository;
import src.data.party.repository.SqlitePartyRosterRepository;
import src.data.sessionplanner.repository.SqliteSessionPlanRepository;
import src.data.sessiongeneration.TsvSessionGenerationCatalog;
import src.data.sessiongeneration.SqliteSessionGenerationRepository;
import src.data.worldplanner.repository.SqliteWorldPlannerRepository;
import src.domain.creatures.CreaturesServiceAssembly;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;
import src.domain.dungeon.DungeonServiceAssembly;
import src.domain.encounter.EncounterServiceAssembly;
import src.domain.encountertable.EncounterTableServiceAssembly;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;
import src.domain.hex.HexServiceAssembly;
import src.domain.party.PartyServiceAssembly;
import src.domain.sessionplanner.SessionPlannerServiceAssembly;
import src.domain.sessiongeneration.SessionGenerationApplicationService;
import src.domain.sessiongeneration.SheetV1GenerationEngine;
import src.domain.worldplanner.WorldPlannerApplicationService;
import src.domain.worldplanner.WorldPlannerReferenceAssembly;
import src.domain.worldplanner.WorldPlannerServiceAssembly;
import src.domain.worldplanner.published.WorldPlannerSnapshotModel;
import src.features.dungeon.runtime.DungeonEditorRuntimeDependencies;
import src.view.dropdowns.adventuringday.AdventuringDayTopBarContribution;
import src.view.dropdowns.party.PartyTopBarContribution;
import src.view.leftbartabs.catalog.CatalogContribution;
import src.view.leftbartabs.dungeoneditor.DungeonEditorContribution;
import src.view.leftbartabs.dungeontravel.DungeonTravelContribution;
import src.view.leftbartabs.hexmap.HexMapContribution;
import src.view.leftbartabs.sessionplanner.SessionPlannerContribution;
import src.view.leftbartabs.worldplanner.WorldPlannerContribution;
import src.view.statetabs.encounter.EncounterStateContribution;
import src.view.statetabs.travel.TravelStateContribution;

/** Explicit production composition root. */
public final class AppBootstrap {

    public AppShell createShell() {
        AppShell shell = new AppShell();
        Components components = createComponents();
        List<ResolvedContribution> contributions = bindContributions(shell, components);
        contributions.stream()
                .sorted(Comparator.comparing(contribution -> contribution.spec().key().value()))
                .forEach(contribution -> register(shell, contribution));
        ShellLeftBarTabSpec startup = resolveStartupView(contributions);
        if (startup != null) {
            shell.navigateTo(startup.key());
        }
        return shell;
    }

    private Components createComponents() {
        CreatureCatalogPort creatureCatalog = new SqliteCreatureCatalogQueryAdapter();
        EncounterTableCatalogPort encounterTableCatalog = new SqliteEncounterTableCatalogAdapter();
        CreaturesServiceAssembly.Component creatures = CreaturesServiceAssembly.create(creatureCatalog);
        EncounterTableServiceAssembly.Component encounterTables =
                EncounterTableServiceAssembly.create(encounterTableCatalog);
        PartyServiceAssembly.Component party = PartyServiceAssembly.create(new SqlitePartyRosterRepository());

        WorldPlannerServiceAssembly worldAssembly = new WorldPlannerServiceAssembly(
                new SqliteWorldPlannerRepository(),
                WorldPlannerReferenceAssembly.catalogReferences(creatures.references(), encounterTables.references()));
        WorldPlannerApplicationService worldApplication = worldAssembly.createApplicationService();
        WorldPlannerSnapshotModel worldSnapshot = worldAssembly.snapshotModel();

        EncounterServiceAssembly.Component encounter = EncounterServiceAssembly.create(
                creatures.application(),
                creatures.detail(),
                creatures.encounterCandidates(),
                encounterTables.application(),
                encounterTables.candidates(),
                worldSnapshot,
                party.application(),
                party.activeParty(),
                party.activeComposition(),
                party.adventuringDaySummary(),
                party.mutation(),
                new SqliteEncounterPlanRepository());
        SessionGenerationApplicationService sessionGeneration = new SessionGenerationApplicationService(
                new SheetV1GenerationEngine(new TsvSessionGenerationCatalog()),
                new SqliteSessionGenerationRepository());

        DungeonServiceAssembly.Component dungeon = DungeonServiceAssembly.create(
                new SqliteDungeonMapRepository(),
                party.activeParty(),
                party.travelPositions(),
                party.application(),
                party.mutation());
        HexServiceAssembly hex = new HexServiceAssembly(
                new SqliteHexMapRepository(), party.travelPositions(), party.application());
        SessionPlannerServiceAssembly session = new SessionPlannerServiceAssembly(
                new SqliteSessionPlanRepository(),
                party.application(),
                party.activeParty(),
                party.adventuringDayCalculation(),
                encounter.application(),
                encounter.savedPlans(),
                encounter.planBudget(),
                worldSnapshot,
                sessionGeneration);
        return new Components(
                creatures, encounterTables, party, worldApplication, worldSnapshot,
                encounter, dungeon, hex, session);
    }

    private List<ResolvedContribution> bindContributions(AppShell shell, Components components) {
        var creatures = components.creatures();
        var tables = components.encounterTables();
        var party = components.party();
        var encounter = components.encounter();
        var dungeon = components.dungeon();
        var hex = components.hex();
        var session = components.session();
        var inspector = shell.inspector();
        DungeonEditorRuntimeDependencies dungeonEditorDependencies = new DungeonEditorRuntimeDependencies(
                new DungeonEditorRuntimeDependencies.CompatibilityReadbackModels(
                        dungeon.editorControls(), dungeon.editorMapSurface(), dungeon.editorState()),
                dungeon.editor());

        List<ShellContribution> manifest = List.of(
                new AdventuringDayTopBarContribution(
                        party.adventuringDaySummary(), party.adventuringDayCalculation(), party.application()),
                new PartyTopBarContribution(
                        party.application(), party.snapshot(), party.adventuringDaySummary(), party.mutation()),
                new CatalogContribution(
                        creatures.application(), tables.application(), encounter.application(),
                        encounter.builderInputs(), creatures.filterOptions(), creatures.catalog(), creatures.detail(),
                        tables.catalog(), encounter.tuningPreview(), components.worldSnapshot(), inspector),
                new DungeonEditorContribution(dungeonEditorDependencies),
                new DungeonTravelContribution(dungeon.travel(), dungeon.mapCatalog(), dungeon.travelModel()),
                new HexMapContribution(
                        hex.editorApplication(), hex.travelApplication(), hex.editorModel(), hex.travelModel()),
                new SessionPlannerContribution(
                        session.application(), session.currentSessionModel(), session.catalogModel(),
                        session.participantsModel(), session.sceneTimelineModel(), session.statePanelModel(),
                        session.generationModel()),
                new WorldPlannerContribution(
                        components.worldApplication(), encounter.application(), components.worldSnapshot(),
                        creatures.catalog(), tables.catalog(), inspector),
                new EncounterStateContribution(
                        creatures.detail(), creatures.application(), encounter.state(), encounter.application(),
                        components.worldApplication(), inspector),
                new TravelStateContribution(hex.travelModel()));

        List<ResolvedContribution> resolved = new ArrayList<>(manifest.size());
        for (ShellContribution contribution : manifest) {
            resolved.add(new ResolvedContribution(contribution.registrationSpec(), contribution.bind()));
        }
        return List.copyOf(resolved);
    }

    private void register(AppShell shell, ResolvedContribution contribution) {
        ShellContributionSpec spec = contribution.spec();
        if (spec instanceof ShellLeftBarTabSpec leftBarTabSpec) {
            shell.registerLeftBarTab(leftBarTabSpec, contribution.binding());
        } else if (spec instanceof ShellTopBarSpec topBarSpec) {
            shell.registerTopBar(topBarSpec, contribution.binding());
        } else if (spec instanceof ShellStateTabSpec stateTabSpec) {
            shell.registerStateTab(stateTabSpec, contribution.binding());
        } else {
            throw new IllegalStateException("Unsupported shell contribution type: " + spec.getClass().getName());
        }
    }

    private @Nullable ShellLeftBarTabSpec resolveStartupView(List<ResolvedContribution> contributions) {
        ShellLeftBarTabSpec startup = null;
        for (ResolvedContribution contribution : contributions) {
            if (!(contribution.spec() instanceof ShellLeftBarTabSpec leftBar) || !leftBar.defaultLanding()) {
                continue;
            }
            if (startup != null) {
                throw new IllegalStateException("Multiple shell left-bar tabs declare defaultLanding=true.");
            }
            startup = leftBar;
        }
        if (startup != null) {
            return startup;
        }
        return contributions.stream()
                .map(ResolvedContribution::spec)
                .filter(ShellLeftBarTabSpec.class::isInstance)
                .map(ShellLeftBarTabSpec.class::cast)
                .sorted(Comparator
                        .comparingInt((ShellLeftBarTabSpec tab) -> tab.navigationGroup().order())
                        .thenComparing(tab -> tab.navigationGroup().label(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparingInt(ShellLeftBarTabSpec::viewOrder)
                        .thenComparing(tab -> tab.key().value()))
                .findFirst()
                .orElse(null);
    }

    private record Components(
            CreaturesServiceAssembly.Component creatures,
            EncounterTableServiceAssembly.Component encounterTables,
            PartyServiceAssembly.Component party,
            WorldPlannerApplicationService worldApplication,
            WorldPlannerSnapshotModel worldSnapshot,
            EncounterServiceAssembly.Component encounter,
            DungeonServiceAssembly.Component dungeon,
            HexServiceAssembly hex,
            SessionPlannerServiceAssembly session
    ) {
    }

    private record ResolvedContribution(ShellContributionSpec spec, ShellBinding binding) {
    }

}
