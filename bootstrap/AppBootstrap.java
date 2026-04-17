package bootstrap;

import shell.host.AppShell;
import shell.host.PersistenceContribution;
import shell.host.PersistenceRegistry;
import shell.host.ShellContributionSpec;
import shell.host.ShellRuntimeContext;
import shell.host.ShellRuntimeStateSpec;
import shell.host.ShellScreen;
import shell.host.ShellTabSpec;
import shell.host.ShellTopBarSpec;
import shell.host.ShellViewContribution;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Generic application bootstrap that discovers feature-owned view contributions from {@code src/}.
 */
public final class AppBootstrap {

    private final ShellViewDiscovery discovery;
    private final PersistenceContributionDiscovery persistenceContributionDiscovery;

    public AppBootstrap() {
        this(new ShellViewDiscovery(), new PersistenceContributionDiscovery());
    }

    AppBootstrap(ShellViewDiscovery discovery, PersistenceContributionDiscovery persistenceContributionDiscovery) {
        this.discovery = discovery;
        this.persistenceContributionDiscovery = persistenceContributionDiscovery;
    }

    public AppShell createShell() {
        AppShell shell = new AppShell(discoverPersistence());

        List<ResolvedContribution> contributions = discoverContributions(shell.runtimeContext());
        for (ResolvedContribution contribution : contributions) {
            register(shell, contribution);
        }

        ShellTabSpec startup = resolveStartupView(contributions);
        if (startup != null) {
            shell.navigateTo(startup.key());
        }
        return shell;
    }

    private PersistenceRegistry discoverPersistence() {
        PersistenceRegistry.Builder builder = new PersistenceRegistry.Builder();
        for (PersistenceContribution contribution : persistenceContributionDiscovery.discover()) {
            contribution.register(builder);
        }
        return builder.build();
    }

    private List<ResolvedContribution> discoverContributions(ShellRuntimeContext runtimeContext) {
        List<ResolvedContribution> resolved = new ArrayList<>();
        for (ShellViewContribution contribution : discovery.discover()) {
            resolved.add(new ResolvedContribution(
                    contribution.registrationSpec(),
                    contribution.createScreen(runtimeContext)));
        }
        resolved.sort(Comparator.comparing(contribution -> contribution.registrationSpec().key().value()));
        return resolved;
    }

    private void register(AppShell shell, ResolvedContribution contribution) {
        ShellContributionSpec spec = contribution.registrationSpec();
        if (spec instanceof ShellTabSpec tabSpec) {
            shell.registerTab(tabSpec, contribution.screen());
            return;
        }
        if (spec instanceof ShellTopBarSpec topBarSpec) {
            shell.registerTopBar(topBarSpec, contribution.screen());
            return;
        }
        if (spec instanceof ShellRuntimeStateSpec runtimeStateSpec) {
            shell.registerRuntimeState(runtimeStateSpec, contribution.screen());
            return;
        }
        throw new IllegalStateException("Unsupported shell contribution type: " + spec.getClass().getName());
    }

    private ShellTabSpec resolveStartupView(List<ResolvedContribution> contributions) {
        ShellTabSpec startup = null;
        for (ResolvedContribution contribution : contributions) {
            if (!(contribution.registrationSpec() instanceof ShellTabSpec tabSpec) || !tabSpec.defaultLanding()) {
                continue;
            }
            if (startup != null) {
                throw new IllegalStateException("Multiple shell tabs declare defaultLanding=true.");
            }
            startup = tabSpec;
        }
        if (startup != null) {
            return startup;
        }
        return contributions.stream()
                .map(ResolvedContribution::registrationSpec)
                .filter(ShellTabSpec.class::isInstance)
                .map(ShellTabSpec.class::cast)
                .sorted(Comparator
                        .comparingInt((ShellTabSpec tab) -> tab.navigationGroup().order())
                        .thenComparing(tab -> tab.navigationGroup().label(), String.CASE_INSENSITIVE_ORDER)
                        .thenComparingInt(ShellTabSpec::viewOrder)
                        .thenComparing(tab -> tab.key().value()))
                .findFirst()
                .orElse(null);
    }

    private record ResolvedContribution(
            ShellContributionSpec registrationSpec,
            ShellScreen screen
    ) {
    }
}
