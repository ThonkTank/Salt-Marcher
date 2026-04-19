package src.view.creatures;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.NavigationGroupSpec;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import shell.api.ShellTabMode;
import shell.api.ShellTabSpec;
import shell.api.ShellViewContribution;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.api.CreatureDetail;
import src.view.creatures.View.CreatureInspectorContentFactory;
import src.view.creatures.View.CreaturesNavigationGraphic;
import src.view.creatures.View.CreaturesView;
import src.view.creatures.ViewModel.CreatureInspectorPublisher;
import src.view.creatures.ViewModel.CreatureInspectorViewMapper;
import src.view.creatures.ViewModel.CreaturesCatalogViewModel;

/**
 * Read-only creatures catalog tab root.
 */
public final class CreaturesViewContribution implements ShellViewContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public CreaturesViewContribution() {
    }

    @Override
    @SuppressWarnings({"rawtypes", "unchecked"})
    public ShellContributionSpec registrationSpec() {
        return new ShellTabSpec(
                new ContributionKey("creatures"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                navigationGraphicSupplier(),
                ShellTabMode.RUNTIME
        );
    }

    @Override
    public ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        CreaturesCatalogViewModel viewModel = new CreaturesCatalogViewModel(
                creatures,
                new CreatureInspectorShellAdapter(runtimeContext.inspector()));
        viewModel.initialize();
        CreaturesView view = new CreaturesView(viewModel);
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Creatures";
            }

            @Override
            public String getNavigationLabel() {
                return "Creatures";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(
                        ShellSlot.COCKPIT_CONTROLS, view.controls(),
                        ShellSlot.COCKPIT_MAIN, view.workspace()
                );
            }
        };
    }

    private static Supplier<Node> navigationGraphicSupplier() {
        return CreaturesNavigationGraphic::create;
    }

    private static final class CreatureInspectorShellAdapter implements CreatureInspectorPublisher {

        private final InspectorSink inspector;

        private CreatureInspectorShellAdapter(InspectorSink inspector) {
            this.inspector = Objects.requireNonNull(inspector, "inspector");
        }

        @Override
        public boolean isShowing(Object inspectorKey) {
            return inspector.isShowing(inspectorKey);
        }

        @Override
        public void show(CreatureDetail detail, Object inspectorKey) {
            inspector.push(new InspectorEntrySpec(
                    detail.name(),
                    inspectorKey,
                    () -> CreatureInspectorContentFactory.build(CreatureInspectorViewMapper.toViewData(detail)),
                    null
            ));
        }
    }
}
