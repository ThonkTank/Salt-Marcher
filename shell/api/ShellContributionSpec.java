package shell.api;

/**
 * Passive registration metadata for one shell contribution.
 */
public sealed interface ShellContributionSpec permits ShellLeftBarTabSpec, ShellTopBarSpec, ShellStateTabSpec {
    ContributionKey key();
}
