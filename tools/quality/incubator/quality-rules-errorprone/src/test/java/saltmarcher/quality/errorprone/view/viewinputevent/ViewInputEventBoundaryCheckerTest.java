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
    public void rejectsTopLevelHelperMethod() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: helper-method",
                        "record FooViewInputEvent(String text) {",
                        "  String normalized() {",
                        "    return text.trim();",
                        "  }",
                        "}")
                .expectErrorMessage("helper-method", containsAll(
                        "top-level ViewInputEvent helper method",
                        "ViewInputEvent carriers must stay immutable"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsDiscriminatorComponent() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: discriminator-component",
                        "record FooViewInputEvent(String text, String action) { }")
                .expectErrorMessage("discriminator-component", containsAll(
                        "top-level ViewInputEvent discriminator component",
                        "ViewInputEvent carriers must stay immutable"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsApplicationServiceCarrierPayloadFromClasspath() {
        newHelper()
                .withClasspath(src.domain.catalog.CatalogApplicationService.class)
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: application-service-payload",
                        "record FooViewInputEvent(src.domain.catalog.CatalogApplicationService service) { }")
                .expectErrorMessage("application-service-payload", containsAll(
                        "src.domain.catalog.CatalogApplicationService",
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
    public void allowsSameStemPassiveViewProducer() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  FooViewInputEvent publish(String text) {",
                        "    return new FooViewInputEvent(text);",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooViewInputEvent(String text) { }")
                .doTest();
    }

    @Test
    public void rejectsPublishedEventProtocolCoupling() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooPublishedEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "record FooPublishedEvent(String text) { }")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: published-event-coupling",
                        "record FooViewInputEvent(FooPublishedEvent event) { }")
                .expectErrorMessage("published-event-coupling", containsAll(
                        "ViewInputEvent PublishedEvent protocol coupling",
                        "ViewInputEvent carriers must stay immutable"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void rejectsStaticViewInputEventApiUse() {
        newHelper()
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooView.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "final class FooView {",
                        "  void publish() {",
                        "    // BUG: Diagnostic matches: static-api",
                        "    FooViewInputEvent.empty();",
                        "  }",
                        "}")
                .addSourceLines(
                        "src/view/slotcontent/primitives/foo/FooViewInputEvent.java",
                        "package src.view.slotcontent.primitives.foo;",
                        "// BUG: Diagnostic matches: helper-method-side-effect",
                        "record FooViewInputEvent(String text) {",
                        "  static FooViewInputEvent empty() {",
                        "    return new FooViewInputEvent(\"\");",
                        "  }",
                        "}")
                .expectErrorMessage("static-api", containsAll(
                        "invokes static ViewInputEvent API src.view.slotcontent.primitives.foo.FooViewInputEvent.empty",
                        "ViewInputEvent carriers must stay immutable"))
                .expectErrorMessage("helper-method-side-effect", containsAll(
                        "top-level ViewInputEvent helper method",
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
        return CompilationTestHelper.newInstance(ViewInputEventBoundaryChecker.class, getClass())
                .matchAllDiagnostics();
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
