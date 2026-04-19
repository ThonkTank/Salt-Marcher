package src.view.creatures.assembly;

import javafx.scene.Node;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
import src.view.creatures.View.CreaturesNavigationGraphic;
import src.view.creatures.View.CreaturesView;
import src.view.creatures.ViewModel.CreaturesCatalogViewModel;

import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

public final class CreaturesAssembly {

    private final CreaturesView view;

    private CreaturesAssembly(CreaturesView view) {
        this.view = Objects.requireNonNull(view, "view");
    }

    public static ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        CreaturesApplicationService creatures = runtimeContext.services().require(CreaturesApplicationService.class);
        CreaturesCatalogViewModel viewModel = new CreaturesCatalogViewModel(
                creatures,
                new CreatureInspectorShellAdapter(runtimeContext.inspector()));
        viewModel.initialize();
        CreaturesView view = new CreaturesView(viewModel);
        return new CreaturesAssembly(view).screen();
    }

    public static Supplier navigationGraphicSupplier() {
        return CreaturesNavigationGraphic::create;
    }

    private ShellScreen screen() {
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

}
