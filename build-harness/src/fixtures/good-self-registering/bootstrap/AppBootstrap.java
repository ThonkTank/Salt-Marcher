package bootstrap;

import shell.host.AppShell;
import shell.host.ShellViewContribution;

public final class AppBootstrap {
    private final AppShell shell = new AppShell();
    private final ShellViewContribution contribution;

    public AppBootstrap(ShellViewContribution contribution) {
        this.contribution = contribution;
    }
}
