package src.domain.sessionplanner;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import src.domain.sessionplanner.model.session.repository.SessionPlanRepository;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;

public final class SessionPlannerServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder services) {
        AtomicReference<SessionPlannerServiceAssembly> assembly = new AtomicReference<>();
        Function<ServiceRegistry, SessionPlannerServiceAssembly> resolver = registry -> resolveAssembly(assembly, registry);
        services.registerFactory(
                SessionPlannerApplicationService.class,
                registry -> resolver.apply(registry).createSessionPlanner(registry));
        services.registerFactory(
                SessionPlannerCurrentSessionModel.class,
                registry -> resolver.apply(registry).currentSessionModel(registry));
        services.registerFactory(
                SessionPlannerCatalogModel.class,
                registry -> resolver.apply(registry).catalogModel(registry));
        services.registerFactory(
                SessionPlannerParticipantsModel.class,
                registry -> resolver.apply(registry).participantsModel(registry));
        services.registerFactory(
                SessionPlannerSceneTimelineModel.class,
                registry -> resolver.apply(registry).sceneTimelineModel(registry));
        services.registerFactory(
                SessionPlannerStatePanelModel.class,
                registry -> resolver.apply(registry).statePanelModel(registry));
    }

    private static SessionPlannerServiceAssembly resolveAssembly(
            AtomicReference<SessionPlannerServiceAssembly> assembly,
            ServiceRegistry registry
    ) {
        SessionPlannerServiceAssembly existing = assembly.get();
        if (existing != null) {
            return existing;
        }
        SessionPlannerServiceAssembly candidate =
                new SessionPlannerServiceAssembly(registry.require(SessionPlanRepository.class));
        return assembly.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(assembly.get(), "assembly");
    }
}
