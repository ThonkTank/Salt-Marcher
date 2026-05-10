package saltmarcher.buildlogic.enforcement

private class EnforcementBundleBuilder(
    private val bundleId: String,
    private val order: Int,
    private val taskNames: List<String>
) {
    private var rootTask: EnforcementRootTask? = null
    private val rootTaskDependencies = linkedSetOf<String>()
    private val buildHarnessArchitectureRuleClasses = linkedSetOf<String>()
    private val buildHarnessDocumentationRuleClasses = linkedSetOf<String>()
    private val buildHarnessDocumentationCoverageSpecIds = linkedSetOf<String>()
    private val buildHarnessTaskMainClasses = linkedMapOf<String, String>()
    private val buildHarnessTaskRuleClasses = linkedMapOf<String, List<String>>()
    private val errorProneCheckers = linkedSetOf<String>()
    private var archunit: EnforcementArchunitTask? = null
    private val customTasks = mutableListOf<EnforcementCustomTask>()
    private var verificationSourceRoots: List<String> = emptyList()
    private var verificationSourceIncludes: List<String> = emptyList()

    fun rootTask(description: String, attachToCheck: Boolean, attachToCheckArchitecture: Boolean) {
        rootTask = EnforcementRootTask(description, attachToCheck, attachToCheckArchitecture)
    }

    fun rootTaskDependencies(taskNames: List<String>) {
        rootTaskDependencies += taskNames
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
        sourceDirs: List<String>,
        sourceIncludes: List<String>,
        includePatterns: List<String>,
        useSharedTestSupport: Boolean
    ) {
        archunit = EnforcementArchunitTask(
            taskName = taskName,
            description = description,
            sourceDirs = sourceDirs,
            sourceIncludes = sourceIncludes,
            includePatterns = includePatterns,
            useSharedTestSupport = useSharedTestSupport
        )
    }

    fun customTask(taskName: String, kind: String) {
        customTasks += EnforcementCustomTask(taskName, kind)
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

    fun buildHarnessMain(taskName: String, mainClass: String) {
        buildHarnessTaskMainClasses[taskName] = mainClass
    }

    fun buildHarnessRules(taskName: String, ruleClasses: List<String>) {
        buildHarnessTaskRuleClasses[taskName] = ruleClasses
    }

    fun build(): EnforcementBundleDescriptor = EnforcementBundleDescriptor(
        bundleId = bundleId,
        order = order,
        taskNames = taskNames,
        rootTask = rootTask,
        rootTaskDependencies = rootTaskDependencies.toList(),
        buildHarnessArchitectureRuleClasses = buildHarnessArchitectureRuleClasses.toList(),
        buildHarnessDocumentationRuleClasses = buildHarnessDocumentationRuleClasses.toList(),
        buildHarnessDocumentationCoverageSpecIds = buildHarnessDocumentationCoverageSpecIds.toList(),
        buildHarnessTaskMainClasses = buildHarnessTaskMainClasses.toMap(),
        buildHarnessTaskRuleClasses = buildHarnessTaskRuleClasses.toMap(),
        errorProneCheckers = errorProneCheckers.toList(),
        archunit = archunit,
        customTasks = customTasks.toList(),
        verificationSourceRoots = verificationSourceRoots,
        verificationSourceIncludes = verificationSourceIncludes
    )
}

private fun bundle(
    bundleId: String,
    order: Int,
    taskNames: List<String>,
    configure: EnforcementBundleBuilder.() -> Unit
): EnforcementBundleDescriptor = EnforcementBundleBuilder(bundleId, order, taskNames).apply(configure).build()

private val viewVerificationSourceRoots = listOf("bootstrap", "shell", "src")
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
    rootTask(description, true, true)
    rootTaskDependencies(listOf("checkViewLayerEnforcement"))
    verificationSources(viewVerificationSourceRoots, viewVerificationSourceIncludes)
}

private data class FocusedViewBundleSpec(
    val bundleId: String,
    val order: Int,
    val taskNames: List<String>,
    val description: String,
    val errorProneCheckers: List<String>,
    val customTasks: List<Pair<String, String>> = emptyList()
)

private fun focusedViewBundle(spec: FocusedViewBundleSpec): EnforcementBundleDescriptor = bundle(
    spec.bundleId,
    spec.order,
    spec.taskNames
) {
    focusedViewRoleRootTask(spec.description)
    errorProneCheckers(spec.errorProneCheckers)
    spec.customTasks.forEach { (taskName, kind) -> customTask(taskName, kind) }
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
    bundle("viewLayer", 0, listOf("checkViewLayerEnforcement")) {
        rootTask("Run the closed-world View Layer topology bundle through one root entrypoint.", false, true)
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*.java", "domain/**/published/**/*.java"))
        buildHarnessRules("checkViewLayerEnforcement", listOf("saltmarcher.architecture.view.ViewTopologyPerimeterRules", "saltmarcher.architecture.view.ViewLayerTopologyRules"))
    },
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "view",
        order = 1,
        taskNames = listOf("checkPassiveViewEnforcement", "checkViewFxmlResources"),
        description = "Run the focused passive View enforcement bundle through one root entrypoint.",
        errorProneCheckers = passiveViewCheckers,
        customTasks = listOf("checkViewFxmlResources" to "viewFxmlResources")
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewInputEvent",
        order = 2,
        taskNames = listOf("checkViewInputEventEnforcement"),
        description = "Run the focused ViewInputEvent enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewInputEventCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContribution",
        order = 3,
        taskNames = listOf("checkViewContributionEnforcement"),
        description = "Run the focused View Contribution enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewContributionCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewBinder",
        order = 4,
        taskNames = listOf("checkViewBinderEnforcement"),
        description = "Run the focused View Binder enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewBinderCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContributionModel",
        order = 5,
        taskNames = listOf("checkViewContributionModelEnforcement"),
        description = "Run the focused View ContributionModel enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewContributionModelCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewContentModel",
        order = 6,
        taskNames = listOf("checkViewContentModelEnforcement"),
        description = "Run the focused View ContentModel enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewContentModelCheckers
    )),
    focusedViewBundle(FocusedViewBundleSpec(
        bundleId = "viewIntentHandler",
        order = 7,
        taskNames = listOf("checkViewIntentHandlerEnforcement"),
        description = "Run the focused View IntentHandler enforcement bundle through one root entrypoint.",
        errorProneCheckers = viewIntentHandlerCheckers
    )),
    bundle("stylingLayer", 8, listOf("checkStylingLayerEnforcement", "checkCentralizedStylesheets", "checkStylingCentralStylesheetOwner", "checkDefinedStyleClassSelectors")) {
        rootTask("Run the centralized styling-layer enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("ViewProgrammaticStyling"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
        customTask("checkCentralizedStylesheets", "centralizedStylesheets")
        customTask("checkStylingCentralStylesheetOwner", "stylingCentralStylesheetOwner")
        customTask("checkDefinedStyleClassSelectors", "definedStyleClassSelectors")
    },
    bundle("stylingView", 9, listOf("checkStylingViewEnforcement")) {
        rootTask("Run the passive View direct-render styling enforcement bundle through one root entrypoint.", true, false)
        errorProneCheckers(listOf("ViewDirectRenderStylingPlacement"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
    },
    bundle("bootstrapAppBootstrap", 11, listOf("checkBootstrapAppBootstrapEnforcement", "bootstrapAppBootstrapArchitectureTest")) {
        rootTask("Run the dedicated AppBootstrap enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("bootstrap", "shell"), listOf("**/*.java"))
        archunit("bootstrapAppBootstrapArchitectureTest", "Run only the AppBootstrap-focused architecture test suite.", listOf("tools/quality/bootstrap-app-bootstrap-enforcement/archunit/src/test/java"), listOf("architecture/bootstrap/appbootstrap/**"), listOf("architecture/bootstrap/appbootstrap/**"), true)
    },
    bundle("layeringArchitecture", 11, listOf("checkLayeringArchitectureEnforcement", "layeringArchitectureTopologyCheck", "layeringArchitectureDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Layering Architecture enforcement bundle through one root entrypoint.", true, true)
        buildHarnessDocumentationCoverageSpecs(listOf("layeringArchitecture"))
    },
    bundle("shellAppShell", 11, listOf("checkShellAppShellEnforcement")) {
        rootTask("Run the dedicated AppShell lifecycle-hook ownership bundle through one root entrypoint.", false, false)
        errorProneCheckers(listOf("ShellLifecycleHookOwnership"))
        verificationSources(listOf("shell"), listOf("**/*.java"))
    },
    bundle("bootstrapLayer", 12, listOf("checkBootstrapLayerEnforcement", "bootstrapLayerArchitectureTest", "bootstrapLayerTopologyCheck")) {
        rootTask("Run the dedicated Bootstrap Layer enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("bootstrap", "shell"), listOf("**/*.java"))
        archunit("bootstrapLayerArchitectureTest", "Run only the Bootstrap Layer-focused architecture test suite.", listOf("tools/quality/bootstrap-layer-enforcement/archunit/src/test/java"), listOf("architecture/bootstrap/layer/**"), listOf("architecture/bootstrap/layer/**"), true)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.bootstrap.layer.BootstrapLayerTopologyRules"))
    },
    bundle("domainContext", 12, listOf("checkDomainContextEnforcement", "domainContextEnforcementDocumentationCheck")) {
        rootTask("Run the dedicated Domain Context enforcement bundle through one root entrypoint.", false, false)
        buildHarnessDocumentationRules(listOf("saltmarcher.architecture.documentation.domaincontext.DomainContextDocumentationRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainContext"))
    },
    bundle("domainLayer", 12, listOf("checkDomainLayerEnforcement", "domainLayerArchitectureTest", "domainLayerTopologyCheck", "domainLayerDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain Layer enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DomainForbiddenInfrastructureDependency", "DomainModuleNoPublishedCarrierDependency", "DomainSourceTopologyPerimeter"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        archunit("domainLayerArchitectureTest", "Run only the Domain Layer-focused architecture test suite.", listOf("tools/quality/domain-layer-enforcement/archunit/src/test/java"), listOf("architecture/domain/layer/**"), listOf("architecture/domain/layer/**"), true)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.layer.DomainLayerTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainLayer"))
    },
    bundle("shellLayer", 12, listOf("checkShellLayerEnforcement", "shellLayerArchitectureTest", "shellLayerTopologyCheck")) {
        rootTask("Run the dedicated Shell Layer enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("shell"), listOf("**/*.java"))
        archunit("shellLayerArchitectureTest", "Run only the Shell Layer-focused architecture test suite.", listOf("tools/quality/shell-layer-enforcement/archunit/src/test/java"), listOf("architecture/shell/layer/**"), listOf("architecture/shell/layer/**"), true)
    },
    bundle("domainUseCase", 13, listOf("checkDomainUseCaseEnforcement", "domainUseCaseTopologyCheck", "domainUseCaseDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain UseCase enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DomainApplicationNoSameContextPublishedDependency", "DomainUseCaseRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainUseCase"))
    },
    bundle("domainApplicationService", 14, listOf("checkDomainApplicationServiceEnforcement", "domainApplicationServiceTopologyCheck", "domainApplicationServiceDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain ApplicationService enforcement bundle through one root entrypoint.", false, true)
        errorProneCheckers(listOf("DomainApplicationServiceApiShape", "DomainPublicBoundarySignaturePurity", "DomainApplicationServiceRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceTopologyRules"))
        buildHarnessDocumentationRules(listOf("saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceDocumentationRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainApplicationService"))
    },
    bundle("domainPublished", 14, listOf("checkDomainPublishedEnforcement", "domainPublishedTopologyCheck", "domainPublishedDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain Published enforcement bundle through one root entrypoint.", false, false)
        errorProneCheckers(listOf("DomainPublishedCarrierShape", "DomainPublishedBoundarySignaturePurity", "DomainPublishedReadModelShape", "DomainPublishedOwnershipBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.published.DomainPublishedTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainPublished"))
    },
    bundle("domainPort", 15, listOf("checkDomainPortEnforcement", "domainPortTopologyCheck", "domainPortEnforcementDocumentationCheck")) {
        rootTask("Run the focused Domain Port enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DomainPortRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.port.DomainPortTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainPort"))
    },
    bundle("dataLayer", 16, listOf("checkDataLayerEnforcement", "dataLayerArchitectureTest", "dataLayerTopologyCheck", "dataLayerDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Data Layer enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("ServiceRegistryRegistrationPlacement"))
        verificationSources(listOf("src"), listOf("data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/query/**/*.java", "data/**/repository/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        archunit("dataLayerArchitectureTest", "Run only the Data Layer-focused architecture test suite.", listOf("tools/quality/data-layer-enforcement/archunit/src/test/java"), listOf("architecture/data/layer/**"), listOf("architecture/data/layer/**"), true)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.layer.DataLayerTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataLayer"))
    },
    bundle("domainModel", 16, listOf("checkDomainModelEnforcement", "domainModelTopologyCheck", "domainModelDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain Model enforcement bundle through one root entrypoint.", false, true)
        errorProneCheckers(listOf("DomainModelRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.model.DomainModelTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainModel"))
    },
    bundle("dataModel", 17, listOf("checkDataModelEnforcement", "dataModelArchitectureTest", "dataModelTopologyCheck", "dataModelDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Data Model enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataModelSourceShape"))
        verificationSources(listOf("src"), listOf("data/**/model/**/*.java"))
        archunit("dataModelArchitectureTest", "Run only the Data Model-focused architecture test suite.", listOf("tools/quality/data-model-enforcement/archunit/src/test/java"), listOf("architecture/data/model/**"), listOf("architecture/data/model/**"), true)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.model.DataModelTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataModel"))
    },
    bundle("domainHelper", 17, listOf("checkDomainHelperEnforcement", "domainHelperTopologyCheck", "domainHelperDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain Helper enforcement bundle through one root entrypoint.", false, true)
        errorProneCheckers(listOf("DomainHelperRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.helper.DomainHelperTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainHelper"))
    },
    bundle("dataGateway", 18, listOf("checkDataGatewayEnforcement", "dataGatewayArchitectureTest", "dataGatewayEnforcementDocumentationCheck")) {
        rootTask("Run the dedicated Data Gateway enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataGatewayReturnTypeBoundary"))
        verificationSources(listOf("src"), listOf("data/**/gateway/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java"))
        archunit("dataGatewayArchitectureTest", "Run only the Data Gateway-focused architecture test suite.", listOf("tools/quality/data-gateway-enforcement/archunit/src/test/java"), listOf("architecture/data/gateway/**"), listOf("architecture/data/gateway/**"), true)
        buildHarnessDocumentationCoverageSpecs(listOf("dataGateway"))
    },
    bundle("dataMapper", 18, listOf("checkDataMapperEnforcement", "dataMapperEnforcementDocumentationCheck")) {
        rootTask("Run the dedicated Data Mapper enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("src"), listOf("data/**/mapper/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataMapper"))
    },
    bundle("dataPersistencecore", 18, listOf("checkDataPersistencecoreEnforcement", "dataPersistencecoreArchitectureTest", "dataPersistencecoreDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Data Persistencecore enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("src"), listOf("data/**/persistencecore/**/*.java"))
        archunit("dataPersistencecoreArchitectureTest", "Run only the Data Persistencecore-focused architecture test suite.", listOf("tools/quality/data-persistencecore-enforcement/archunit/src/test/java"), listOf("architecture/data/persistencecore/**"), listOf("architecture/data/persistencecore/**"), true)
        buildHarnessDocumentationCoverageSpecs(listOf("dataPersistencecore"))
    },
    bundle("dataQuery", 18, listOf("checkDataQueryEnforcement", "dataQueryTopologyCheck", "dataQueryEnforcementDocumentationCheck")) {
        rootTask("Run the dedicated Data Query enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataQueryGatewayCollaboratorBoundary", "DataQueryForeignPublishedReplyChannelRoundTrip", "DataQueryGatewayMutationBoundary", "DataQueryPublicSignatureBoundary", "DataQueryRoleContract"))
        verificationSources(listOf("src"), listOf("data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.query.DataQueryForeignPublishedPayloadSurfaceRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataQuery"))
    },
    bundle("dataRepository", 18, listOf("checkDataRepositoryEnforcement", "dataRepositoryEnforcementDocumentationCheck")) {
        rootTask("Run the dedicated Data Repository enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataRepositoryRoleContract", "DataRepositoryPublicSignatureBoundary", "DataRepositoryGatewayCollaboratorBoundary"))
        verificationSources(listOf("src"), listOf("data/**/repository/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataRepository"))
    },
    bundle("dataServiceContribution", 18, listOf("checkDataServiceContributionEnforcement", "dataServiceContributionDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Data ServiceContribution enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataServiceContributionConstructionPurity", "DataServiceContributionShellApiAllowlist", "DataServiceContributionRegisterExportShape"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "data/**/*ServiceContribution.java", "data/**/repository/**/*.java", "data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataServiceContribution"))
    },
    bundle("domainConstants", 18, listOf("checkDomainConstantsEnforcement", "domainConstantsTopologyCheck", "domainConstantsDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain Constants enforcement bundle through one root entrypoint.", false, true)
        errorProneCheckers(listOf("DomainConstantsRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.constants.DomainConstantsTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainConstants"))
    },
    bundle("domainRepository", 19, listOf("checkDomainRepositoryEnforcement", "domainRepositoryTopologyCheck", "domainRepositoryDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Domain Repository enforcement bundle through one root entrypoint.", false, true)
        errorProneCheckers(listOf("DomainRepositoryRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.domain.repository.DomainRepositoryTopologyRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("domainRepository"))
    }
)
