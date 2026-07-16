package features.hex.adapter.javafx.hexmap;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import features.hex.api.HexEditorApi;
import features.hex.api.HexTravelApi;
import features.hex.api.HexEditorModel;
import features.hex.api.HexTravelModel;

public final class HexMapContribution implements ShellContribution {

    private final HexEditorApi editor;
    private final HexTravelApi travel;
    private final HexEditorModel editorModel;
    private final HexTravelModel travelModel;

    public HexMapContribution(
            HexEditorApi editor,
            HexTravelApi travel,
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
