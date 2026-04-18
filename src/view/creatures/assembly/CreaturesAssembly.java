package src.view.creatures.assembly;

import javafx.scene.Node;
import javafx.scene.shape.Line;
import javafx.scene.shape.Rectangle;
import static shell.api.NavigationGraphicSupport.strokeLine;
import static shell.api.NavigationGraphicSupport.wrap;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.domain.creatures.CreaturesApplicationService;
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
        return CreaturesAssembly::navigationGraphic;
    }

    private static Node navigationGraphic() {
        Rectangle page = new Rectangle(4, 2.5, 10, 13);
        page.getStyleClass().add("nav-icon-stroke");
        page.setArcWidth(2);
        page.setArcHeight(2);
        page.setFill(null);

        Line row1 = strokeLine(6, 6, 12, 6);
        Line row2 = strokeLine(6, 9, 12, 9);
        Line row3 = strokeLine(6, 12, 12, 12);
        return wrap(page, row1, row2, row3);
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
