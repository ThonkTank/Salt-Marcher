package saltmarcher.buildlogic.enforcement

private class EnforcementBundleBuilder(
    private val bundleId: String,
    private val order: Int
) {
    private var entryTaskDescription: String? = null
    private val dependentBundleIds = linkedSetOf<String>()
    private val buildHarnessArchitectureRuleClasses = linkedSetOf<String>()
    private val buildHarnessDocumentationRuleClasses = linkedSetOf<String>()
    private val buildHarnessDocumentationCoverageSpecIds = linkedSetOf<String>()
    private val buildHarnessTasks = mutableListOf<BuildHarnessTaskSpec>()
    private val errorProneCheckers = linkedSetOf<String>()
    private var archunit: EnforcementArchunitTask? = null
    private val utilityTasks = mutableListOf<EnforcementUtilityTaskSpec>()
    private var verificationSourceRoots: List<String> = emptyList()
    private var verificationSourceIncludes: List<String> = emptyList()

    fun entryTask(description: String) {
        entryTaskDescription = description
    }

    fun dependentBundles(bundleIds: List<String>) {
        dependentBundleIds += bundleIds
    }

    fun errorProneCheckers(checkers: List<String>) {
        errorProneCheckers += checkers
    }

    fun verificationSources(roots: List<String>, includes: List<String>) {
        verificationSourceRoots = roots
        verificationSourceIncludes = includes
    }

    fun archunit(
        taskName: String,
        description: String,
        sourceIncludes: List<String>,
        includePatterns: List<String>
    ) {
        archunit = EnforcementArchunitTask(
            taskName = taskName,
            description = description,
            sourceIncludes = sourceIncludes,
            includePatterns = includePatterns
        )
    }

    fun utilityTask(taskName: String, kind: EnforcementUtilityTaskKind) {
        utilityTasks += EnforcementUtilityTaskSpec(taskName, kind)
    }

    fun buildHarnessArchitectureRules(ruleClasses: List<String>) {
        buildHarnessArchitectureRuleClasses += ruleClasses
    }

    fun buildHarnessDocumentationRules(ruleClasses: List<String>) {
        buildHarnessDocumentationRuleClasses += ruleClasses
    }

    fun buildHarnessDocumentationCoverageSpecs(specIds: List<String>) {
        buildHarnessDocumentationCoverageSpecIds += specIds
    }

    fun buildHarnessTopologyTask(
        taskName: String,
        ruleClasses: List<String> = buildHarnessArchitectureRuleClasses.toList()
    ) {
        buildHarnessTasks += BuildHarnessTaskSpec(
            taskName = taskName,
            kind = BuildHarnessTaskKind.TOPOLOGY,
            ruleClasses = ruleClasses
        )
    }

    fun buildHarnessDocumentationTask(
        taskName: String,
        ruleClasses: List<String> = buildHarnessDocumentationRuleClasses.toList(),
        coverageSpecIds: List<String> = buildHarnessDocumentationCoverageSpecIds.toList()
    ) {
        buildHarnessTasks += BuildHarnessTaskSpec(
            taskName = taskName,
            kind = BuildHarnessTaskKind.DOCUMENTATION,
            ruleClasses = ruleClasses,
            coverageSpecIds = coverageSpecIds
        )
    }

    fun build(): EnforcementBundleDescriptor = EnforcementBundleDescriptor(
        bundleId = bundleId,
        order = order,
        entryTaskName = bundleEntryTaskName(bundleId),
        entryTaskDescription = entryTaskDescription
            ?: error("Missing entryTask description for enforcement bundle '$bundleId'."),
        dependentBundleIds = dependentBundleIds.toList(),
        buildHarnessArchitectureRuleClasses = buildHarnessArchitectureRuleClasses.toList(),
        buildHarnessDocumentationRuleClasses = buildHarnessDocumentationRuleClasses.toList(),
        buildHarnessDocumentationCoverageSpecIds = buildHarnessDocumentationCoverageSpecIds.toList(),
        buildHarnessTasks = buildHarnessTasks.toList(),
        errorProneCheckers = errorProneCheckers.toList(),
        archunit = archunit,
        utilityTasks = utilityTasks.toList(),
        verificationSourceRoots = verificationSourceRoots,
        verificationSourceIncludes = verificationSourceIncludes
    )
}

private fun bundle(
    bundleId: String,
    order: Int,
    configure: EnforcementBundleBuilder.() -> Unit
): EnforcementBundleDescriptor = EnforcementBundleBuilder(bundleId, order).apply(configure).build()

private fun bundleEntryTaskName(bundleId: String): String =
    "verify${bundleId.replaceFirstChar(Char::uppercaseChar)}Bundle"

private val viewVerificationSourceRoots = listOf("bootstrap", "shell", "src")
private val focusedArchunitIncludes = listOf("src/test/java")
private val viewVerificationSourceIncludes = listOf(
    "api/**/*.java",
    "view/**/*.java",
    "domain/**/*ApplicationService.java",
    "domain/**/application/**/*.java",
    "domain/**/aggregate/**/*.java",
    "domain/**/context/**/*.java",
    "domain/**/entity/**/*.java",
    "domain/**/event/**/*.java",
    "domain/**/factory/**/*.java",
    "domain/**/policy/**/*.java",
    "domain/**/port/**/*.java",
    "domain/**/published/**/*.java",
    "domain/**/service/**/*.java",
    "domain/**/specification/**/*.java",
    "domain/**/value/**/*.java"
)

private fun EnforcementBundleBuilder.focusedViewRoleRootTask(description: String) {
    entryTask(description)
    dependentBundles(listOf("viewLayer"))
    verificationSources(viewVerificationSourceRoots, viewVerificationSourceIncludes)
}

private data class FocusedViewBundleSpec(
    val bundleId: String,
    val order: Int,
    val description: String,
    val errorProneCheckers: List<String>,
    val utilityTasks: List<Pair<String, EnforcementUtilityTaskKind>> = emptyList()
)

private fun focusedViewBundle(spec: FocusedViewBundleSpec): EnforcementBundleDescriptor = bundle(
    spec.bundleId,
    spec.order
) {
    focusedViewRoleRootTask(spec.description)
    errorProneCheckers(spec.errorProneCheckers)
    spec.utilityTasks.forEach { (taskName, kind) -> utilityTask(taskName, kind) }
}

private val passiveViewCheckers = listOf(
    "PassiveViewSurfaceBoundary",
    "PassiveViewInteractionBoundary",
    "PassiveViewStateBoundary"
)

private val viewInputEventCheckers = listOf(
    "ViewInputEventBoundary",
    "ViewInputEventSnapshotBoundary"
)

private val viewContributionCheckers = listOf(
    "ViewContributionEntrypointShape",
    "ViewContributionDependencyBoundary",
    "ViewContributionShellApiAllowlist"
)

private val viewBinderCheckers = listOf(
    "ViewBinderDependencyBoundary",
    "ViewBinderViewInputEventWiring",
    "ViewBinderApplicationSinkWiring",
    "ViewBinderApplicationServiceReadback",
    "ViewBinderProjectionModelRequestProtocol"
)

private val viewContributionModelCheckers = listOf(
    "ViewContributionModelDependencyBoundary",
    "ViewContributionModelFlatSurface",
    "ViewContributionModelRequestProtocol"
)

// Temporary feature-scoped exception that lives in the shared View core until a real
// dungeon-map-specific enforcement host exists.
private val dungeonMapFeatureScopedContentModelCheckers = listOf(
    "DungeonMapContentModelProjectionBoundary"
)

private val viewContentModelCheckers = listOf(
    "ViewContentModelDependencyBoundary",
    "ViewContentModelFlatSurface"
) + dungeonMapFeatureScopedContentModelCheckers + listOf(
    "ViewContentModelPublishedTranslationBoundary"
)

private val viewIntentHandlerCheckers = listOf(
    "ViewIntentHandlerDependencyBoundary",
    "ViewIntentHandlerViewInputEvent"
)

fun standardEnforcementBundleDescriptors(): List<EnforcementBundleDescriptor> = listOf(
    bundle("viewLayer", 0) {
        entryTask("Run the closed-world View Layer topology bundle through one root entrypoint.")
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*.java", "domain/**/published/**/*.java"))
        buildHarnessTopologyTask(
            "checkViewLayerEnforcement",
            listOf("saltmarcher.architecture.view.ViewTopologyPerimeterRules", "saltmarcher.architecture.view.ViewLayerTopologyRules")
        )
    },
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "view",
        order = 1,
        description = "Run the focused passive View enforcement bundle through one root entrypoint.",
        errorProneCheckers = passiveViewCheckers,
        utilityTasks = listOf("checkViewFxmlResources" to EnforcementUtilityTaskKind.VIEW_FXML_RESOURCES)
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewInputEvent",
        order = 2,
        description = "Run the focused ViewInputEvent enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewInputEventCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContribution",
        order = 3,
        description = "Run the focused View Contribution enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewContributionCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewBinder",
        order = 4,
        description = "Run the focused View Binder enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewBinderCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContributionModel",
        order = 5,
        description = "Run the focused View ContributionModel enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewContributionModelCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContentModel",
        order = 6,
        description = "Run the focused View ContentModel enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewContentModelCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewIntentHandler",
        order = 7,
        description = "Run the focused View IntentHandler enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewIntentHandlerCheckers
    )),
    bundle("stylingLayer", 8) {
        entryTask("Run the centralized styling-layer enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("ViewProgrammaticStyling"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
        utilityTask("checkCentralizedStylesheets", EnforcementUtilityTaskKind.CENTRALIZED_STYLESHEETS)
        utilityTask("checkStylingCentralStylesheetOwner", EnforcementUtilityTaskKind.STYLING_CENTRAL_STYLESHEET_OWNER)
        utilityTask("checkDefinedStyleClassSelectors", EnforcementUtilityTaskKind.DEFINED_STYLE_CLASS_SELECTORS)
    },
    bundle("stylingView", 9) {
        entryTask("Run the passive View direct-render styling enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("ViewDirectRenderStylingPlacement"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
    },
    bundle("bootstrapAppBootstrap", 11) {
        entryTask("Run the dedicated AppBootstrap enforcement bundle through one root entrypoint.")
        verificationSources(listOf("bootstrap", "shell"), listOf("**/*.java"))
        archunit("bootstrapAppBootstrapArchitectureTest", "Run only the AppBootstrap-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/bootstrap/appbootstrap/**"))
    },
    bundle("layeringArchitecture", 11) {
        entryTask("Run the dedicated Layering Architecture enforcement bundle through one root entrypoint.")
        buildHarnessArchitectureRules(listOf(
            "saltmarcher.architecture.layering.LayeringArchitectureTopologyRules",
            "saltmarcher.architecture.layering.LayeringPassiveCarrierMirrorRules"
        ))
        buildHarnessDocumentationCoverageSpecs(listOf("layeringArchitecture"))
        buildHarnessTopologyTask("layeringArchitectureTopologyCheck")
        buildHarnessDocumentationTask("layeringArchitectureDocumentationEnforcementCheck")
    },
    bundle("shellAppShell", 11) {
        entryTask("Run the dedicated AppShell lifecycle-hook ownership bundle through one root entrypoint.")
        errorProneCheckers(listOf("ShellLifecycleHookOwnership"))
        verificationSources(listOf("shell"), listOf("**/*.java"))
    },
    bundle("bootstrapLayer", 12) {
        entryTask("Run the dedicated Bootstrap Layer enforcement bundle through one root entrypoint.")
        verificationSources(listOf("bootstrap", "shell"), listOf("**/*.java"))
        archunit("bootstrapLayerArchitectureTest", "Run only the Bootstrap Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/bootstrap/layer/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.bootstrap.layer.BootstrapLayerTopologyRules"))
        buildHarnessTopologyTask("bootstrapLayerTopologyCheck")
    },
    bundle("domainContext", 12) {
        entryTask("Run the dedicated Domain Context enforcement bundle through one root entrypoint.")
        buildHarnessDocumentationRules(listOf("saltmarcher.architecture.documentation.domaincontext.DomainContextDocumentationRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainContext"))
        buildHarnessDocumentationTask("domainContextEnforcementDocumentationCheck")
    },
    bundle("domainLayer", 12) {
        entryTask("Run the dedicated Domain Layer enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainForbiddenInfrastructureDependency", "DomainModuleNoPublishedCarrierDependency", "DomainSourceTopologyPerimeter"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        archunit("domainLayerArchitectureTest", "Run only the Domain Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/domain/layer/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.layer.DomainLayerTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainLayer"))
        buildHarnessTopologyTask("domainLayerTopologyCheck")
        buildHarnessDocumentationTask("domainLayerDocumentationEnforcementCheck")
    },
    bundle("shellLayer", 12) {
        entryTask("Run the dedicated Shell Layer enforcement bundle through one root entrypoint.")
        verificationSources(listOf("shell"), listOf("**/*.java"))
        archunit("shellLayerArchitectureTest", "Run only the Shell Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/shell/layer/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.shell.layer.ShellLayerTopologyRules"))
        buildHarnessTopologyTask("shellLayerTopologyCheck")
    },
    bundle("domainUseCase", 13) {
        entryTask("Run the dedicated Domain UseCase enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainApplicationNoSameContextPublishedDependency", "DomainUseCaseRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.usecase.DomainUseCaseTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainUseCase"))
        buildHarnessTopologyTask("domainUseCaseTopologyCheck")
        buildHarnessDocumentationTask("domainUseCaseDocumentationEnforcementCheck")
    },
    bundle("domainApplicationService", 14) {
        entryTask("Run the dedicated Domain ApplicationService enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainApplicationServiceApiShape", "DomainPublicBoundarySignaturePurity", "DomainApplicationServiceRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceTopologyRules"))
        buildHarnessDocumentationRules(listOf("saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceDocumentationRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainApplicationService"))
        buildHarnessTopologyTask("domainApplicationServiceTopologyCheck")
        buildHarnessDocumentationTask("domainApplicationServiceDocumentationEnforcementCheck")
    },
    bundle("domainPublished", 14) {
        entryTask("Run the dedicated Domain Published enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainPublishedCarrierShape", "DomainPublishedBoundarySignaturePurity", "DomainPublishedReadModelShape", "DomainPublishedOwnershipBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.published.DomainPublishedTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainPublished"))
        buildHarnessTopologyTask("domainPublishedTopologyCheck")
        buildHarnessDocumentationTask("domainPublishedDocumentationEnforcementCheck")
    },
    bundle("domainPort", 15) {
        entryTask("Run the focused Domain Port enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainPortRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.port.DomainPortTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainPort"))
        buildHarnessTopologyTask("domainPortTopologyCheck")
        buildHarnessDocumentationTask("domainPortEnforcementDocumentationCheck")
    },
    bundle("dataLayer", 16) {
        entryTask("Run the dedicated Data Layer enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("ServiceRegistryRegistrationPlacement"))
        verificationSources(listOf("src"), listOf("data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/query/**/*.java", "data/**/repository/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        archunit("dataLayerArchitectureTest", "Run only the Data Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/layer/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.layer.DataLayerTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataLayer"))
        buildHarnessTopologyTask("dataLayerTopologyCheck")
        buildHarnessDocumentationTask("dataLayerDocumentationEnforcementCheck")
    },
    bundle("domainModel", 16) {
        entryTask("Run the dedicated Domain Model enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainModelRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.model.DomainModelTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainModel"))
        buildHarnessTopologyTask("domainModelTopologyCheck")
        buildHarnessDocumentationTask("domainModelDocumentationEnforcementCheck")
    },
    bundle("dataModel", 17) {
        entryTask("Run the dedicated Data Model enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DataModelSourceShape"))
        verificationSources(listOf("src"), listOf("data/**/model/**/*.java"))
        archunit("dataModelArchitectureTest", "Run only the Data Model-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/model/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.model.DataModelTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataModel"))
        buildHarnessTopologyTask("dataModelTopologyCheck")
        buildHarnessDocumentationTask("dataModelDocumentationEnforcementCheck")
    },
    bundle("domainHelper", 17) {
        entryTask("Run the dedicated Domain Helper enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainHelperRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.helper.DomainHelperTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainHelper"))
        buildHarnessTopologyTask("domainHelperTopologyCheck")
        buildHarnessDocumentationTask("domainHelperDocumentationEnforcementCheck")
    },
    bundle("dataGateway", 18) {
        entryTask("Run the dedicated Data Gateway enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DataGatewayReturnTypeBoundary"))
        verificationSources(listOf("src"), listOf("data/**/gateway/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java"))
        archunit("dataGatewayArchitectureTest", "Run only the Data Gateway-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/gateway/**"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataGateway"))
        buildHarnessDocumentationTask("dataGatewayEnforcementDocumentationCheck")
    },
    bundle("dataMapper", 18) {
        entryTask("Run the dedicated Data Mapper enforcement bundle through one root entrypoint.")
        verificationSources(listOf("src"), listOf("data/**/mapper/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataMapper"))
        buildHarnessDocumentationTask("dataMapperEnforcementDocumentationCheck")
    },
    bundle("dataPersistencecore", 18) {
        entryTask("Run the dedicated Data Persistencecore enforcement bundle through one root entrypoint.")
        verificationSources(listOf("src"), listOf("data/**/persistencecore/**/*.java"))
        archunit("dataPersistencecoreArchitectureTest", "Run only the Data Persistencecore-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/persistencecore/**"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataPersistencecore"))
        buildHarnessDocumentationTask("dataPersistencecoreDocumentationEnforcementCheck")
    },
    bundle("dataQuery", 18) {
        entryTask("Run the dedicated Data Query enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DataQueryGatewayCollaboratorBoundary", "DataQueryForeignPublishedReplyChannelRoundTrip", "DataQueryGatewayMutationBoundary", "DataQueryPublicSignatureBoundary", "DataQueryRoleContract"))
        verificationSources(listOf("src"), listOf("data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.query.DataQueryForeignPublishedPayloadSurfaceRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataQuery"))
        buildHarnessTopologyTask("dataQueryTopologyCheck")
        buildHarnessDocumentationTask("dataQueryEnforcementDocumentationCheck")
    },
    bundle("dataRepository", 18) {
        entryTask("Run the dedicated Data Repository enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DataRepositoryRoleContract", "DataRepositoryPublicSignatureBoundary", "DataRepositoryGatewayCollaboratorBoundary"))
        verificationSources(listOf("src"), listOf("data/**/repository/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataRepository"))
        buildHarnessDocumentationTask("dataRepositoryEnforcementDocumentationCheck")
    },
    bundle("dataServiceContribution", 18) {
        entryTask("Run the dedicated Data ServiceContribution enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DataServiceContributionConstructionPurity", "DataServiceContributionShellApiAllowlist", "DataServiceContributionRegisterExportShape"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "data/**/*ServiceContribution.java", "data/**/repository/**/*.java", "data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataServiceContribution"))
        buildHarnessDocumentationTask("dataServiceContributionDocumentationEnforcementCheck")
    },
    bundle("domainConstants", 18) {
        entryTask("Run the dedicated Domain Constants enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainConstantsRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.constants.DomainConstantsTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainConstants"))
        buildHarnessTopologyTask("domainConstantsTopologyCheck")
        buildHarnessDocumentationTask("domainConstantsDocumentationEnforcementCheck")
    },
    bundle("domainRepository", 19) {
        entryTask("Run the dedicated Domain Repository enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf("DomainRepositoryRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.repository.DomainRepositoryTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainRepository"))
        buildHarnessTopologyTask("domainRepositoryTopologyCheck")
        buildHarnessDocumentationTask("domainRepositoryDocumentationEnforcementCheck")
    }
)
