package shell.host;

/**
 * Passive registration metadata for one shell contribution.
 */
public sealed interface ShellContributionSpec permits ShellTabSpec, ShellTopBarSpec, ShellRuntimeStateSpec {
    ContributionKey key();
}
