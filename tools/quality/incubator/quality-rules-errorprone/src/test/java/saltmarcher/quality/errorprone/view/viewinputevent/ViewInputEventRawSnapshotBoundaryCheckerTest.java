package saltmarcher.quality.errorprone.view.viewinputevent;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewInputEventRawSnapshotBoundaryCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            ViewInputEventRawSnapshotBoundaryChecker.class,
            getClass());

    @Test
    public void rejectsSameViewHelperCollapse() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  void publish() {",
                        "    // BUG: Diagnostic contains: non-raw semantic reconstruction",
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
    public void rejectsModelBackedSnapshotArgument() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/catalog/CatalogControlsView.java",
                        "package src.view.leftbartabs.catalog;",
                        "import java.util.function.Consumer;",
                        "final class CatalogControlsView {",
                        "  private Consumer<CatalogControlsViewInputEvent> handler = event -> { };",
                        "  private final CatalogContributionModel model = new CatalogContributionModel();",
                        "  void publish() {",
                        "    // BUG: Diagnostic contains: forbidden snapshot dependency",
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
                .doTest();
    }

    @Test
    public void allowsRawMethodParameterSnapshot() {
        compilationHelper
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
}
