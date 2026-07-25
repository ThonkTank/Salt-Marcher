package features.campaign.adapter.javafx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import features.campaign.api.CampaignId;
import features.campaign.api.CampaignSnapshot;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javafx.application.Platform;
import javafx.event.Event;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.robot.Robot;
import javafx.stage.Stage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import testsupport.JavaFxRuntime;

@org.junit.jupiter.api.Tag("ui")
final class CampaignDeskViewTest {

    @BeforeAll
    static void startJavaFx() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        JavaFxRuntime.startup(() -> {
            Platform.setImplicitExit(false);
            started.countDown();
        });
        assertTrue(started.await(5L, TimeUnit.SECONDS));
    }

    @AfterAll
    static void shutdownJavaFx() throws Exception {
        runOnFx(JavaFxRuntime::shutdown);
    }

    @Test
    void exposesKeyboardFocusAndConcreteEmptyBusyErrorAndRecoveryStates() throws Exception {
        AtomicInteger creates = new AtomicInteger();
        AtomicInteger selections = new AtomicInteger();
        AtomicInteger recoveries = new AtomicInteger();
        AtomicInteger reloads = new AtomicInteger();
        AtomicReference<String> createdName = new AtomicReference<>();
        AtomicReference<Stage> window = new AtomicReference<>();
        AtomicReference<CampaignDeskView> surface = new AtomicReference<>();
        CampaignSnapshot alpha = campaign(1L, "Alpha");
        CampaignSnapshot beta = campaign(2L, "Beta");

        runOnFx(() -> {
            CampaignDeskView view = new CampaignDeskView(new CampaignDeskView.Actions() {
                @Override
                public void create(String name) {
                    createdName.set(name);
                    creates.incrementAndGet();
                }

                @Override
                public void select(CampaignSnapshot campaign) {
                    selections.incrementAndGet();
                }

                @Override
                public void recover() {
                    recoveries.incrementAndGet();
                }

                @Override
                public void reload() {
                    reloads.incrementAndGet();
                }
            });
            Stage stage = new Stage();
            Scene scene = new Scene(view, 1_150, 700);
            scene.getStylesheets().add(
                    CampaignDeskViewTest.class.getResource("/salt-marcher.css").toExternalForm());
            stage.setScene(scene);
            stage.show();
            window.set(stage);
            surface.set(view);

            TextField name = nameField(view);
            assertTrue(name.isDisabled());
            assertEquals("Name der neuen Kampagne", name.getAccessibleText());
            assertTrue(status(view).getText().contains("geladen"));
        });

        runOnFx(() -> surface.get().showCampaigns(List.of(), Optional.empty(), ""));
        awaitFxCondition(() -> nameField(surface.get()).isFocused());
        runOnFx(() -> {
            CampaignDeskView view = surface.get();
            TextField name = nameField(view);
            assertTrue(name.isFocusTraversable());
            assertTrue(view.lookupAll(".campaign-desk-empty").stream()
                    .filter(Label.class::isInstance)
                    .map(Label.class::cast)
                    .anyMatch(label -> label.isVisible() && label.getText().contains("Name genügt")));
            int helpNotifications = view.nameHelpNotificationsForTesting();
            name.setText("   ");
            assertTrue(button(view, "Kampagne erstellen").isDisabled());
            Label validation = (Label) view.lookup(".campaign-desk-name-validation");
            assertTrue(validation.isVisible());
            assertEquals(name, validation.getLabelFor());
            assertEquals(validation.getText(), name.getAccessibleHelp());
            assertTrue(view.nameHelpNotificationsForTesting() > helpNotifications);
            fireKey(name, KeyCode.ENTER, false);
            assertEquals(0, creates.get());
            helpNotifications = view.nameHelpNotificationsForTesting();
            name.setText("  Nur ein Name  ");
            assertFalse(button(view, "Kampagne erstellen").isDisabled());
            assertNull(name.getAccessibleHelp());
            assertTrue(view.nameHelpNotificationsForTesting() > helpNotifications);
            name.requestFocus();
            fireKey(name, KeyCode.TAB, false);
            assertTrue(button(view, "Kampagne erstellen").isFocused());
            name.requestFocus();
            fireKey(name, KeyCode.ENTER, false);
            assertEquals(1, creates.get());
            assertEquals("Nur ein Name", createdName.get());
        });

        runOnFx(() -> surface.get().showCampaigns(
                List.of(alpha, beta), Optional.of(alpha), "Kampagnen bereit"));
        runOnFx(() -> {
            List<Button> rows = rows(surface.get());
            assertEquals(2, rows.size());
            Button current = rows.stream()
                    .filter(row -> row.getStyleClass().contains("campaign-desk-row-current"))
                    .findFirst().orElseThrow();
            assertTrue(current.isFocusTraversable());
            assertFalse(current.isDisabled());
            assertEquals("Aktuelle Kampagne Alpha. Fortsetzen", current.getAccessibleText());
            assertTrue(rows.stream().allMatch(row -> row.getAccessibleText() != null));
            assertEquals("Kampagnen bereit", status(surface.get()).getAccessibleText());
        });

        runOnFx(() -> surface.get().showSwitching("Beta"));
        runOnFx(() -> {
            assertTrue(rows(surface.get()).stream().allMatch(Button::isDisabled));
            assertTrue(status(surface.get()).getText().contains("Beta"));
            assertTrue(nameField(surface.get()).isDisabled());
        });

        runOnFx(() -> surface.get().showError("Name ist ungültig.", true));
        awaitFxCondition(() -> nameField(surface.get()).isFocused());
        runOnFx(() -> {
            assertTrue(status(surface.get()).getStyleClass().contains("text-warning"));
            Button reload = button(surface.get(), "Kampagnen neu laden");
            assertTrue(reload.isVisible() && reload.isManaged());
            assertTrue(reload.getAccessibleText().contains("Name ist ungültig"));
            assertEquals("  Nur ein Name  ", nameField(surface.get()).getText());
            reload.fire();
            assertEquals(1, reloads.get());
        });

        runOnFx(() -> surface.get().showRecovery(
                "Die aktuelle Kampagne ist nicht spielbereit.",
                List.of(alpha, beta),
                Optional.of(alpha)));
        Button recovery = button(surface.get(), "Aktuelle Kampagne erneut öffnen");
        awaitFxCondition(recovery::isFocused);
        runOnFx(() -> {
            assertTrue(recovery.isVisible() && recovery.isManaged());
            assertTrue(recovery.getAccessibleText().contains("nicht spielbereit"));
            assertTrue(nameField(surface.get()).isDisabled());
            assertTrue(rows(surface.get()).stream()
                    .filter(row -> row.getAccessibleText().contains("Alpha"))
                    .findFirst().orElseThrow().isDisabled());
            recovery.fire();
            assertEquals(1, recoveries.get());
            rows(surface.get()).stream()
                    .filter(row -> row.getAccessibleText().contains("Beta"))
                    .findFirst().orElseThrow().fire();
            assertEquals(1, selections.get());
            surface.get().confirmCreation();
            assertEquals("", nameField(surface.get()).getText());
            window.get().close();
        });
    }

    @Test
    void keepsLargeAndEnlargedCampaignCatalogKeyboardReachableAtCompactDesktopSize()
            throws Exception {
        AtomicReference<Stage> window = new AtomicReference<>();
        AtomicReference<CampaignDeskView> surface = new AtomicReference<>();
        AtomicReference<TypographySnapshot> baselineTypography = new AtomicReference<>();
        List<CampaignSnapshot> many = java.util.stream.IntStream.rangeClosed(1, 40)
                .mapToObj(index -> campaign(index, "Campaign " + index))
                .toList();

        runOnFx(() -> {
            CampaignDeskView view = new CampaignDeskView(noopActions());
            Stage stage = new Stage();
            Scene scene = new Scene(view, 900, 500);
            scene.getStylesheets().add(
                    CampaignDeskViewTest.class.getResource("/salt-marcher.css").toExternalForm());
            stage.setScene(scene);
            stage.show();
            view.setStyle("-fx-font-size: 12px;");
            view.showCampaigns(many, Optional.of(many.getFirst()), "Bereit");
            view.applyCss();
            view.layout();
            window.set(stage);
            surface.set(view);
            assertCompactReachability(view, scene);
            baselineTypography.set(typography(view));
            assertRoleRatios(baselineTypography.get(), 12.0);
        });

        runOnFx(() -> {
            CampaignDeskView view = surface.get();
            Scene scene = window.get().getScene();
            view.setStyle("-fx-font-size: 24px;");
            view.showRecovery(
                    "Campaign 1 ist beschädigt; die übrigen bleiben verfügbar.",
                    many,
                    Optional.of(many.getFirst()));
            view.applyCss();
            view.layout();
            assertCompactReachability(view, scene);
            TypographySnapshot enlarged = typography(view);
            assertRoleRatios(enlarged, 24.0);
            assertScaledTypography(baselineTypography.get(), enlarged);
            Label title = (Label) view.lookup(".startup-title");
            Label subtitle = (Label) view.lookup(".startup-subtitle");
            assertTrue(title.isWrapText());
            assertTrue(subtitle.isWrapText());
            assertTrue(status(view).isWrapText());
            ScrollPane scroll = (ScrollPane) view.lookup(".campaign-desk-list-scroll");
            assertTrue(scroll.isFocusTraversable());
            TextField name = nameField(view);
            assertTrue(name.isDisabled());
            scroll.setVvalue(0.0);
        });
        awaitFxCondition(() -> button(
                surface.get(), "Aktuelle Kampagne erneut öffnen").isFocused());
        runOnFx(() -> {
            window.get().requestFocus();
            ((ScrollPane) surface.get().lookup(".campaign-desk-list-scroll")).requestFocus();
        });
        awaitFxCondition(() -> ((ScrollPane) surface.get().lookup(
                ".campaign-desk-list-scroll")).isFocused());
        runOnFx(() -> robotKey(KeyCode.PAGE_DOWN));
        awaitFxCondition(() -> ((ScrollPane) surface.get().lookup(
                ".campaign-desk-list-scroll")).getVvalue() > 0.0);
        runOnFx(() -> window.get().close());
    }

    @Test
    void glassRobotTraversesFromNameToCreateAndActivatesWithEnter() throws Exception {
        AtomicInteger creates = new AtomicInteger();
        AtomicReference<Stage> window = new AtomicReference<>();
        AtomicReference<CampaignDeskView> surface = new AtomicReference<>();

        runOnFx(() -> {
            CampaignDeskView view = new CampaignDeskView(new CampaignDeskView.Actions() {
                @Override
                public void create(String name) {
                    creates.incrementAndGet();
                }

                @Override
                public void select(CampaignSnapshot campaign) { }

                @Override
                public void recover() { }

                @Override
                public void reload() { }
            });
            Stage stage = new Stage();
            Scene scene = new Scene(view, 900, 500);
            scene.getStylesheets().add(
                    CampaignDeskViewTest.class.getResource("/salt-marcher.css").toExternalForm());
            stage.setScene(scene);
            stage.show();
            view.showCampaigns(List.of(), Optional.empty(), "");
            stage.requestFocus();
            nameField(view).setText("Robot Campaign");
            nameField(view).requestFocus();
            window.set(stage);
            surface.set(view);
        });
        awaitFxCondition(() -> nameField(surface.get()).isFocused());

        runOnFx(() -> robotKey(KeyCode.TAB));
        awaitFxCondition(() -> button(surface.get(), "Kampagne erstellen").isFocused());
        runOnFx(() -> robotKey(KeyCode.ENTER));
        awaitFxCondition(() -> creates.get() == 1);
        runOnFx(() -> window.get().close());
    }

    private static CampaignSnapshot campaign(long suffix, String name) {
        return new CampaignSnapshot(
                new CampaignId(new UUID(0L, suffix)), name);
    }

    private static TextField nameField(CampaignDeskView view) {
        TextField field = (TextField) view.lookup(".campaign-desk-name");
        assertNotNull(field);
        return field;
    }

    private static Label status(CampaignDeskView view) {
        Label label = (Label) view.lookup(".campaign-desk-status");
        assertNotNull(label);
        return label;
    }

    private static List<Button> rows(CampaignDeskView view) {
        return view.lookupAll(".campaign-desk-row").stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .toList();
    }

    private static Button button(CampaignDeskView view, String text) {
        return view.lookupAll(".button").stream()
                .filter(Button.class::isInstance)
                .map(Button.class::cast)
                .filter(candidate -> text.equals(candidate.getText()))
                .findFirst()
                .orElseThrow();
    }

    private static CampaignDeskView.Actions noopActions() {
        return new CampaignDeskView.Actions() {
            @Override
            public void create(String name) { }

            @Override
            public void select(CampaignSnapshot campaign) { }

            @Override
            public void recover() { }

            @Override
            public void reload() { }
        };
    }

    private static void assertCompactReachability(CampaignDeskView view, Scene scene) {
        ScrollPane scroll = (ScrollPane) view.lookup(".campaign-desk-list-scroll");
        assertNotNull(scroll);
        assertTrue(scroll.getBoundsInParent().getHeight() >= 70.0);
        assertWithinScene(nameField(view), scene);
        assertWithinScene(status(view), scene);
        assertWithinScene(scroll, scene);
        assertWithinScene(button(view, "Kampagne erstellen"), scene);
        Button recovery = button(view, "Aktuelle Kampagne erneut öffnen");
        Button reload = button(view, "Kampagnen neu laden");
        if (recovery.isVisible()) {
            assertWithinScene(recovery, scene);
        }
        if (reload.isVisible()) {
            assertWithinScene(reload, scene);
        }
    }

    private static void assertWithinScene(javafx.scene.Node node, Scene scene) {
        javafx.geometry.Bounds bounds = node.localToScene(node.getBoundsInLocal());
        assertTrue(bounds.getMinY() >= -0.5, () -> "node starts above scene: " + bounds);
        assertTrue(bounds.getMaxY() <= scene.getHeight() + 0.5,
                () -> "node ends below scene: " + bounds + " / " + scene.getHeight());
        assertTrue(bounds.getMinX() >= -0.5, () -> "node starts left of scene: " + bounds);
        assertTrue(bounds.getMaxX() <= scene.getWidth() + 0.5,
                () -> "node ends right of scene: " + bounds + " / " + scene.getWidth());
    }

    private static TypographySnapshot typography(CampaignDeskView view) {
        return new TypographySnapshot(
                fontSize(view, ".startup-title"),
                fontSize(view, ".campaign-desk-row-name"),
                status(view).getFont().getSize(),
                button(view, "Kampagne erstellen").getFont().getSize(),
                fontSize(view, ".campaign-desk-name-validation"));
    }

    private static double fontSize(CampaignDeskView view, String selector) {
        return ((javafx.scene.control.Labeled) view.lookup(selector)).getFont().getSize();
    }

    private static void assertRoleRatios(TypographySnapshot typography, double base) {
        assertRatio(typography.title(), base, 1.692, "title hierarchy");
        assertRatio(typography.row(), base, 1.077, "Campaign row hierarchy");
        assertRatio(typography.status(), base, 0.846, "status hierarchy");
        assertRatio(typography.button(), base, 1.0, "action hierarchy");
        assertRatio(typography.validation(), base, 0.846, "validation hierarchy");
    }

    private static void assertScaledTypography(
            TypographySnapshot baseline,
            TypographySnapshot enlarged
    ) {
        assertRatio(enlarged.title(), baseline.title(), 2.0, "title scaling");
        assertRatio(enlarged.row(), baseline.row(), 2.0, "row scaling");
        assertRatio(enlarged.status(), baseline.status(), 2.0, "status scaling");
        assertRatio(enlarged.button(), baseline.button(), 2.0, "button scaling");
        assertRatio(enlarged.validation(), baseline.validation(), 2.0, "validation scaling");
    }

    private static void assertRatio(
            double actual,
            double reference,
            double expected,
            String role
    ) {
        double ratio = actual / reference;
        assertTrue(Math.abs(ratio - expected) <= 0.08,
                () -> role + " ratio was " + ratio + ", expected " + expected);
    }

    private static void fireKey(javafx.scene.Node target, KeyCode code, boolean alt) {
        Event.fireEvent(target, new KeyEvent(
                KeyEvent.KEY_PRESSED,
                "",
                "",
                code,
                false,
                false,
                alt,
                false));
        Event.fireEvent(target, new KeyEvent(
                KeyEvent.KEY_RELEASED,
                "",
                "",
                code,
                false,
                false,
                alt,
                false));
    }

    private static void robotKey(KeyCode code) {
        Robot robot = new Robot();
        robot.keyPress(code);
        robot.keyRelease(code);
    }

    private record TypographySnapshot(
            double title,
            double row,
            double status,
            double button,
            double validation
    ) {
    }

    private static void awaitFxCondition(java.util.function.BooleanSupplier condition)
            throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            AtomicReference<Boolean> satisfied = new AtomicReference<>(false);
            runOnFx(() -> satisfied.set(condition.getAsBoolean()));
            if (satisfied.get()) {
                return;
            }
            java.util.concurrent.locks.LockSupport.parkNanos(TimeUnit.MILLISECONDS.toNanos(5));
        }
        throw new AssertionError("Timed out waiting for JavaFX focus");
    }

    private static void runOnFx(ThrowingRunnable action) throws Exception {
        if (Platform.isFxApplicationThread()) {
            action.run();
            return;
        }
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Platform.runLater(() -> {
            try {
                action.run();
            } catch (Throwable thrown) {
                failure.set(thrown);
            } finally {
                completed.countDown();
            }
        });
        assertTrue(completed.await(10L, TimeUnit.SECONDS));
        if (failure.get() instanceof Exception exception) {
            throw exception;
        }
        if (failure.get() instanceof Error error) {
            throw error;
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }
}
