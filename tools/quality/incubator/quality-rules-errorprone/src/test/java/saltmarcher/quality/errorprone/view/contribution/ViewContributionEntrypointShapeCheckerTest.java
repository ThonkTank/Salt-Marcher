package saltmarcher.quality.errorprone.view.contribution;

import com.google.errorprone.CompilationTestHelper;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

@RunWith(JUnit4.class)
public final class ViewContributionEntrypointShapeCheckerTest {

    private final CompilationTestHelper compilationHelper = CompilationTestHelper.newInstance(
            ViewContributionBoundaryCheckers.ViewContributionEntrypointShapeChecker.class,
            getClass());

    @Test
    public void acceptsAreaMatchingContributionShape() {
        compilationHelper
                .addSourceLines(
                        "src/view/dropdowns/foo/FooTopBarContribution.java",
                        "package src.view.dropdowns.foo;",
                        "import shell.api.ShellBinding;",
                        "import shell.api.ShellContribution;",
                        "import shell.api.ShellContributionSpec;",
                        "import shell.api.ShellRuntimeContext;",
                        "import shell.api.ShellTopBarSpec;",
                        "public final class FooTopBarContribution implements ShellContribution {",
                        "  public FooTopBarContribution() {}",
                        "  @Override public ShellContributionSpec registrationSpec() {",
                        "    return new ShellTopBarSpec();",
                        "  }",
                        "  @Override public ShellBinding bind(ShellRuntimeContext runtimeContext) {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "shell/api/ShellContribution.java",
                        "package shell.api;",
                        "public interface ShellContribution {",
                        "  ShellContributionSpec registrationSpec();",
                        "  ShellBinding bind(ShellRuntimeContext runtimeContext);",
                        "}")
                .addSourceLines("shell/api/ShellContributionSpec.java", "package shell.api;", "public interface ShellContributionSpec {}")
                .addSourceLines("shell/api/ShellBinding.java", "package shell.api;", "public interface ShellBinding {}")
                .addSourceLines("shell/api/ShellRuntimeContext.java", "package shell.api;", "public interface ShellRuntimeContext {}")
                .addSourceLines(
                        "shell/api/ShellTopBarSpec.java",
                        "package shell.api;",
                        "public final class ShellTopBarSpec implements ShellContributionSpec {}")
                .doTest();
    }

    @Test
    public void acceptsImplicitPublicNoArgConstructor() {
        compilationHelper
                .addSourceLines(
                        "src/view/dropdowns/foo/FooTopBarContribution.java",
                        "package src.view.dropdowns.foo;",
                        "import shell.api.ShellBinding;",
                        "import shell.api.ShellContribution;",
                        "import shell.api.ShellContributionSpec;",
                        "import shell.api.ShellRuntimeContext;",
                        "import shell.api.ShellTopBarSpec;",
                        "public final class FooTopBarContribution implements ShellContribution {",
                        "  @Override public ShellContributionSpec registrationSpec() {",
                        "    return new ShellTopBarSpec();",
                        "  }",
                        "  @Override public ShellBinding bind(ShellRuntimeContext runtimeContext) {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "shell/api/ShellContribution.java",
                        "package shell.api;",
                        "public interface ShellContribution {",
                        "  ShellContributionSpec registrationSpec();",
                        "  ShellBinding bind(ShellRuntimeContext runtimeContext);",
                        "}")
                .addSourceLines("shell/api/ShellContributionSpec.java", "package shell.api;", "public interface ShellContributionSpec {}")
                .addSourceLines("shell/api/ShellBinding.java", "package shell.api;", "public interface ShellBinding {}")
                .addSourceLines("shell/api/ShellRuntimeContext.java", "package shell.api;", "public interface ShellRuntimeContext {}")
                .addSourceLines(
                        "shell/api/ShellTopBarSpec.java",
                        "package shell.api;",
                        "public final class ShellTopBarSpec implements ShellContributionSpec {}")
                .doTest();
    }

    @Test
    public void rejectsWrongShellSpecFamily() {
        compilationHelper
                .addSourceLines(
                        "src/view/dropdowns/foo/FooTopBarContribution.java",
                        "package src.view.dropdowns.foo;",
                        "import shell.api.ShellBinding;",
                        "import shell.api.ShellContribution;",
                        "import shell.api.ShellContributionSpec;",
                        "import shell.api.ShellLeftBarTabSpec;",
                        "import shell.api.ShellRuntimeContext;",
                        "// BUG: Diagnostic contains: must construct ShellTopBarSpec",
                        "public final class FooTopBarContribution implements ShellContribution {",
                        "  public FooTopBarContribution() {}",
                        "  @Override public ShellContributionSpec registrationSpec() {",
                        "    return new ShellLeftBarTabSpec();",
                        "  }",
                        "  @Override public ShellBinding bind(ShellRuntimeContext runtimeContext) {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "shell/api/ShellContribution.java",
                        "package shell.api;",
                        "public interface ShellContribution {",
                        "  ShellContributionSpec registrationSpec();",
                        "  ShellBinding bind(ShellRuntimeContext runtimeContext);",
                        "}")
                .addSourceLines("shell/api/ShellContributionSpec.java", "package shell.api;", "public interface ShellContributionSpec {}")
                .addSourceLines("shell/api/ShellBinding.java", "package shell.api;", "public interface ShellBinding {}")
                .addSourceLines("shell/api/ShellRuntimeContext.java", "package shell.api;", "public interface ShellRuntimeContext {}")
                .addSourceLines(
                        "shell/api/ShellLeftBarTabSpec.java",
                        "package shell.api;",
                        "public final class ShellLeftBarTabSpec implements ShellContributionSpec {}")
                .doTest();
    }

    @Test
    public void rejectsMissingPublicNoArgConstructor() {
        compilationHelper
                .addSourceLines(
                        "src/view/leftbartabs/foo/FooContribution.java",
                        "package src.view.leftbartabs.foo;",
                        "import shell.api.ShellBinding;",
                        "import shell.api.ShellContribution;",
                        "import shell.api.ShellContributionSpec;",
                        "import shell.api.ShellLeftBarTabSpec;",
                        "import shell.api.ShellRuntimeContext;",
                        "// BUG: Diagnostic contains: public no-arg constructor",
                        "public final class FooContribution implements ShellContribution {",
                        "  FooContribution(String key) {}",
                        "  @Override public ShellContributionSpec registrationSpec() {",
                        "    return new ShellLeftBarTabSpec();",
                        "  }",
                        "  @Override public ShellBinding bind(ShellRuntimeContext runtimeContext) {",
                        "    return null;",
                        "  }",
                        "}")
                .addSourceLines(
                        "shell/api/ShellContribution.java",
                        "package shell.api;",
                        "public interface ShellContribution {",
                        "  ShellContributionSpec registrationSpec();",
                        "  ShellBinding bind(ShellRuntimeContext runtimeContext);",
                        "}")
                .addSourceLines("shell/api/ShellContributionSpec.java", "package shell.api;", "public interface ShellContributionSpec {}")
                .addSourceLines("shell/api/ShellBinding.java", "package shell.api;", "public interface ShellBinding {}")
                .addSourceLines("shell/api/ShellRuntimeContext.java", "package shell.api;", "public interface ShellRuntimeContext {}")
                .addSourceLines(
                        "shell/api/ShellLeftBarTabSpec.java",
                        "package shell.api;",
                        "public final class ShellLeftBarTabSpec implements ShellContributionSpec {}")
                .doTest();
    }
}
