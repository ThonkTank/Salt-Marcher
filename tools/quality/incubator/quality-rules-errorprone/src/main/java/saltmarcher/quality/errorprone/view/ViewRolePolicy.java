package saltmarcher.quality.errorprone.view;

import java.util.Set;

public final class ViewRolePolicy {

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

    private static final Set<String> INSPECTOR_ALLOWED_SHELL_TYPES = Set.of("shell.api.InspectorEntrySpec");

    private ViewRolePolicy() {
    }

    public static boolean isAllowedContributionShellType(String referencedType) {
        return isAllowedShellType(referencedType, CONTRIBUTION_ALLOWED_SHELL_TYPES);
    }

    public static boolean isAllowedInspectorShellType(String referencedType) {
        return isAllowedShellType(referencedType, INSPECTOR_ALLOWED_SHELL_TYPES);
    }

    private static boolean isAllowedShellType(String referencedType, Set<String> allowlist) {
        if (referencedType == null || !referencedType.startsWith("shell.")) {
            return true;
        }
        for (String allowedType : allowlist) {
            if (referencedType.equals(allowedType)
                    || referencedType.startsWith(allowedType + "$")
                    || referencedType.startsWith(allowedType + ".")) {
                return true;
            }
        }
        return false;
    }
}
