package saltmarcher.quality.errorprone.view.contribution;

import com.sun.source.tree.CompilationUnitTree;
import java.util.Set;
import java.util.regex.Pattern;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

final class ViewContributionArchitectureSupport {

    private static final Pattern CONTRIBUTION_PACKAGE = Pattern.compile(
            "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$");

    private static final Set<String> CONTRIBUTION_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ContributionKey",
            "shell.api.InspectorEntrySpec",
            "shell.api.InspectorSink",
            "shell.api.NavigationGraphicResource",
            "shell.api.NavigationGroupSpec",
            "shell.api.ShellBinding",
            "shell.api.ShellContribution",
            "shell.api.ShellContributionSpec",
            "shell.api.ShellRuntimeContext",
            "shell.api.ShellStateTabSpec",
            "shell.api.ShellLeftBarTabMode",
            "shell.api.ShellLeftBarTabSpec",
            "shell.api.ShellTopBarSpec");

    private ViewContributionArchitectureSupport() {
    }

    static boolean isContributionSource(CompilationUnitTree tree) {
        return CONTRIBUTION_PACKAGE.matcher(packageName(tree)).matches()
                && sourceFileName(tree).endsWith("Contribution.java");
    }

    static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }

    static boolean isAllowedContributionShellType(String referencedType) {
        if (referencedType == null || !referencedType.startsWith("shell.")) {
            return true;
        }
        for (String allowedType : CONTRIBUTION_ALLOWED_SHELL_TYPES) {
            if (referencedType.equals(allowedType)
                    || referencedType.startsWith(allowedType + "$")
                    || referencedType.startsWith(allowedType + ".")) {
                return true;
            }
        }
        return false;
    }

    static boolean isForbiddenViewInfrastructureJdkType(String referencedType) {
        return ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType);
    }

    static boolean isSameViewRootReference(String sourcePackageName, String referencedType) {
        return ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
    }

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }
}
