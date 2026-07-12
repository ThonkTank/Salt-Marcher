package src.view.leftbartabs.dungeoneditor;

import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import javax.imageio.ImageIO;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.image.PixelReader;
import javafx.scene.image.WritableImage;
import javafx.scene.layout.HBox;
import javafx.stage.Stage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.DungeonServiceContribution;
import src.domain.dungeon.DungeonTravelRuntimeApplicationService;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyDungeonTravelLocationSnapshot;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelTile;
import src.view.leftbartabs.dungeontravel.DungeonTravelContribution;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.assertEquals;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.assertTrue;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.bindHarness;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.button;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.click;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.createMapThroughControls;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.renderSurfaceCellOriginsWithZ;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.selectMap;

@TestMethodOrder(MethodOrderer.MethodName.class)
public final class DungeonMapRenderParitySnapshotHarness {

    private static final String OWNER = "DungeonMapRenderParitySnapshotHarness";
    private static final List<String> RESULTS = new java.util.ArrayList<>();
    private static DungeonEditorHarnessPublicationSupport.ResultPublicationLock resultLock;

    @BeforeAll
    static void clearResults() throws Exception {
        resultLock = DungeonEditorHarnessPublicationSupport.lockResults();
        DungeonEditorHarnessPublicationSupport.clearResults();
    }

    @AfterEach
    void cleanupWindows() throws Exception {
        DungeonEditorHarnessPublicationSupport.cleanupRouteProofWindows();
    }

    @AfterAll
    static void writeResults() throws Exception {
        try {
            DungeonEditorHarnessPublicationSupport.writeResults(RESULTS);
            DungeonEditorHarnessPublicationSupport.shutdownFx();
        } finally {
            if (resultLock != null) {
                resultLock.close();
            }
        }
    }

    @Test
    void DE_IMG_001() throws Exception {
        DungeonEditorHarnessPublicationSupport.runOnFxThread(
                () -> verifyEditorRenderSnapshotParity(RESULTS));
    }

    @Test
    void DE_IMG_002() throws Exception {
        DungeonEditorHarnessPublicationSupport.runOnFxThread(
                () -> verifyEditorPreviewRenderSnapshotParity(RESULTS));
    }

    @Test
    void DT_IMG_001() throws Exception {
        DungeonEditorHarnessPublicationSupport.runOnFxThread(
                () -> verifyTravelRenderSnapshotParity(RESULTS));
    }

    private static void verifyEditorRenderSnapshotParity(List<String> results) throws Exception {
        DungeonEditorHarnessPersistenceSupport.HarnessRuntime runtime =
                DungeonEditorHarnessPersistenceSupport.HarnessRuntime.create();
        DungeonEditorBehaviorHarnessSupport.HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        String mapName = "Render Snapshot Editor Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "Render Snapshot Editor Reload Hop");
        selectMap(controls, mapName);

        ImageSnapshot z0 = ImageSnapshot.capture("DE-IMG-001-editor-z0-before", binding.mapView());
        click(button(controls, "+"));
        assertEquals(1L, runtime.controlsModel().current().projectionLevel(),
                "DE-IMG-001 editor projection level advances before render snapshot parity");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).stream()
                        .allMatch(cell -> cell.endsWith(",1")),
                "DE-IMG-001 editor render frame contains only active z=1 cells");

        ImageSnapshot baseline = ImageSnapshot.capture("DE-IMG-001-editor-z1-baseline", binding.mapView());
        ImageSnapshot candidate = ImageSnapshot.capture("DE-IMG-001-editor-z1-candidate", binding.mapView());
        ImageDiff parityDiff = ImageDiff.between(baseline, candidate, "DE-IMG-001 same-frame parity");
        assertEquals(0L, parityDiff.changedPixels(),
                "DE-IMG-001 same editor render frame is pixel-identical");

        ImageDiff routeDiff = ImageDiff.between(z0, baseline, "DE-IMG-001 route sensitivity");
        assertTrue(routeDiff.changedPixels() > 0,
                "DE-IMG-001 image diff oracle detects projection-level render changes");
        ImageArtifacts artifacts = ImageArtifacts.write("DE-IMG-001", z0, baseline, candidate, parityDiff, routeDiff);

        results.add("OwnerSuite=" + OWNER + "; ProofType=ImageSnapshotParity; "
                + "DE-IMG-001 Ready: DungeonEditorContribution -> DungeonMapView renders F6 z=1 twice"
                + " with same-frame changedPixels=0; z0-vs-z1 changedPixels=" + routeDiff.changedPixels()
                + "; checksum=" + baseline.checksumHex()
                + "; artifacts=" + artifacts.description());
    }

    private static void verifyEditorPreviewRenderSnapshotParity(List<String> results) throws Exception {
        DungeonEditorHarnessPersistenceSupport.HarnessRuntime runtime =
                DungeonEditorHarnessPersistenceSupport.HarnessRuntime.create();
        DungeonEditorBehaviorHarnessSupport.HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = DungeonEditorBehaviorHarnessSupport.createWallFixture(
                controls,
                runtime,
                "Render Snapshot Preview Wall Map");
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);

        ImageSnapshot committed = ImageSnapshot.capture("DE-IMG-002-editor-wall-committed", mapView);
        click(button(controls, "Wand"));
        DungeonEditorBehaviorHarnessSupport.startAndPreviewInternalWall(mapView, binding.mapContentModel().currentViewport());
        assertTrue(
                DungeonEditorBehaviorHarnessSupport.renderHasAnyBoundaryNear(
                        binding.mapContentModel(),
                        2.0,
                        2.5),
                "DE-IMG-002 wall preview render is visible before image parity");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-IMG-002 wall preview does not persist boundary rows");

        ImageSnapshot baseline = ImageSnapshot.capture("DE-IMG-002-editor-wall-preview-baseline", mapView);
        ImageSnapshot candidate = ImageSnapshot.capture("DE-IMG-002-editor-wall-preview-candidate", mapView);
        ImageDiff parityDiff = ImageDiff.between(baseline, candidate, "DE-IMG-002 same-preview parity");
        assertEquals(0L, parityDiff.changedPixels(),
                "DE-IMG-002 same editor preview render frame is pixel-identical");

        ImageDiff routeDiff = ImageDiff.between(committed, baseline, "DE-IMG-002 preview sensitivity");
        assertTrue(routeDiff.changedPixels() > 0,
                "DE-IMG-002 image diff oracle detects preview render changes");
        ImageArtifacts artifacts = ImageArtifacts.write("DE-IMG-002", committed, baseline, candidate, parityDiff, routeDiff);

        results.add("OwnerSuite=" + OWNER + "; ProofType=ImageSnapshotParity; "
                + "DE-IMG-002 Ready: DungeonEditorContribution wall preview -> DungeonMapView renders preview twice"
                + " with same-frame changedPixels=0; committed-vs-preview changedPixels=" + routeDiff.changedPixels()
                + "; checksum=" + baseline.checksumHex()
                + "; artifacts=" + artifacts.description());
    }

    private static void verifyTravelRenderSnapshotParity(List<String> results) throws Exception {
        TravelHarnessRuntime runtime = TravelHarnessRuntime.create();
        long mapId = runtime.database().createPersistedMap("Render Snapshot Travel Map");
        runtime.database().seedF1SingleRoom(mapId, "Travel Ground Room", 0, 1, 1);
        runtime.database().seedF1SingleRoom(mapId, "Travel Upper Room", 1, 6, 1);
        movePartyTokenToMap(runtime.party(), mapId);
        runtime.context().services().require(DungeonTravelRuntimeApplicationService.class)
                .refresh();

        TravelHarnessBinding binding = bindTravelHarness(runtime);
        TravelDungeonModel travelModel = runtime.context().services().require(TravelDungeonModel.class);
        ImageSnapshot z0 = ImageSnapshot.capture("DT-IMG-001-travel-z0-before", binding.mapView());

        click(button(binding.controlsRoot(), "+"));
        TravelDungeonSnapshot afterPlusSnapshot = travelModel.current();
        assertEquals(1L, afterPlusSnapshot.projectionLevel(),
                "DT-IMG-001 travel projection level advances before render snapshot parity");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).stream()
                        .allMatch(cell -> cell.endsWith(",1")),
                "DT-IMG-001 travel render frame contains only active z=1 cells");

        ImageSnapshot baseline = ImageSnapshot.capture("DT-IMG-001-travel-z1-baseline", binding.mapView());
        ImageSnapshot candidate = ImageSnapshot.capture("DT-IMG-001-travel-z1-candidate", binding.mapView());
        ImageDiff parityDiff = ImageDiff.between(baseline, candidate, "DT-IMG-001 same-frame parity");
        assertEquals(0L, parityDiff.changedPixels(),
                "DT-IMG-001 same travel render frame is pixel-identical");
        ImageDiff routeDiff = ImageDiff.between(z0, baseline, "DT-IMG-001 route diagnostic");
        ImageArtifacts artifacts = ImageArtifacts.write("DT-IMG-001", z0, baseline, candidate, parityDiff, routeDiff);

        results.add("OwnerSuite=" + OWNER + "; ProofType=ImageSnapshotParity; "
                + "DT-IMG-001 Ready: DungeonTravelContribution -> DungeonMapView renders travel z=1 twice"
                + " with same-frame changedPixels=0; diagnostic z0-vs-z1 changedPixels="
                + routeDiff.changedPixels()
                + "; checksum=" + baseline.checksumHex()
                + "; artifacts=" + artifacts.description());
    }

    private static TravelHarnessBinding bindTravelHarness(TravelHarnessRuntime runtime) {
        ShellBinding shellBinding = new DungeonTravelContribution().bind(runtime.context());
        Parent controlsRoot = DungeonEditorBehaviorHarnessSupport.slot(
                shellBinding,
                ShellSlot.COCKPIT_CONTROLS,
                Parent.class);
        DungeonMapView mapView = DungeonEditorBehaviorHarnessSupport.slot(
                shellBinding,
                ShellSlot.COCKPIT_MAIN,
                DungeonMapView.class);
        Parent stateRoot = DungeonEditorBehaviorHarnessSupport.slot(shellBinding, ShellSlot.COCKPIT_STATE, Parent.class);
        Stage stage = new Stage();
        HBox root = new HBox(controlsRoot, mapView, stateRoot);
        stage.setScene(new Scene(root, 1_400.0, 900.0));
        stage.show();
        root.applyCss();
        root.layout();
        return new TravelHarnessBinding(
                controlsRoot,
                mapView,
                DungeonEditorBehaviorHarnessSupport.boundContentModel(mapView));
    }

    private static void movePartyTokenToMap(PartyApplicationService party, long mapId) {
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft("Snapshot Guide", "Harness", 3, 12, 14),
                MembershipState.ACTIVE));
        party.moveCharacters(new MovePartyCharactersCommand(
                List.of(1L),
                new PartyDungeonTravelLocationSnapshot(
                        mapId,
                        PartyDungeonTravelLocationKind.TILE,
                        0L,
                        new PartyTravelTile(1, 1, 0),
                        PartyTravelHeading.SOUTH),
                true));
    }

    private record TravelHarnessBinding(
            Parent controlsRoot,
            DungeonMapView mapView,
            src.view.slotcontent.main.dungeonmap.DungeonMapContentModel mapContentModel
    ) {
    }

    private record TravelHarnessRuntime(
            ShellRuntimeContext context,
            PartyApplicationService party,
            DungeonEditorHarnessPersistenceSupport.DatabaseAssertions database
    ) {
        static TravelHarnessRuntime create() {
            DungeonEditorHarnessPersistenceSupport.DatabaseAssertions database =
                    new DungeonEditorHarnessPersistenceSupport.DatabaseAssertions();
            database.clearDungeonData();
            database.clearPartyData();
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            builder.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
            new src.data.party.PartyServiceContribution().register(builder);
            new src.domain.party.PartyServiceContribution().register(builder);
            new DungeonServiceContribution().register(builder);
            ServiceRegistry registry = builder.build();
            return new TravelHarnessRuntime(
                    new ShellRuntimeContext(
                            DungeonEditorHarnessPersistenceSupport.EmptyInspectorSink.INSTANCE,
                            registry),
                    registry.require(PartyApplicationService.class),
                    database);
        }
    }

    private record ImageSnapshot(String label, int width, int height, int[] argb, long checksum) {
        static ImageSnapshot capture(String label, DungeonMapView mapView) {
            WritableImage image = DungeonEditorBehaviorHarnessSupport.renderedCanvasSnapshot(mapView).image();
            int width = (int) image.getWidth();
            int height = (int) image.getHeight();
            int[] pixels = new int[width * height];
            PixelReader reader = image.getPixelReader();
            long checksum = 0xcbf29ce484222325L;
            int index = 0;
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    int argb = reader.getArgb(x, y);
                    pixels[index++] = argb;
                    checksum ^= argb;
                    checksum *= 0x100000001b3L;
                }
            }
            return new ImageSnapshot(label, width, height, pixels, checksum);
        }

        String checksumHex() {
            return Long.toUnsignedString(checksum, 16);
        }

        void writePng(Path directory) throws Exception {
            Files.createDirectories(directory);
            BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            image.setRGB(0, 0, width, height, argb, 0, width);
            ImageIO.write(image, "png", directory.resolve(label + ".png").toFile());
        }
    }

    private record ImageDiff(
            String label,
            int width,
            int height,
            long changedPixels,
            int firstChangedX,
            int firstChangedY,
            int firstExpectedArgb,
            int firstActualArgb,
            int[] argb
    ) {
        static ImageDiff between(ImageSnapshot expected, ImageSnapshot actual, String label) {
            if (expected.width() != actual.width() || expected.height() != actual.height()) {
                throw new AssertionError(label + " image dimensions differ expected="
                        + expected.width() + "x" + expected.height()
                        + " actual=" + actual.width() + "x" + actual.height());
            }
            long changedPixels = 0L;
            int firstChangedX = -1;
            int firstChangedY = -1;
            int firstExpectedArgb = 0;
            int firstActualArgb = 0;
            int[] diffPixels = new int[expected.argb().length];
            for (int index = 0; index < expected.argb().length; index++) {
                int expectedArgb = expected.argb()[index];
                int actualArgb = actual.argb()[index];
                if (expectedArgb == actualArgb) {
                    diffPixels[index] = 0x00000000;
                    continue;
                }
                changedPixels++;
                diffPixels[index] = 0xffff00ff;
                if (firstChangedX < 0) {
                    firstChangedX = index % expected.width();
                    firstChangedY = index / expected.width();
                    firstExpectedArgb = expectedArgb;
                    firstActualArgb = actualArgb;
                }
            }
            return new ImageDiff(
                    label,
                    expected.width(),
                    expected.height(),
                    changedPixels,
                    firstChangedX,
                    firstChangedY,
                    firstExpectedArgb,
                    firstActualArgb,
                    diffPixels);
        }

        void writePng(Path directory) throws Exception {
            Files.createDirectories(directory);
            BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            image.setRGB(0, 0, width, height, argb, 0, width);
            ImageIO.write(image, "png", directory.resolve(safeLabel() + "-diff.png").toFile());
        }

        private String safeLabel() {
            return label.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        }

        @Override
        public String toString() {
            return "changedPixels=" + changedPixels
                    + " firstChanged=(" + firstChangedX + "," + firstChangedY + ")"
                    + " firstExpectedArgb=0x" + Integer.toHexString(firstExpectedArgb)
                    + " firstActualArgb=0x" + Integer.toHexString(firstActualArgb);
        }
    }

    private record ImageArtifacts(Path directory) {
        static ImageArtifacts write(
                String proofId,
                ImageSnapshot before,
                ImageSnapshot baseline,
                ImageSnapshot candidate,
                ImageDiff parityDiff,
                ImageDiff controlDiff
        ) throws Exception {
            Path output = DungeonEditorHarnessPublicationSupport.resultsOutput();
            if (output == null) {
                return new ImageArtifacts(null);
            }
            Path directory = output.getParent().resolve("render-snapshots").resolve(proofId);
            before.writePng(directory);
            baseline.writePng(directory);
            candidate.writePng(directory);
            parityDiff.writePng(directory);
            if (controlDiff != null) {
                controlDiff.writePng(directory);
            }
            return new ImageArtifacts(directory);
        }

        String description() {
            return directory == null ? "not-published" : directory.toString();
        }
    }
}
