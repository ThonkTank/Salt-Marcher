package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewProjectionModelBoundaryCheckersTest {

    @Test
    public void rejectsContributionModelViewDependency() {
        newContributionModelDependencyHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooContributionModel.java",
                        "package src.view.leftbartabs.foo;",
                        "// BUG: Diagnostic matches: view-dependency",
                        "public final class FooContributionModel {",
                        "  private final FooView view = null;",
                        "}")
                .addSourceLines("src/view/leftbartabs/foo/FooView.java", "package src.view.leftbartabs.foo;", "public final class FooView {}")
                .expectErrorMessage("view-dependency", containsAll(
                        "violates ContributionModel dependency boundaries",
                        "src.view.leftbartabs.foo.FooView"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsReusableSlotcontentModelReference() {
        newContributionModelDependencyHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooContributionModel.java",
                        "package src.view.leftbartabs.foo;",
                        "public final class FooContributionModel {",
                        "  private final src.view.slotcontent.controls.foo.FooContentModel content = null;",
                        "}")
                .addSourceLines("src/view/slotcontent/controls/foo/FooContentModel.java", "package src.view.slotcontent.controls.foo;", "public final class FooContentModel {}")
                .doTest();
    }

    @Test
    public void rejectsNestedContentModelCarrier() {
        newContentModelFlatSurfaceHelper()
                .addSourceLines(
                        "src/view/slotcontent/controls/foo/FooContentModel.java",
                        "package src.view.slotcontent.controls.foo;",
                        "// BUG: Diagnostic matches: flat-surface",
                        "public final class FooContentModel {",
                        "  static final class ReloadRequest {}",
                        "}")
                .expectErrorMessage("flat-surface", containsAll(
                        "must expose a flat published-value surface",
                        "ReloadRequest"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsideProjectionModelScope() {
        newContentModelFlatSurfaceHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "foo/FooContentModel.java",
                        "package foo;",
                        "public final class FooContentModel {",
                        "  static final class ReloadRequest {}",
                        "}")
                .doTest();
    }

    private CompilationTestHelper newContributionModelDependencyHelper() {
        return CompilationTestHelper.newInstance(
                ViewProjectionModelBoundaryCheckers.ViewContributionModelDependencyBoundaryChecker.class,
                getClass());
    }

    private CompilationTestHelper newContentModelFlatSurfaceHelper() {
        return CompilationTestHelper.newInstance(
                ViewProjectionModelBoundaryCheckers.ViewContentModelFlatSurfaceChecker.class,
                getClass());
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
