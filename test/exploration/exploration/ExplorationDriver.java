package exploration;

import bootstrap.AppBootstrap;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import javafx.application.Platform;
import javafx.embed.swing.SwingFXUtils;
import javafx.geometry.Bounds;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.Labeled;
import javafx.scene.image.WritableImage;
import javafx.stage.Stage;
import javafx.stage.Window;
import org.testfx.api.FxRobot;
import shell.api.ContributionKey;
import shell.host.AppShell;

public final class ExplorationDriver {

    private static final long STARTUP_TIMEOUT_SECONDS = 60;
    private static final int EMPTY_VISIBLE_NODE_FLOOR = 5;

    private final List<StationResult> stations = new ArrayList<>();
    private final List<Throwable> uncaught = new ArrayList<>();
    private final ByteArrayOutputStream logCapture = new ByteArrayOutputStream();

    private AppShell shell;
    private Stage stage;
    private FxRobot robot;
    private Path runDir;

    private ExplorationDriver() {
    }

    public static void main(String[] args) throws Exception {
        new ExplorationDriver().run();
    }

    private void run() throws Exception {
        Path reportRoot = Path.of(System.getProperty("saltmarcher.exploration.reportDir", "build/reports/exploration"));
        String runId = Instant.now().toString().replace(":", "").replace(".", "-");
        runDir = reportRoot.resolve(runId);
        Files.createDirectories(runDir);

        PrintStream originalErr = System.err;
        PrintStream originalOut = System.out;
        System.setErr(new PrintStream(new TeeOutputStream(originalErr, logCapture), true, StandardCharsets.UTF_8));
        System.setOut(new PrintStream(new TeeOutputStream(originalOut, logCapture), true, StandardCharsets.UTF_8));
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> uncaught.add(throwable));

        long startNanos = System.nanoTime();
        startShell();
        long startupMs = elapsedMillis(startNanos);

        visit("boot-main-shell", null, false);
        visit("dungeon-editor-open", "dungeon-editor", false);
        visit("dungeon-editor-paint-room-select", "dungeon-editor", true);
        visit("dungeon-travel-open", "dungeon-travel", false);
        visit("hexmap-pan-zoom", "hex-map", true);
        visit("worldplanner-open", "world-planner", false);
        visit("sessionplanner-open", "session-planner", false);
        visit("catalog-open", "catalog", false);
        visit("encounter-state-tab-open", "catalog", true);
        visit("travel-state-tab-open", "catalog", true);
        visit("party-view-open", "session-planner", true);

        writeSummary(runId, startupMs);
        stopShell();
        System.setErr(originalErr);
        System.setOut(originalOut);
        System.out.println("Exploration: " + stations.size() + " Stationen, " + anomalyCount()
                + " Anomalien, summary=" + runDir.resolve("summary.json"));
        if (hasCrash()) {
            throw new IllegalStateException("Exploratory smoke saw crash-level anomalies; see " + runDir);
        }
    }

    private void startShell() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Platform.startup(() -> {
            try {
                shell = new AppBootstrap().createShell();
                Scene scene = new Scene(shell, 1150, 700);
                stage = new Stage();
                stage.setTitle("SaltMarcher Exploration");
                stage.setScene(scene);
                stage.show();
                robot = new FxRobot();
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                latch.countDown();
            }
        });
        if (!latch.await(STARTUP_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Exploration shell startup timed out.");
        }
        if (failure.get() != null) {
            throw new IllegalStateException("Exploration shell startup failed.", failure.get());
        }
    }

    private void stopShell() {
        CountDownLatch latch = new CountDownLatch(1);
        Platform.runLater(() -> {
            if (stage != null) {
                stage.close();
            }
            Platform.exit();
            latch.countDown();
        });
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    private void visit(String name, String contributionKey, boolean exerciseInput) throws Exception {
        long started = System.nanoTime();
        int uncaughtBefore = uncaught.size();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        Platform.runLater(() -> {
            try {
                if (contributionKey != null) {
                    shell.navigateTo(new ContributionKey(contributionKey));
                }
                if (exerciseInput) {
                    exerciseStationInput(name);
                }
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                latch.countDown();
            }
        });
        if (!latch.await(20, TimeUnit.SECONDS)) {
            failure.set(new IllegalStateException("Station timed out."));
        }
        Thread.sleep(250);
        Path screenshot = runDir.resolve(name + ".png");
        int visibleNodes = snapshotAndCount(name, screenshot);
        List<Anomaly> anomalies = stationAnomalies(name, visibleNodes, uncaughtBefore, failure.get());
        stations.add(new StationResult(name, screenshot, elapsedMillis(started), visibleNodes, anomalies));
    }

    private void exerciseStationInput(String stationName) {
        if (stationName.equals("encounter-state-tab-open")) {
            clickLabeledNode("Encounter");
            return;
        }
        if (stationName.equals("travel-state-tab-open")) {
            clickLabeledNode("Reise");
            return;
        }
        if (stationName.equals("party-view-open")) {
            clickPartyTrigger();
            return;
        }
        Bounds bounds = shell.localToScreen(shell.getBoundsInLocal());
        if (bounds == null || robot == null) {
            return;
        }
        double x = bounds.getMinX() + bounds.getWidth() * 0.38;
        double y = bounds.getMinY() + bounds.getHeight() * 0.46;
        robot.moveTo(x, y).clickOn();
        if (stationName.contains("hexmap")) {
            robot.scroll(3);
            robot.scroll(-2);
        }
    }

    private void clickLabeledNode(String text) {
        Node node = findFirst(stage.getScene().getRoot(), candidate ->
                candidate instanceof Labeled labeled && text.equals(labeled.getText()));
        clickNode(node);
    }

    private void clickPartyTrigger() {
        Node node = findFirst(stage.getScene().getRoot(), candidate -> {
            String text = candidate.getAccessibleText();
            return text != null && text.contains("Party-Panel") && text.contains("Alt+P");
        });
        if (node == null) {
            node = findFirst(stage.getScene().getRoot(), candidate ->
                    candidate instanceof Labeled labeled && labeled.getText() != null && labeled.getText().contains("Party"));
        }
        clickNode(node);
    }

    private void clickNode(Node node) {
        if (node instanceof ButtonBase button) {
            button.fire();
            return;
        }
        if (node != null && robot != null) {
            Bounds bounds = node.localToScreen(node.getBoundsInLocal());
            if (bounds != null) {
                robot.moveTo(bounds.getCenterX(), bounds.getCenterY()).clickOn();
            }
        }
    }

    private Node findFirst(Node node, java.util.function.Predicate<Node> predicate) {
        if (node == null) {
            return null;
        }
        if (predicate.test(node)) {
            return node;
        }
        if (node instanceof javafx.scene.Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                Node found = findFirst(child, predicate);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private int snapshotAndCount(String stationName, Path screenshot) throws Exception {
        AtomicReference<Throwable> failure = new AtomicReference<>();
        AtomicReference<Integer> count = new AtomicReference<>(0);
        CountDownLatch latch = new CountDownLatch(1);
        Platform.runLater(() -> {
            try {
                Node root = snapshotRoot(stationName);
                WritableImage image = root.snapshot(null, null);
                ImageIO.write(SwingFXUtils.fromFXImage(image, null), "png", screenshot.toFile());
                count.set(countVisibleNodes(root));
            } catch (Throwable throwable) {
                failure.set(throwable);
            } finally {
                latch.countDown();
            }
        });
        if (!latch.await(20, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Screenshot timed out: " + screenshot);
        }
        if (failure.get() != null) {
            throw new IllegalStateException("Screenshot failed: " + screenshot, failure.get());
        }
        return count.get();
    }

    private Node snapshotRoot(String stationName) {
        if (stationName.equals("party-view-open")) {
            for (Window window : Window.getWindows()) {
                if (window.isShowing() && window != stage && window.getScene() != null) {
                    return window.getScene().getRoot();
                }
            }
        }
        return stage.getScene().getRoot();
    }

    private List<Anomaly> stationAnomalies(String stationName, int visibleNodes, int uncaughtBefore, Throwable failure) {
        List<Anomaly> anomalies = new ArrayList<>();
        if (failure != null) {
            anomalies.add(new Anomaly("crash",
                    stationName + ":exception:" + failure.getClass().getName() + ":" + firstFrame(failure),
                    failure.toString(), ""));
        }
        for (int index = uncaughtBefore; index < uncaught.size(); index++) {
            Throwable throwable = uncaught.get(index);
            anomalies.add(new Anomaly("uncaught-exception",
                    stationName + ":uncaught:" + throwable.getClass().getName() + ":" + firstFrame(throwable),
                    throwable.toString(), ""));
        }
        if (visibleNodes < EMPTY_VISIBLE_NODE_FLOOR) {
            anomalies.add(new Anomaly("empty-state", stationName + ":empty-state",
                    "Visible node count below " + EMPTY_VISIBLE_NODE_FLOOR + ": " + visibleNodes, ""));
        }
        for (String line : warningLines()) {
            anomalies.add(new Anomaly(line.contains("ERROR") ? "error-log" : "warn-log",
                    stationName + ":log:" + normalizeLogLine(line), line, line));
        }
        return anomalies;
    }

    private static String firstFrame(Throwable throwable) {
        StackTraceElement[] stack = throwable.getStackTrace();
        if (stack.length == 0) {
            return "no-frame";
        }
        StackTraceElement frame = stack[0];
        return frame.getClassName() + "." + frame.getMethodName() + ":" + frame.getLineNumber();
    }

    private List<String> warningLines() {
        String text = logCapture.toString(StandardCharsets.UTF_8);
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\\R")) {
            String upper = line.toUpperCase(Locale.ROOT);
            if ((upper.contains("ERROR") || upper.contains("WARN")) && !isKnownEnvironmentWarning(line)) {
                lines.add(line.length() > 240 ? line.substring(0, 240) : line);
            }
        }
        return lines.stream().distinct().limit(5).toList();
    }

    private static boolean isKnownEnvironmentWarning(String line) {
        return line.contains("Unsupported JavaFX configuration: classes were loaded from 'unnamed module");
    }

    private int countVisibleNodes(Node node) {
        if (node == null || !node.isVisible()) {
            return 0;
        }
        int total = 1;
        if (node instanceof javafx.scene.Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                total += countVisibleNodes(child);
            }
        }
        return total;
    }

    private void writeSummary(String runId, long startupMs) throws IOException {
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        field(json, "schema_version", "1", false, true);
        field(json, "run_id", runId, true, true);
        field(json, "started_at", Instant.now().toString(), true, true);
        field(json, "startup_ms", Long.toString(startupMs), false, true);
        json.append("  \"stations\": [\n");
        for (int index = 0; index < stations.size(); index++) {
            stations.get(index).appendJson(json, index < stations.size() - 1);
        }
        json.append("  ]\n");
        json.append("}\n");
        Files.writeString(runDir.resolve("summary.json"), json.toString(), StandardCharsets.UTF_8);
    }

    private int anomalyCount() {
        return stations.stream().mapToInt(station -> station.anomalies().size()).sum();
    }

    private boolean hasCrash() {
        return stations.stream()
                .flatMap(station -> station.anomalies().stream())
                .anyMatch(anomaly -> anomaly.rank().equals("crash") || anomaly.rank().equals("uncaught-exception"));
    }

    private static long elapsedMillis(long startedNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
    }

    private static String normalizeLogLine(String line) {
        return line.replaceAll("\\b\\d{4}-\\d{2}-\\d{2}[T ][0-9:.+-]+Z?\\b", "<timestamp>");
    }

    private static void field(StringBuilder json, String name, String value, boolean quote, boolean comma) {
        json.append("  \"").append(name).append("\": ");
        json.append(quote ? "\"" + escape(value) + "\"" : value);
        json.append(comma ? "," : "").append("\n");
    }

    private static String escape(String value) {
        return Objects.toString(value, "")
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private record StationResult(
            String name,
            Path screenshot,
            long wallMs,
            int visibleNodes,
            List<Anomaly> anomalies
    ) {
        void appendJson(StringBuilder json, boolean comma) {
            json.append("    {\n");
            json.append("      \"name\": \"").append(escape(name)).append("\",\n");
            json.append("      \"screenshot\": \"").append(escape(screenshot.toAbsolutePath().toString())).append("\",\n");
            json.append("      \"wall_ms\": ").append(wallMs).append(",\n");
            json.append("      \"visible_nodes\": ").append(visibleNodes).append(",\n");
            json.append("      \"anomalies\": [");
            for (int index = 0; index < anomalies.size(); index++) {
                anomalies.get(index).appendJson(json);
                if (index < anomalies.size() - 1) {
                    json.append(", ");
                }
            }
            json.append("]\n");
            json.append("    }").append(comma ? "," : "").append("\n");
        }
    }

    private record Anomaly(String rank, String signature, String message, String logExcerpt) {
        void appendJson(StringBuilder json) {
            json.append("{\"rank\":\"").append(escape(rank)).append("\",")
                    .append("\"signature\":\"").append(escape(signature)).append("\",")
                    .append("\"message\":\"").append(escape(message)).append("\",")
                    .append("\"log_excerpt\":\"").append(escape(logExcerpt)).append("\"}");
        }
    }

    private static final class TeeOutputStream extends OutputStream {
        private final PrintStream delegate;
        private final ByteArrayOutputStream capture;

        TeeOutputStream(PrintStream delegate, ByteArrayOutputStream capture) {
            this.delegate = delegate;
            this.capture = capture;
        }

        @Override
        public void write(int value) throws IOException {
            delegate.write(value);
            capture.write(value);
        }
    }
}
