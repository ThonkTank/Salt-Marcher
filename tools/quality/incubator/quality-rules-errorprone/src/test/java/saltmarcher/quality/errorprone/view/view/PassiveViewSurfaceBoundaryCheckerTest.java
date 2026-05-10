package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class PassiveViewSurfaceBoundaryCheckerTest {

    @Test
    public void rejectsProjectViewInheritance() {
        newHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooControlsView.java",
                        "package src.view.leftbartabs.foo;",
                        "import src.view.slotcontent.primitives.bar.BarView;",
                        "// BUG: Diagnostic matches: inheritance",
                        "final class FooControlsView extends BarView { }")
                .addSourceLines(
                        "src/view/slotcontent/primitives/bar/BarView.java",
                        "package src.view.slotcontent.primitives.bar;",
                        "public class BarView { }")
                .expectErrorMessage("inheritance", containsAll(
                        "Passive View 'src.view.leftbartabs.foo.FooControlsView'",
                        "project superclass BarView"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsConstructorInjectedCallbackProtocol() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "// BUG: Diagnostic matches: constructor-parameter",
                        "final class FooView {",
                        "  FooView(Consumer<FooViewInputEvent> handler) { }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String raw) { }")
                .expectErrorMessage("constructor-parameter", containsAll(
                        "constructor parameter Consumer<FooViewInputEvent>",
                        "Passive View 'src.view.slotcontent.primitives.foo.FooView'"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsProjectFreePreparedStateSinkAccessor() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  Consumer<String> titleSink() {",
                        "    return text -> { };",
                        "  }",
                        "}")
                .doTest();
    }

    @Test
    public void rejectsImperativeRenderMethod() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: outward-method",
                        "final class FooView {",
                        "  void showText(String text) { }",
                        "}")
                .expectErrorMessage("outward-method", containsAll(
                        "showText(1)",
                        "exposes only onViewInputEvent"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsDirectViewToViewInputForwarding() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import src.view.slotcontent.primitives.bar.BarView;",
                        "// BUG: Diagnostic matches: forwarding",
                        "final class FooView {",
                        "  void forward(BarView barView) {",
                        "    barView.onViewInputEvent(event -> { });",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String raw) { }")
                .addSourceLines(
                        "src/view/slotcontent/primitives/bar/BarView.java",
                        "package src.view.slotcontent.primitives.bar;",
                        "import java.util.function.Consumer;",
                        "public final class BarView {",
                        "  public void onViewInputEvent(Consumer<BarViewInputEvent> handler) { }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/bar/BarViewInputEvent.java",
                        "package src.view.slotcontent.primitives.bar;",
                        "public record BarViewInputEvent(String raw) { }")
                .expectErrorMessage("forwarding", containsAll(
                        "direct view-to-view input forwarding via src.view.slotcontent.primitives.bar.BarView.onViewInputEvent",
                        "Passive View 'src.view.slotcontent.primitives.foo.FooView'"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsSameStemInputSeam() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "import java.util.function.Consumer;",
                        "final class FooView {",
                        "  void onViewInputEvent(Consumer<FooViewInputEvent> handler) { }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String raw) { }")
                .doTest();
    }

    @Test
    public void ignoresPassiveViewViolationsWhenCheckIsDisabled() {
        newHelper()
                .setArgs("-Xep:PassiveViewSurfaceBoundary:OFF")
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  void showText(String text) { }",
                        "}")
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsidePassiveViewScope() {
        newHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooBinder.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooBinder {",
                        "  void showText(String text) { }",
                        "}")
                .doTest();
    }

    private CompilationTestHelper newHelper() {
        return CompilationTestHelper.newInstance(PassiveViewSurfaceBoundaryChecker.class, getClass());
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
