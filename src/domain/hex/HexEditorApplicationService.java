package src.domain.hex;

import java.util.Objects;
import src.domain.hex.model.map.usecase.CreateHexMapUseCase;
import src.domain.hex.model.map.usecase.LoadHexEditorUseCase;
import src.domain.hex.model.map.usecase.PaintHexTerrainUseCase;
import src.domain.hex.model.map.usecase.RenameHexMapUseCase;
import src.domain.hex.model.map.usecase.SaveHexMarkerUseCase;
import src.domain.hex.model.map.usecase.SelectHexMapUseCase;
import src.domain.hex.model.map.usecase.SelectHexTileUseCase;
import src.domain.hex.model.map.usecase.SetHexEditorToolUseCase;
import src.domain.hex.model.map.usecase.UpdateHexMapUseCase;
import src.domain.hex.published.CreateHexMapCommand;
import src.domain.hex.published.LoadHexEditorCommand;
import src.domain.hex.published.PaintHexTerrainCommand;
import src.domain.hex.published.RenameHexMapCommand;
import src.domain.hex.published.SaveHexMarkerCommand;
import src.domain.hex.published.SelectHexMapCommand;
import src.domain.hex.published.SelectHexTileCommand;
import src.domain.hex.published.SetHexEditorToolCommand;
import src.domain.hex.published.UpdateHexMapCommand;

public final class HexEditorApplicationService {

    private final CreateHexMapUseCase createMapUseCase;
    private final LoadHexEditorUseCase loadEditorUseCase;
    private final SelectHexMapUseCase selectMapUseCase;
    private final UpdateHexMapUseCase updateMapUseCase;
    private final RenameHexMapUseCase renameMapUseCase;
    private final SelectHexTileUseCase selectTileUseCase;
    private final PaintHexTerrainUseCase paintTerrainUseCase;
    private final SaveHexMarkerUseCase saveMarkerUseCase;
    private final SetHexEditorToolUseCase setToolUseCase;

    public HexEditorApplicationService(
            CreateHexMapUseCase createMapUseCase,
            LoadHexEditorUseCase loadEditorUseCase,
            SelectHexMapUseCase selectMapUseCase,
            UpdateHexMapUseCase updateMapUseCase,
            RenameHexMapUseCase renameMapUseCase,
            SelectHexTileUseCase selectTileUseCase,
            PaintHexTerrainUseCase paintTerrainUseCase,
            SaveHexMarkerUseCase saveMarkerUseCase,
            SetHexEditorToolUseCase setToolUseCase
    ) {
        this.createMapUseCase = Objects.requireNonNull(createMapUseCase, "createMapUseCase");
        this.loadEditorUseCase = Objects.requireNonNull(loadEditorUseCase, "loadEditorUseCase");
        this.selectMapUseCase = Objects.requireNonNull(selectMapUseCase, "selectMapUseCase");
        this.updateMapUseCase = Objects.requireNonNull(updateMapUseCase, "updateMapUseCase");
        this.renameMapUseCase = Objects.requireNonNull(renameMapUseCase, "renameMapUseCase");
        this.selectTileUseCase = Objects.requireNonNull(selectTileUseCase, "selectTileUseCase");
        this.paintTerrainUseCase = Objects.requireNonNull(paintTerrainUseCase, "paintTerrainUseCase");
        this.saveMarkerUseCase = Objects.requireNonNull(saveMarkerUseCase, "saveMarkerUseCase");
        this.setToolUseCase = Objects.requireNonNull(setToolUseCase, "setToolUseCase");
    }

    public void createMap(CreateHexMapCommand command) {
        createMapUseCase.execute(command.displayName(), command.radius());
    }

    public void loadEditor(LoadHexEditorCommand command) {
        Objects.requireNonNull(command, "command");
        loadEditorUseCase.execute();
    }

    public void selectMap(SelectHexMapCommand command) {
        selectMapUseCase.execute(command.mapId());
    }

    public void updateMap(UpdateHexMapCommand command) {
        updateMapUseCase.execute(
                command.mapId(),
                command.displayName(),
                command.radius(),
                command.confirmDestructiveShrink());
    }

    public void renameMap(RenameHexMapCommand command) {
        renameMapUseCase.execute(command.mapId(), command.displayName());
    }

    public void selectTile(SelectHexTileCommand command) {
        selectTileUseCase.execute(command.mapId(), command.q(), command.r());
    }

    public void paintTerrain(PaintHexTerrainCommand command) {
        paintTerrainUseCase.execute(command.mapId(), command.q(), command.r(), command.terrain());
    }

    public void saveMarker(SaveHexMarkerCommand command) {
        saveMarkerUseCase.execute(
                command.mapId(),
                command.markerId(),
                command.q(),
                command.r(),
                command.name(),
                command.type(),
                command.note());
    }

    public void setActiveTool(SetHexEditorToolCommand command) {
        setToolUseCase.execute(command.tool(), command.terrain());
    }
}
