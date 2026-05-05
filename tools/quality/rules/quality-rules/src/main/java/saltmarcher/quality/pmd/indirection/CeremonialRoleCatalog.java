package saltmarcher.quality.pmd.indirection;

import java.util.List;
import java.util.Optional;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class CeremonialRoleCatalog {

    private CeremonialRoleCatalog() {
    }

    static Optional<Role> roleFor(RuleKind ruleKind, SaltMarcherSourceFacts sourceFacts) {
        return rolesFor(ruleKind).stream()
                .filter(role -> role.matches(sourceFacts))
                .findFirst();
    }

    private static List<Role> rolesFor(RuleKind ruleKind) {
        return switch (ruleKind) {
            case DOMAIN_SERVICE -> List.of(Role.DOMAIN_SERVICE);
            case DOMAIN_POLICY -> List.of(Role.DOMAIN_POLICY);
            case DOMAIN_FACTORY -> List.of(Role.DOMAIN_FACTORY);
            case THIN_CANDIDATES -> List.of(
                    Role.DOMAIN_APPLICATION_SERVICE,
                    Role.DOMAIN_USE_CASE,
                    Role.VIEW_BINDER,
                    Role.VIEW_INTENT_HANDLER,
                    Role.DATA_SERVICE_CONTRIBUTION);
        };
    }

    enum RuleKind {
        DOMAIN_SERVICE,
        DOMAIN_POLICY,
        DOMAIN_FACTORY,
        THIN_CANDIDATES
    }

    enum Role {
        DOMAIN_SERVICE(
                "Service",
                "service roles must contribute domain behavior instead of only relaying to ",
                null) {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isDomainServiceSource();
            }
        },
        DOMAIN_POLICY(
                "Policy",
                "policy roles must contribute reusable policy instead of only relaying to ",
                null) {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isDomainPolicySource();
            }
        },
        DOMAIN_FACTORY(
                "Factory",
                "factory roles must own meaningful construction logic instead of only relaying to ",
                null) {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isDomainFactorySource();
            }
        },
        DOMAIN_APPLICATION_SERVICE(
                "ApplicationService",
                null,
                "this role is allowed to stay thin at the root boundary") {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isDomainApplicationServiceRootSource();
            }
        },
        DOMAIN_USE_CASE(
                "UseCase",
                null,
                "application orchestration may be intentionally thin") {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isDomainUseCaseSource();
            }
        },
        VIEW_BINDER(
                "Binder",
                null,
                "runtime composition adapters may legitimately wire and relay") {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isViewBinderSource();
            }
        },
        VIEW_INTENT_HANDLER(
                "IntentHandler",
                null,
                "local input interpretation may stay thin") {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isViewIntentHandlerSource();
            }
        },
        DATA_SERVICE_CONTRIBUTION(
                "ServiceContribution",
                null,
                "runtime registration adapters may legitimately stay thin") {
            @Override
            boolean matches(SaltMarcherSourceFacts sourceFacts) {
                return sourceFacts.isUnderMainSourceRoots() && sourceFacts.isDataServiceContributionSource();
            }
        };

        private final String label;
        private final String blockerExpectation;
        private final String reportOnlyReason;

        Role(String label, String blockerExpectation, String reportOnlyReason) {
            this.label = label;
            this.blockerExpectation = blockerExpectation;
            this.reportOnlyReason = reportOnlyReason;
        }

        public String label() {
            return label;
        }

        public String blockerExpectation() {
            return blockerExpectation;
        }

        public String reportOnlyReason() {
            return reportOnlyReason;
        }

        abstract boolean matches(SaltMarcherSourceFacts sourceFacts);
    }
}
