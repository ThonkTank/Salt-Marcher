package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewIntentHandlerBoundaryCheckersTest {

    @Test
    public void rejectsPublishedEventDependency() {
        newDependencyHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooIntentHandler.java",
                        "package src.view.leftbartabs.foo;",
                        "// BUG: Diagnostic matches: published-event",
                        "public final class FooIntentHandler {",
                        "  private final FooPublishedEvent event = null;",
                        "  public void consume(FooViewInputEvent event) {}",
                        "}")
                .addSourceLines("src/view/leftbartabs/foo/FooPublishedEvent.java", "package src.view.leftbartabs.foo;", "public record FooPublishedEvent(String text) {}")
                .addSourceLines("src/view/leftbartabs/foo/FooViewInputEvent.java", "package src.view.leftbartabs.foo;", "public record FooViewInputEvent(String text) {}")
                .expectErrorMessage("published-event", containsAll(
                        "violates IntentHandler dependency boundaries",
                        "src.view.leftbartabs.foo.FooPublishedEvent"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void acceptsSameRootConsumeEntrypoint() {
        newInputEventHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooIntentHandler.java",
                        "package src.view.leftbartabs.foo;",
                        "public final class FooIntentHandler {",
                        "  public void consume(FooViewInputEvent event) {",
                        "    event.label();",
                        "  }",
                        "}")
                .addSourceLines("src/view/leftbartabs/foo/FooViewInputEvent.java", "package src.view.leftbartabs.foo;", "public record FooViewInputEvent(String label) {}")
                .doTest();
    }

    @Test
    public void rejectsDiscriminatorDispatch() {
        newInputEventHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooIntentHandler.java",
                        "package src.view.leftbartabs.foo;",
                        "// BUG: Diagnostic matches: discriminator",
                        "public final class FooIntentHandler {",
                        "  public void consume(FooViewInputEvent event) {",
                        "    if (event.source().isBlank()) {}",
                        "  }",
                        "}")
                .addSourceLines("src/view/leftbartabs/foo/FooViewInputEvent.java", "package src.view.leftbartabs.foo;", "public record FooViewInputEvent(String source, String label) {}")
                .expectErrorMessage("discriminator", containsAll(
                        "derive meaning from concrete ViewInputEvent snapshot fields",
                        "consume(FooViewInputEvent).source()"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsideIntentHandlerScope() {
        newInputEventHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "foo/FooIntentHandler.java",
                        "package foo;",
                        "public final class FooIntentHandler {",
                        "  public void handle(FooViewInputEvent event) {}",
                        "}")
                .addSourceLines("foo/FooViewInputEvent.java", "package foo;", "public record FooViewInputEvent(String label) {}")
                .doTest();
    }

    private CompilationTestHelper newDependencyHelper() {
        return CompilationTestHelper.newInstance(
                ViewIntentHandlerBoundaryCheckers.ViewIntentHandlerDependencyBoundaryChecker.class,
                getClass());
    }

    private CompilationTestHelper newInputEventHelper() {
        return CompilationTestHelper.newInstance(
                ViewIntentHandlerBoundaryCheckers.ViewIntentHandlerViewInputEventChecker.class,
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
