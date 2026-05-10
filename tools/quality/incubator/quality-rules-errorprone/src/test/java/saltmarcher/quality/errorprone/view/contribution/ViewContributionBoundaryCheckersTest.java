package saltmarcher.quality.errorprone.view.contribution;

import com.google.errorprone.CompilationTestHelper;
import com.sun.tools.javac.main.Main;
import java.util.function.Predicate;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewContributionBoundaryCheckersTest {

    @Test
    public void rejectsContributionDomainDependency() {
        newDependencyHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooContribution.java",
                        "package src.view.leftbartabs.foo;",
                        "import shell.api.ShellBinding;",
                        "import shell.api.ShellContribution;",
                        "import shell.api.ShellContributionSpec;",
                        "import shell.api.ShellLeftBarTabSpec;",
                        "import shell.api.ShellRuntimeContext;",
                        "// BUG: Diagnostic matches: domain-dependency",
                        "public final class FooContribution implements ShellContribution {",
                        "  private final src.domain.foo.FooApplicationService service = null;",
                        "  public FooContribution() {}",
                        "  @Override public ShellContributionSpec registrationSpec() { return new ShellLeftBarTabSpec(); }",
                        "  @Override public ShellBinding bind(ShellRuntimeContext runtimeContext) { return null; }",
                        "}")
                .addSourceLines("src/domain/foo/FooApplicationService.java", "package src.domain.foo;", "public final class FooApplicationService {}")
                .addSourceLines("shell/api/ShellContribution.java", "package shell.api;", "public interface ShellContribution { ShellContributionSpec registrationSpec(); ShellBinding bind(ShellRuntimeContext runtimeContext); }")
                .addSourceLines("shell/api/ShellContributionSpec.java", "package shell.api;", "public interface ShellContributionSpec {}")
                .addSourceLines("shell/api/ShellBinding.java", "package shell.api;", "public interface ShellBinding {}")
                .addSourceLines("shell/api/ShellRuntimeContext.java", "package shell.api;", "public interface ShellRuntimeContext {}")
                .addSourceLines("shell/api/ShellLeftBarTabSpec.java", "package shell.api;", "public final class ShellLeftBarTabSpec implements ShellContributionSpec {}")
                .expectErrorMessage("domain-dependency", containsAll(
                        "violates thin shell entrypoint dependency boundaries",
                        "src.domain.foo.FooApplicationService"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void allowsSameRootBinderReference() {
        newDependencyHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooContribution.java",
                        "package src.view.leftbartabs.foo;",
                        "import shell.api.ShellBinding;",
                        "import shell.api.ShellContribution;",
                        "import shell.api.ShellContributionSpec;",
                        "import shell.api.ShellLeftBarTabSpec;",
                        "import shell.api.ShellRuntimeContext;",
                        "public final class FooContribution implements ShellContribution {",
                        "  private final FooBinder binder = null;",
                        "  public FooContribution() {}",
                        "  @Override public ShellContributionSpec registrationSpec() { return new ShellLeftBarTabSpec(); }",
                        "  @Override public ShellBinding bind(ShellRuntimeContext runtimeContext) { return binder; }",
                        "}")
                .addSourceLines("src/view/leftbartabs/foo/FooBinder.java", "package src.view.leftbartabs.foo;", "public final class FooBinder implements shell.api.ShellBinding {}")
                .addSourceLines("shell/api/ShellContribution.java", "package shell.api;", "public interface ShellContribution { ShellContributionSpec registrationSpec(); ShellBinding bind(ShellRuntimeContext runtimeContext); }")
                .addSourceLines("shell/api/ShellContributionSpec.java", "package shell.api;", "public interface ShellContributionSpec {}")
                .addSourceLines("shell/api/ShellBinding.java", "package shell.api;", "public interface ShellBinding {}")
                .addSourceLines("shell/api/ShellRuntimeContext.java", "package shell.api;", "public interface ShellRuntimeContext {}")
                .addSourceLines("shell/api/ShellLeftBarTabSpec.java", "package shell.api;", "public final class ShellLeftBarTabSpec implements ShellContributionSpec {}")
                .doTest();
    }

    @Test
    public void rejectsRuntimeServiceLookup() {
        newShellHelper()
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooContribution.java",
                        "package src.view.leftbartabs.foo;",
                        "import shell.api.ShellBinding;",
                        "import shell.api.ShellContribution;",
                        "import shell.api.ShellContributionSpec;",
                        "import shell.api.ShellLeftBarTabSpec;",
                        "import shell.api.ShellRuntimeContext;",
                        "// BUG: Diagnostic matches: shell-services",
                        "public final class FooContribution implements ShellContribution {",
                        "  public FooContribution() {}",
                        "  @Override public ShellContributionSpec registrationSpec() { return new ShellLeftBarTabSpec(); }",
                        "  @Override public ShellBinding bind(ShellRuntimeContext runtimeContext) {",
                        "    runtimeContext.services();",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines("shell/api/ShellContribution.java", "package shell.api;", "public interface ShellContribution { ShellContributionSpec registrationSpec(); ShellBinding bind(ShellRuntimeContext runtimeContext); }")
                .addSourceLines("shell/api/ShellContributionSpec.java", "package shell.api;", "public interface ShellContributionSpec {}")
                .addSourceLines("shell/api/ShellBinding.java", "package shell.api;", "public interface ShellBinding {}")
                .addSourceLines("shell/api/ServiceRegistry.java", "package shell.api;", "public interface ServiceRegistry {}")
                .addSourceLines("shell/api/ShellRuntimeContext.java", "package shell.api;", "public interface ShellRuntimeContext { ServiceRegistry services(); }")
                .addSourceLines("shell/api/ShellLeftBarTabSpec.java", "package shell.api;", "public final class ShellLeftBarTabSpec implements ShellContributionSpec {}")
                .expectErrorMessage("shell-services", containsAll(
                        "outside its allowed shell contract subset",
                        "shell.api.ShellRuntimeContext.services()"))
                .expectResult(Main.Result.ERROR)
                .doTest();
    }

    @Test
    public void ignoresSameShapeOutsideContributionScope() {
        newDependencyHelper()
                .expectNoDiagnostics()
                .addSourceLines(
                        "foo/FooContribution.java",
                        "package foo;",
                        "public final class FooContribution {",
                        "  private final src.domain.foo.FooApplicationService service = null;",
                        "}")
                .addSourceLines("src/domain/foo/FooApplicationService.java", "package src.domain.foo;", "public final class FooApplicationService {}")
                .doTest();
    }

    private CompilationTestHelper newDependencyHelper() {
        return CompilationTestHelper.newInstance(
                ViewContributionBoundaryCheckers.ViewContributionDependencyBoundaryChecker.class,
                getClass());
    }

    private CompilationTestHelper newShellHelper() {
        return CompilationTestHelper.newInstance(
                ViewContributionBoundaryCheckers.ViewContributionShellApiAllowlistChecker.class,
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
