package features.world.hexmap.editorcontrols;

import features.world.hexmap.editorcontrols.input.ComposeInput;
import features.world.hexmap.ui.editor.controls.MapEditorControls;
import features.world.hexmap.ui.editor.panes.ToolSettingsPane;

import java.util.Objects;

/**
 * Canonical hexmap editor-controls seam that composes map selection, tool
 * selection, and tool settings into one editor-facing handoff.
 */
@SuppressWarnings("unused")
public final class EditorcontrolsObject {

    public ComposeInput.ComposedEditorControlsInput compose(ComposeInput input) {
        ComposeInput resolvedInput = Objects.requireNonNull(input, "input");

        MapEditorControls controls = new MapEditorControls();
        ToolSettingsPane toolSettingsPane = new ToolSettingsPane();
        toolSettingsPane.setActiveTool(controls.getActiveTool());

        controls.setOnToolChanged(tool -> {
            toolSettingsPane.setActiveTool(tool);
            resolvedInput.onToolChanged().accept(tool);
        });
        controls.setOnMapSelected(resolvedInput.onMapSelected());
        controls.setOnNewMapRequested(resolvedInput.onNewMapRequested());
        controls.setOnEditMapRequested(request ->
                resolvedInput.onEditMapRequested().accept(
                        new ComposeInput.MapActionRequestInput(request.map(), request.anchor())));

        return new ComposeInput.ComposedEditorControlsInput(
                controls,
                toolSettingsPane,
                controls::getActiveTool,
                toolSettingsPane::getActiveTerrainType,
                controls::setMaps,
                controls::selectMap);
    }
}
