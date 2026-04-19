package bootstrap;

import org.jspecify.annotations.Nullable;
import shell.host.AppShell;
import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellRuntimeStateSpec;
import shell.api.ShellTabSpec;
import shell.api.ShellTopBarSpec;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Generic application bootstrap that discovers feature-owned shell contributions from {@code src/}.
 */
public final class AppBootstrap {

    private final ShellViewDiscovery discovery;
    private final ServiceContributionDiscovery serviceContributionDiscovery;

    public AppBootstrap() {
        this(new ShellViewDiscovery(), new ServiceContributionDiscovery());
    }

    AppBootstrap(ShellViewDiscovery discovery, ServiceContributionDiscovery serviceContributionDiscovery) {
        this.discovery = discovery;
        this.serviceContributionDiscovery = serviceContributionDiscovery;
    }

    public AppShell createShell() {
        AppShell shell = new AppShell(discoverServices());

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

    private ServiceRegistry discoverServices() {
        ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
        for (ServiceContribution contribution : serviceContributionDiscovery.discover()) {
            contribution.register(builder);
        }
        return builder.build();
    }

    private List<ResolvedContribution> discoverContributions(ShellRuntimeContext runtimeContext) {
        List<ResolvedContribution> resolved = new ArrayList<>();
        for (ShellContribution contribution : discovery.discover()) {
            resolved.add(new ResolvedContribution(
                    contribution.registrationSpec(),
                    contribution.bind(runtimeContext)));
        }
        resolved.sort(Comparator.comparing(contribution -> contribution.registrationSpec().key().value()));
        return resolved;
    }

    private void register(AppShell shell, ResolvedContribution contribution) {
        ShellContributionSpec spec = contribution.registrationSpec();
        if (spec instanceof ShellTabSpec tabSpec) {
            shell.registerTab(tabSpec, contribution.binding());
            return;
        }
        if (spec instanceof ShellTopBarSpec topBarSpec) {
            shell.registerTopBar(topBarSpec, contribution.binding());
            return;
        }
        if (spec instanceof ShellRuntimeStateSpec runtimeStateSpec) {
            shell.registerRuntimeState(runtimeStateSpec, contribution.binding());
            return;
        }
        throw new IllegalStateException("Unsupported shell contribution type: " + spec.getClass().getName());
    }

    private @Nullable ShellTabSpec resolveStartupView(List<ResolvedContribution> contributions) {
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
            ShellBinding binding
    ) {
    }
}
