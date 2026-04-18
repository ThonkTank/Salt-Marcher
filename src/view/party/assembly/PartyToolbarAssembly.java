package src.view.party.assembly;

import javafx.scene.Node;
import shell.api.ShellRuntimeContext;
import shell.api.ShellScreen;
import shell.api.ShellSlot;
import src.domain.party.PartyApplicationService;
import src.view.party.View.PartyToolbarView;
import src.view.party.ViewModel.PartyToolbarViewModel;

import java.util.Map;
import java.util.Objects;

public final class PartyToolbarAssembly {

    private final PartyToolbarViewModel viewModel;
    private final PartyToolbarView view;

    private PartyToolbarAssembly(PartyToolbarViewModel viewModel, PartyToolbarView view) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
        this.view = Objects.requireNonNull(view, "view");
    }

    public static ShellScreen createScreen(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        PartyApplicationService party = runtimeContext.services().require(PartyApplicationService.class);
        PartyToolbarViewModel viewModel = new PartyToolbarViewModel(party);
        PartyToolbarView view = new PartyToolbarView(viewModel);
        PartyToolbarAssembly assembly = new PartyToolbarAssembly(viewModel, view);
        assembly.initialize();
        return assembly.screen();
    }

    private void initialize() {
        viewModel.initialize();
    }

    private ShellScreen screen() {
        return new ShellScreen() {
            @Override
            public String getTitle() {
                return "Party";
            }

            @Override
            public Map<ShellSlot, Node> slotContent() {
                return Map.of(ShellSlot.TOP_BAR, view.node());
            }
        };
    }
}
