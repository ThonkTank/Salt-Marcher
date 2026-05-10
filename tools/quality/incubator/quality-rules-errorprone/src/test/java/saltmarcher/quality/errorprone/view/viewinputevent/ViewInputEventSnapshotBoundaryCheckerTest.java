package saltmarcher.quality.errorprone.view.viewinputevent;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewInputEventSnapshotBoundaryCheckerTest {

    @Test
    public void rejectsSameViewHelperCollapse() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  void publish() {",
                        "    // BUG: Diagnostic matches: same-view-helper",
                        "    handler.accept(new CatalogControlsViewInputEvent(mappedDifficulty()));",
                        "  }",
                        "  private String mappedDifficulty() {",
                        "    return \"hard\";",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String difficulty) { }")
                .expectErrorMessage("same-view-helper", containsAll(
                        "same-view helper src.view.leftbartabs.catalog.CatalogControlsView.mappedDifficulty()",
                        "non-raw semantic reconstruction"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsModelBackedSnapshotArgument() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  private final CatalogContributionModel model = new CatalogContributionModel();",
                        "  void publish() {",
                        "    // BUG: Diagnostic matches: model-dependency",
                        "    handler.accept(new CatalogControlsViewInputEvent(model.selectedDifficulty()));",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String difficulty) { }")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogContributionModel.java",
                        "package src.view.leftbartabs.catalog;",
                        "final class CatalogContributionModel {",
                        "  String selectedDifficulty() {",
                        "    return \"hard\";",
                        "  }",
                        "}")
                .expectErrorMessage("model-dependency", containsAll(
                        "forbidden snapshot dependency src.view.leftbartabs.catalog.CatalogContributionModel",
                        "Build the carrier directly from current widget or raw event state"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsRawMethodParameterSnapshot() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  void publish(String rawDifficulty) {",
                        "    handler.accept(new CatalogControlsViewInputEvent(rawDifficulty));",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String difficulty) { }")
                .doTest();
    }

    @Test
    public void rejectsSameViewSentinelArgument() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private static final String DEFAULT_DIFFICULTY = \"hard\";",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  void publish() {",
                        "    // BUG: Diagnostic matches: sentinel",
                        "    handler.accept(new CatalogControlsViewInputEvent(DEFAULT_DIFFICULTY));",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String difficulty) { }")
                .expectErrorMessage("sentinel", containsAll(
                        "same-view sentinel src.view.leftbartabs.catalog.CatalogControlsView.DEFAULT_DIFFICULTY",
                        "non-raw semantic reconstruction"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void ignoresSnapshotViolationsWhenCheckIsDisabled() {
        newHelper()
                .setArgs("-Xep:ViewInputEventSnapshotBoundary:OFF")
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  void publish() {",
                        "    handler.accept(new CatalogControlsViewInputEvent(mappedDifficulty()));",
                        "  }",
                        "  private String mappedDifficulty() {",
                        "    return \"hard\";",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String difficulty) { }")
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsidePassiveViewScope() {
        newHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsBinder.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsBinder {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  void publish() {",
                        "    handler.accept(new CatalogControlsViewInputEvent(mappedDifficulty()));",
                        "  }",
                        "  private String mappedDifficulty() {",
                        "    return \"hard\";",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsViewInputEvent.java",
                        "package src.view.leftbartabs.catalog;",
                        "record CatalogControlsViewInputEvent(String difficulty) { }")
                .doTest();
    }

    private CompilationTestHelper newHelper() {
        return CompilationTestHelper.newInstance(ViewInputEventSnapshotBoundaryChecker.class, getClass());
    }

    private static Predicate<String> containsAll(String... snippets) {
        return message -> {
            for (String snippet : snippets) {
                if (!message.contains(snippet)) {
                    return false;
                }
            }
            return true;
        };
    }
}
