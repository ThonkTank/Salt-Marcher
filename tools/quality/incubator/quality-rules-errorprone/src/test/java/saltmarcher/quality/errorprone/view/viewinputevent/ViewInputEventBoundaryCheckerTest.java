package saltmarcher.quality.errorprone.view.viewinputevent;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewInputEventBoundaryCheckerTest {

    @Test
    public void rejectsJavafxCarrierPayload() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: javafx-payload",
                        "record FooViewInputEvent(javafx.scene.input.MouseEvent event) { }")
                .addSourceLines(
                        "javafx/scene/input/MouseEvent.java",
                        "package javafx.scene.input;",
                        "public final class MouseEvent { }")
                .expectErrorMessage("javafx-payload", containsAll(
                        "Violations: javafx.scene.input.MouseEvent",
                        "ViewInputEvent carriers must stay immutable"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsJdkOnlyCarrierPayload() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String text, int level, boolean open) { }")
                .doTest();
    }

    @Test
    public void rejectsNonRecordCarrierShape() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: non-record",
                        "final class FooViewInputEvent { }")
                .expectErrorMessage("non-record", containsAll(
                        "non-record ViewInputEvent shape",
                        "ViewInputEvent carriers must stay immutable"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsConstructionOutsideSameStemView() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/BarView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class BarView {",
                        "  void publish() {",
                        "    // BUG: Diagnostic matches: foreign-producer",
                        "    new FooViewInputEvent(\"x\");",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String text) { }")
                .expectErrorMessage("foreign-producer", containsAll(
                        "constructs src.view.slotcontent.primitives.foo.FooViewInputEvent outside same-stem View",
                        "ViewInputEvent carriers must stay immutable"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void ignoresCarrierViolationsWhenCheckIsDisabled() {
        newHelper()
                .setArgs("-Xep:ViewInputEventBoundary:OFF")
                .expectNoDiagnostics()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(javafx.scene.input.MouseEvent event) { }")
                .addSourceLines(
                        "javafx/scene/input/MouseEvent.java",
                        "package javafx.scene.input;",
                        "public final class MouseEvent { }")
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsideViewScope() {
        newHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "foo/FooViewInputEvent.java",
                        "package foo;",
                        "record FooViewInputEvent(javafx.scene.input.MouseEvent event) { }")
                .addSourceLines(
                        "javafx/scene/input/MouseEvent.java",
                        "package javafx.scene.input;",
                        "public final class MouseEvent { }")
                .doTest();
    }

    private CompilationTestHelper newHelper() {
        return CompilationTestHelper.newInstance(ViewInputEventBoundaryChecker.class, getClass());
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
