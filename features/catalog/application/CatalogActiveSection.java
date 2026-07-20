package features.catalog.application;

import java.util.Objects;

/** Existential wrapper that preserves Q/R/K until a generic receiver consumes the active section. */
public interface CatalogActiveSection {

    CatalogSectionId id();

    void dispatch(Receiver receiver);

    static <Q, R, K> CatalogActiveSection of(CatalogSectionBinding<Q, R, K> binding) {
        return new Typed<>(binding);
    }

    interface Receiver {
        <Q, R, K> void accept(CatalogSectionBinding<Q, R, K> binding);
    }

    final class Typed<Q, R, K> implements CatalogActiveSection {
        private final CatalogSectionBinding<Q, R, K> binding;

        private Typed(CatalogSectionBinding<Q, R, K> binding) {
            this.binding = Objects.requireNonNull(binding, "binding");
        }

        @Override public CatalogSectionId id() {
            return binding.definition().id();
        }

        @Override public void dispatch(Receiver receiver) {
            Objects.requireNonNull(receiver, "receiver").accept(binding);
        }
    }
}
