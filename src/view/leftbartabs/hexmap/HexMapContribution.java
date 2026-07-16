package src.view.leftbartabs.hexmap;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import src.domain.hex.HexEditorApplicationService;
import src.domain.hex.HexTravelApplicationService;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;

public final class HexMapContribution implements ShellContribution {

    private final HexEditorApplicationService editor;
    private final HexTravelApplicationService travel;
    private final HexEditorModel editorModel;
    private final HexTravelModel travelModel;

    public HexMapContribution(
            HexEditorApplicationService editor,
            HexTravelApplicationService travel,
            HexEditorModel editorModel,
            HexTravelModel travelModel
    ) {
        this.editor = Objects.requireNonNull(editor, "editor");
        this.travel = Objects.requireNonNull(travel, "travel");
        this.editorModel = Objects.requireNonNull(editorModel, "editorModel");
        this.travelModel = Objects.requireNonNull(travelModel, "travelModel");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("hex-map"),
                new NavigationGroupSpec("world", "World", 20),
                30,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/hexmap/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        return new HexMapBinder(editor, travel, editorModel, travelModel).bind();
    }
}
