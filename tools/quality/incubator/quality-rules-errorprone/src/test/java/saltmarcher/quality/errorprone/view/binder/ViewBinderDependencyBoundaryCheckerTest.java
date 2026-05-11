package saltmarcher.quality.errorprone.view.binder;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewBinderDependencyBoundaryCheckerTest {

    @Test
    public void rejectsLegacyViewModelDependency() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooBinder.java",
                        "package src.view.leftbartabs.foo;",
                        "// BUG: Diagnostic matches: legacy-model",
                        "public final class FooBinder {",
                        "  private final FooViewModel legacy = null;",
                        "}")
                .addSourceLines("src/view/leftbartabs/foo/FooViewModel.java", "package src.view.leftbartabs.foo;", "public final class FooViewModel {}")
                .expectErrorMessage("legacy-model", containsAll(
                        "violates Binder dependency boundaries",
                        "src.view.leftbartabs.foo.FooViewModel"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsReusableSlotcontentContentModelReference() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooBinder.java",
                        "package src.view.leftbartabs.foo;",
                        "public final class FooBinder {",
                        "  private final src.view.slotcontent.controls.foo.FooContentModel content = null;",
                        "}")
                .addSourceLines("src/view/slotcontent/controls/foo/FooContentModel.java", "package src.view.slotcontent.controls.foo;", "public final class FooContentModel {}")
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsideBinderScope() {
        newHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "foo/FooBinder.java",
                        "package foo;",
                        "public final class FooBinder {",
                        "  private final FooViewModel legacy = null;",
                        "}")
                .addSourceLines("foo/FooViewModel.java", "package foo;", "public final class FooViewModel {}")
                .doTest();
    }

    private CompilationTestHelper newHelper() {
        return CompilationTestHelper.newInstance(ViewBinderDependencyBoundaryChecker.class, getClass());
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
