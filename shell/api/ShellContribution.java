package shell.api;

/**
 * Shell-registered tab, state-tab, or top-bar contribution.
 */
public interface ShellContribution {

    ShellContributionSpec registrationSpec();

    ShellBinding bind();
}
