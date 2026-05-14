package saltmarcher.buildlogic.enforcement

private class EnforcementBundleBuilder(
    private val bundleId: String,
    private val order: Int
) {
    private var selectorTaskDescription: String? = null
    private val dependentBundleIds = linkedSetOf<String>()
    private val buildHarnessArchitectureRuleClasses = linkedSetOf<String>()
    private val buildHarnessDocumentationRuleClasses = linkedSetOf<String>()
    private val buildHarnessDocumentationCoverageSpecIds = linkedSetOf<String>()
    private val buildHarnessTasks = mutableListOf<BuildHarnessTaskSpec>()
    private val errorProneCheckers = linkedSetOf<String>()
    private var archunit: EnforcementArchunitTask? = null
    private var jqassistant: EnforcementJqassistantTask? = null
    private val utilityTasks = mutableListOf<EnforcementUtilityTaskSpec>()
    private var verificationSourceRoots: List<String> = emptyList()
    private var verificationSourceIncludes: List<String> = emptyList()

    fun selectorTask(description: String) {
        selectorTaskDescription = description
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

    fun jqassistant(
        taskName: String,
        description: String,
        sourceConfigPath: String,
        rulesDirPath: String,
        sourceRoots: List<String>,
        sourceIncludes: List<String>
    ) {
        jqassistant = EnforcementJqassistantTask(
            taskName = taskName,
            description = description,
            sourceConfigPath = sourceConfigPath,
            rulesDirPath = rulesDirPath,
            sourceRoots = sourceRoots,
            sourceIncludes = sourceIncludes
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

    fun buildHarnessTopologyTask(ruleClasses: List<String> = buildHarnessArchitectureRuleClasses.toList()) {
        buildHarnessTasks += BuildHarnessTaskSpec(
            kind = BuildHarnessTaskKind.TOPOLOGY,
            ruleClasses = ruleClasses
        )
    }

    fun buildHarnessDocumentationTask(
        ruleClasses: List<String> = buildHarnessDocumentationRuleClasses.toList(),
        coverageSpecIds: List<String> = buildHarnessDocumentationCoverageSpecIds.toList()
    ) {
        buildHarnessTasks += BuildHarnessTaskSpec(
            kind = BuildHarnessTaskKind.DOCUMENTATION,
            ruleClasses = ruleClasses,
            coverageSpecIds = coverageSpecIds
        )
    }

    fun build(): EnforcementBundleDescriptor = EnforcementBundleDescriptor(
        bundleId = bundleId,
        order = order,
        selectorTaskName = bundleSelectorTaskName(bundleId),
        selectorTaskDescription = selectorTaskDescription
            ?: error("Missing selectorTask description for enforcement bundle '$bundleId'."),
        dependentBundleIds = dependentBundleIds.toList(),
        buildHarnessArchitectureRuleClasses = buildHarnessArchitectureRuleClasses.toList(),
        buildHarnessDocumentationRuleClasses = buildHarnessDocumentationRuleClasses.toList(),
        buildHarnessDocumentationCoverageSpecIds = buildHarnessDocumentationCoverageSpecIds.toList(),
        buildHarnessTasks = buildHarnessTasks.toList(),
        errorProneCheckers = errorProneCheckers.toList(),
        archunit = archunit,
        jqassistant = jqassistant,
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

private fun bundleSelectorTaskName(bundleId: String): String =
    "verify${bundleId.replaceFirstChar(Char::uppercaseChar)}Bundle"

private val viewVerificationSourceRoots = listOf("bootstrap", "shell", "src")
private val focusedArchunitIncludes = listOf("src/test/java")
private val domainVerificationSourceRoots = listOf("shell", "src")
private val domainVerificationSourceIncludes = listOf(
    "api/ServiceContribution.java",
    "api/ServiceRegistry.java",
    "domain/**/*.java"
)
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
    selectorTask(description)
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
        selectorTask("Internal selector for the closed-world View Layer topology bundle.")
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*.java", "domain/**/published/**/*.java"))
        buildHarnessTopologyTask(
            listOf("saltmarcher.architecture.view.ViewTopologyPerimeterRules", "saltmarcher.architecture.view.ViewLayerTopologyRules")
        )
        jqassistant(
            taskName = "jqassistantAnalyzeViewLayerEnforcement",
            description = "Analyze View layer reuse direction constraints with jQAssistant.",
            sourceConfigPath = "tools/quality/view-layer-enforcement/jqassistant/config.yml",
            rulesDirPath = "tools/quality/view-layer-enforcement/jqassistant/rules",
            sourceRoots = listOf("src"),
            sourceIncludes = listOf("view/**/*.java")
        )
    },
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "view",
        order = 1,
        description = "Internal selector for the focused passive View enforcement bundle.",
        errorProneCheckers = passiveViewCheckers,
        utilityTasks = listOf("checkViewFxmlResources" to EnforcementUtilityTaskKind.VIEW_FXML_RESOURCES)
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewInputEvent",
        order = 2,
        description = "Internal selector for the focused ViewInputEvent enforcement bundle.",
        errorProneCheckers = viewInputEventCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContribution",
        order = 3,
        description = "Internal selector for the focused View Contribution enforcement bundle.",
        errorProneCheckers = viewContributionCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewBinder",
        order = 4,
        description = "Internal selector for the focused View Binder enforcement bundle.",
        errorProneCheckers = viewBinderCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContributionModel",
        order = 5,
        description = "Internal selector for the focused View ContributionModel enforcement bundle.",
        errorProneCheckers = viewContributionModelCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContentModel",
        order = 6,
        description = "Internal selector for the focused View ContentModel enforcement bundle.",
        errorProneCheckers = viewContentModelCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewIntentHandler",
        order = 7,
        description = "Internal selector for the focused View IntentHandler enforcement bundle.",
        errorProneCheckers = viewIntentHandlerCheckers
    )),
    bundle("stylingLayer", 8) {
        selectorTask("Internal selector for the centralized styling-layer enforcement bundle.")
        errorProneCheckers(listOf("ViewManualNodeStyling", "ViewProgrammaticStyling"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
        utilityTask("checkCentralizedStylesheets", EnforcementUtilityTaskKind.CENTRALIZED_STYLESHEETS)
        utilityTask("checkStylingCentralStylesheetOwner", EnforcementUtilityTaskKind.STYLING_CENTRAL_STYLESHEET_OWNER)
        utilityTask("checkDefinedStyleClassSelectors", EnforcementUtilityTaskKind.DEFINED_STYLE_CLASS_SELECTORS)
        utilityTask("checkManualNodeStyling", EnforcementUtilityTaskKind.MANUAL_NODE_STYLING)
    },
    bundle("stylingView", 9) {
        selectorTask("Internal selector for the passive View direct-render styling enforcement bundle.")
        errorProneCheckers(listOf("ViewDirectRenderStylingPlacement"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
    },
    bundle("bootstrapAppBootstrap", 11) {
        selectorTask("Internal selector for the dedicated AppBootstrap enforcement bundle.")
        verificationSources(listOf("bootstrap", "shell"), listOf("**/*.java"))
        archunit("bootstrapAppBootstrapArchitectureTest", "Run only the AppBootstrap-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/bootstrap/appbootstrap/**"))
    },
    bundle("layeringArchitecture", 11) {
        selectorTask("Internal selector for the dedicated Layering Architecture enforcement bundle.")
        buildHarnessArchitectureRules(listOf(
            "saltmarcher.architecture.layering.LayeringArchitectureTopologyRules",
            "saltmarcher.architecture.layering.LayeringPassiveCarrierMirrorRules"
        ))
        buildHarnessDocumentationCoverageSpecs(listOf("layeringArchitecture"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
        jqassistant(
            taskName = "jqassistantAnalyzeLayeringArchitectureEnforcement",
            description = "Analyze cross-layer boundary, relay, and sprawl graph diagnostics with jQAssistant.",
            sourceConfigPath = "tools/quality/layering-architecture-enforcement/jqassistant/config.yml",
            rulesDirPath = "tools/quality/layering-architecture-enforcement/jqassistant/rules",
            sourceRoots = listOf("bootstrap", "shell", "src"),
            sourceIncludes = listOf("**/*.java")
        )
    },
    bundle("shellAppShell", 11) {
        selectorTask("Internal selector for the dedicated AppShell lifecycle-hook ownership bundle.")
        errorProneCheckers(listOf("ShellLifecycleHookOwnership"))
        verificationSources(listOf("shell"), listOf("**/*.java"))
    },
    bundle("bootstrapLayer", 12) {
        selectorTask("Internal selector for the dedicated Bootstrap Layer enforcement bundle.")
        verificationSources(listOf("bootstrap", "shell"), listOf("**/*.java"))
        archunit("bootstrapLayerArchitectureTest", "Run only the Bootstrap Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/bootstrap/layer/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.bootstrap.layer.BootstrapLayerTopologyRules"))
        buildHarnessTopologyTask()
    },
    bundle("domainContext", 12) {
        selectorTask("Internal selector for the dedicated Domain Context enforcement bundle.")
        buildHarnessDocumentationRules(listOf("saltmarcher.architecture.documentation.domaincontext.DomainContextDocumentationRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainContext"))
        buildHarnessDocumentationTask()
    },
    bundle("domainLayer", 12) {
        selectorTask("Internal selector for the dedicated Domain Layer enforcement bundle.")
        errorProneCheckers(listOf("DomainForbiddenInfrastructureDependency", "DomainModuleNoPublishedCarrierDependency", "DomainSourceTopologyPerimeter"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        archunit("domainLayerArchitectureTest", "Run only the Domain Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/domain/layer/**"))
        buildHarnessArchitectureRules(listOf(
            "saltmarcher.architecture.domain.layer.DomainLayerTopologyRules",
            "saltmarcher.architecture.domain.layer.DomainModuleBoundaryRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainLayer"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("shellLayer", 12) {
        selectorTask("Internal selector for the dedicated Shell Layer enforcement bundle.")
        verificationSources(listOf("shell"), listOf("**/*.java"))
        archunit("shellLayerArchitectureTest", "Run only the Shell Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/shell/layer/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.shell.layer.ShellLayerTopologyRules"))
        buildHarnessTopologyTask()
    },
    bundle("domainUseCase", 13) {
        selectorTask("Internal selector for the dedicated Domain UseCase enforcement bundle.")
        errorProneCheckers(listOf(
            "DomainApplicationNoSameContextPublishedDependency",
            "DomainRootUseCaseNoRootUseCaseChains",
            "DomainRootUseCaseCrossModelFamilyBoundary",
            "DomainUseCaseRoleBoundary"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.usecase.DomainUseCaseTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainUseCase"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("domainApplicationService", 14) {
        selectorTask("Internal selector for the dedicated Domain ApplicationService enforcement bundle.")
        errorProneCheckers(listOf(
            "DomainApplicationServiceApiShape",
            "DomainPublicBoundarySignaturePurity",
            "DomainApplicationServiceRoleBoundary",
            "DomainApplicationServiceThinRouter"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceTopologyRules"))
        buildHarnessDocumentationRules(listOf("saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceDocumentationRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainApplicationService"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("domainPublished", 14) {
        selectorTask("Internal selector for the dedicated Domain Published enforcement bundle.")
        errorProneCheckers(listOf(
            "DomainPublishedCarrierShape",
            "DomainPublishedBoundarySignaturePurity",
            "DomainPublishedReadModelShape",
            "DomainPublishedReadbackSeamBoundary",
            "DomainPublishedOwnershipBoundary"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.published.DomainPublishedTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainPublished"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("domainPort", 15) {
        selectorTask("Internal selector for the focused Domain Port enforcement bundle.")
        errorProneCheckers(listOf("DomainPortRoleBoundary"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.port.DomainPortTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainPort"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("dataLayer", 16) {
        selectorTask("Internal selector for the dedicated Data Layer enforcement bundle.")
        errorProneCheckers(listOf("ServiceRegistryRegistrationPlacement"))
        verificationSources(listOf("src"), listOf("data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/query/**/*.java", "data/**/repository/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        archunit("dataLayerArchitectureTest", "Run only the Data Layer-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/layer/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.layer.DataLayerTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataLayer"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("domainModel", 16) {
        selectorTask("Internal selector for the dedicated Domain Model enforcement bundle.")
        errorProneCheckers(listOf("DomainModelRoleBoundary"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.model.DomainModelTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainModel"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("dataModel", 17) {
        selectorTask("Internal selector for the dedicated Data Model enforcement bundle.")
        errorProneCheckers(listOf("DataModelSourceShape"))
        verificationSources(listOf("src"), listOf("data/**/model/**/*.java"))
        archunit("dataModelArchitectureTest", "Run only the Data Model-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/model/**"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.model.DataModelTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataModel"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("domainHelper", 17) {
        selectorTask("Internal selector for the dedicated Domain Helper enforcement bundle.")
        errorProneCheckers(listOf("DomainHelperRoleBoundary"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.helper.DomainHelperTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainHelper"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("dataGateway", 18) {
        selectorTask("Internal selector for the dedicated Data Gateway enforcement bundle.")
        errorProneCheckers(listOf("DataGatewayReturnTypeBoundary"))
        verificationSources(listOf("src"), listOf("data/**/gateway/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java"))
        archunit("dataGatewayArchitectureTest", "Run only the Data Gateway-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/gateway/**"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataGateway"))
        buildHarnessDocumentationTask()
    },
    bundle("dataMapper", 18) {
        selectorTask("Internal selector for the dedicated Data Mapper enforcement bundle.")
        verificationSources(listOf("src"), listOf("data/**/mapper/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataMapper"))
        buildHarnessDocumentationTask()
    },
    bundle("dataPersistencecore", 18) {
        selectorTask("Internal selector for the dedicated Data Persistencecore enforcement bundle.")
        verificationSources(listOf("src"), listOf("data/**/persistencecore/**/*.java"))
        archunit("dataPersistencecoreArchitectureTest", "Run only the Data Persistencecore-focused architecture test suite.", focusedArchunitIncludes, listOf("architecture/data/persistencecore/**"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataPersistencecore"))
        buildHarnessDocumentationTask()
    },
    bundle("dataQuery", 18) {
        selectorTask("Internal selector for the dedicated Data Query enforcement bundle.")
        errorProneCheckers(listOf("DataQueryGatewayCollaboratorBoundary", "DataQueryForeignPublishedReplyChannelRoundTrip", "DataQueryGatewayMutationBoundary", "DataQueryPublicSignatureBoundary", "DataQueryRoleContract"))
        verificationSources(listOf("src"), listOf("data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.query.DataQueryForeignPublishedPayloadSurfaceRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataQuery"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("dataRepository", 18) {
        selectorTask("Internal selector for the dedicated Data Repository enforcement bundle.")
        errorProneCheckers(listOf("DataRepositoryRoleContract", "DataRepositoryPublicSignatureBoundary", "DataRepositoryGatewayCollaboratorBoundary"))
        verificationSources(listOf("src"), listOf("data/**/repository/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataRepository"))
        buildHarnessDocumentationTask()
    },
    bundle("dataServiceContribution", 18) {
        selectorTask("Internal selector for the dedicated Data ServiceContribution enforcement bundle.")
        errorProneCheckers(listOf("DataServiceContributionConstructionPurity", "DataServiceContributionShellApiAllowlist", "DataServiceContributionRegisterExportShape"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "data/**/*ServiceContribution.java", "data/**/repository/**/*.java", "data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataServiceContribution"))
        buildHarnessDocumentationTask()
    },
    bundle("domainConstants", 18) {
        selectorTask("Internal selector for the dedicated Domain Constants enforcement bundle.")
        errorProneCheckers(listOf("DomainConstantsRoleBoundary"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.constants.DomainConstantsTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainConstants"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    },
    bundle("domainRepository", 19) {
        selectorTask("Internal selector for the dedicated Domain Repository enforcement bundle.")
        errorProneCheckers(listOf("DomainRepositoryRoleBoundary", "DomainRepositoryPublishedStateBoundary"))
        verificationSources(domainVerificationSourceRoots, domainVerificationSourceIncludes)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.repository.DomainRepositoryTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainRepository"))
        buildHarnessTopologyTask()
        buildHarnessDocumentationTask()
    }
)
