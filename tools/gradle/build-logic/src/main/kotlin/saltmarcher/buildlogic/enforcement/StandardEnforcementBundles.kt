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
    private val jqassistantTasks = mutableListOf<EnforcementJqassistantTask>()
    private val pmdTasks = mutableListOf<EnforcementPmdTask>()
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

    fun jqassistantTask(
        taskName: String,
        scanTaskName: String,
        analyzeTaskName: String,
        scanDescription: String,
        analyzeDescription: String,
        ruleGroups: List<String>,
        rulesDirPaths: List<String>,
        reportsDirPath: String
    ) {
        jqassistantTasks += EnforcementJqassistantTask(
            taskName = taskName,
            scanTaskName = scanTaskName,
            analyzeTaskName = analyzeTaskName,
            scanDescription = scanDescription,
            analyzeDescription = analyzeDescription,
            ruleGroups = ruleGroups,
            rulesDirPaths = rulesDirPaths,
            reportsDirPath = reportsDirPath
        )
    }

    fun pmdTask(
        taskName: String,
        description: String,
        rulesetPath: String,
        sourceRoots: List<String>,
        sourceIncludes: List<String>,
        ignoreFailures: Boolean,
        consoleOutput: Boolean
    ) {
        pmdTasks += EnforcementPmdTask(
            taskName = taskName,
            description = description,
            rulesetPath = rulesetPath,
            sourceRoots = sourceRoots,
            sourceIncludes = sourceIncludes,
            ignoreFailures = ignoreFailures,
            consoleOutput = consoleOutput
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
        jqassistantTasks = jqassistantTasks.toList(),
        pmdTasks = pmdTasks.toList(),
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

fun standardEnforcementBundleDescriptors(): List<EnforcementBundleDescriptor> = listOf(
    bundle("viewLayer", 0, listOf("checkViewLayerEnforcement")) {
        rootTask("Run the closed-world View Layer topology bundle through one root entrypoint.", false, true)
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*.java", "domain/**/published/**/*.java"))
        buildHarnessRules("checkViewLayerEnforcement", listOf("saltmarcher.architecture.view.ViewTopologyPerimeterRules", "saltmarcher.architecture.view.ViewLayerTopologyRules"))
    },
    bundle("view", 1, listOf("checkViewEnforcement", "checkViewFxmlResources")) {
        focusedViewRoleRootTask("Run the focused passive View enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf(
            "PassiveViewDependencyBoundaries",
            "PassiveViewTypeShapeBoundary",
            "PassiveViewLocalStateBoundary",
            "PassiveViewProjectInteractionBoundary",
            "PassiveViewDataShapingBoundary",
            "PassiveViewProjectionConstructionBoundary",
            "ViewPresentationDecisionLeak",
            "ViewInputEventApi",
            "PassiveViewCallbackSeamBoundary"
        ))
        customTask("checkViewFxmlResources", "viewFxmlResources")
    },
    bundle("viewInputEvent", 2, listOf("checkViewInputEventEnforcement")) {
        focusedViewRoleRootTask("Run the focused ViewInputEvent enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf(
            "ViewInputEventBoundary",
            "ViewInputEventRawSnapshotBoundary"
        ))
    },
    bundle("viewContribution", 3, listOf("checkViewContributionEnforcement")) {
        focusedViewRoleRootTask("Run the focused View Contribution enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf(
            "ViewContributionEntrypointShape",
            "ViewContributionDependencyBoundary",
            "ViewContributionShellApiAllowlist"
        ))
    },
    bundle("viewBinder", 4, listOf("checkViewBinderEnforcement")) {
        focusedViewRoleRootTask("Run the focused View Binder enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf(
            "ViewBinderDependencyBoundary",
            "ViewBinderViewInputEventWiring",
            "ViewBinderApplicationSinkWiring",
            "ViewBinderApplicationServiceReadback",
            "ViewBinderProjectionModelRequestProtocol"
        ))
    },
    bundle("viewContributionModel", 5, listOf("checkViewContributionModelEnforcement")) {
        focusedViewRoleRootTask("Run the focused View ContributionModel enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf(
            "ViewContributionModelDependencyBoundary",
            "ViewContributionModelFlatSurface",
            "ViewContributionModelRequestProtocol"
        ))
    },
    bundle("viewContentModel", 6, listOf("checkViewContentModelEnforcement")) {
        focusedViewRoleRootTask("Run the focused View ContentModel enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf(
            "ViewContentModelDependencyBoundary",
            "ViewContentModelFlatSurface",
            "DungeonMapContentModelProjectionBoundary",
            "ViewContentModelPublishedTranslationBoundary"
        ))
    },
    bundle("viewIntentHandler", 7, listOf("checkViewIntentHandlerEnforcement")) {
        focusedViewRoleRootTask("Run the focused View IntentHandler enforcement bundle through one root entrypoint.")
        errorProneCheckers(listOf(
            "ViewIntentHandlerDependencyBoundary",
            "ViewIntentHandlerViewInputEvent"
        ))
    },
    bundle("stylingLayer", 8, listOf("checkStylingLayerEnforcement", "pmdStylingLayerEnforcement", "checkCentralizedStylesheets", "checkStylingCentralStylesheetOwner", "checkDefinedStyleClassSelectors")) {
        rootTask("Run the centralized styling-layer enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("ViewProgrammaticStyling"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
        pmdTask("pmdStylingLayerEnforcement", "Run the dedicated styling-layer PMD rule bundle.", "tools/quality/styling-layer-enforcement/pmd/ruleset.xml", listOf("bootstrap", "shell", "src"), listOf("**/*.java"), false, false)
        customTask("checkCentralizedStylesheets", "centralizedStylesheets")
        customTask("checkStylingCentralStylesheetOwner", "stylingCentralStylesheetOwner")
        customTask("checkDefinedStyleClassSelectors", "definedStyleClassSelectors")
    },
    bundle("stylingView", 9, listOf("checkStylingViewEnforcement")) {
        rootTask("Run the passive View direct-render styling enforcement bundle through one root entrypoint.", true, false)
        errorProneCheckers(listOf("ViewDirectRenderStylingPlacement"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*ContributionModel.java", "view/**/*ContentModel.java", "view/**/*PresentationModel.java", "view/**/*ViewModel.java", "view/**/*View.java", "view/**/*ViewInputEvent.java", "view/**/*InspectorEntry.java", "view/**/*PointerEvent.java", "view/**/*Scene.java", "view/**/*Signal.java", "view/**/*Support.java", "domain/**/published/**/*.java"))
    },
    bundle("shellRuntimeContext", 10, listOf("checkShellRuntimeContextEnforcement")) {
        rootTask("Run the dedicated ShellRuntimeContext PMD architecture rule bundle.", true, true)
        pmdTask("checkShellRuntimeContextEnforcement", "Run the dedicated ShellRuntimeContext PMD architecture rule bundle.", "tools/quality/shell-runtime-context-enforcement/pmd/ruleset.xml", listOf("shell/api"), listOf("ShellRuntimeContext.java"), false, false)
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
    bundle("layeringIndirection", 12, listOf("checkLayeringIndirectionEnforcement", "jqassistantScanLayeringIndirectionEnforcement", "jqassistantAnalyzeLayeringIndirectionEnforcement", "checkLayeringIndirectionRelayCandidates", "jqassistantScanLayeringIndirectionRelayCandidates", "jqassistantAnalyzeLayeringIndirectionRelayCandidates")) {
        rootTask("Run the focused Layering Indirection blocker bundle through one root entrypoint.", false, true)
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "domain/**/*.java", "data/**/*.java", "view/**/*.java"))
        jqassistantTask("checkLayeringIndirectionEnforcement", "jqassistantScanLayeringIndirectionEnforcement", "jqassistantAnalyzeLayeringIndirectionEnforcement", "Scan SaltMarcher relay-only role metadata for the focused Layering Indirection blocker surface.", "Analyze SaltMarcher substantive relay-only role constraints through the focused Layering Indirection blocker surface.", listOf("saltmarcher:layering-indirection-enforcement"), listOf("tools/quality/jqassistant/rules/layering", "tools/quality/layering-indirection-enforcement/jqassistant/rules"), "reports/jqassistant-layering-indirection-enforcement")
        jqassistantTask("checkLayeringIndirectionRelayCandidates", "jqassistantScanLayeringIndirectionRelayCandidates", "jqassistantAnalyzeLayeringIndirectionRelayCandidates", "Scan SaltMarcher relay-only role metadata for the report-only Layering Indirection relay-candidate surface.", "Analyze SaltMarcher thin relay-stack diagnostics through the report-only Layering Indirection relay-candidate surface.", listOf("saltmarcher:layering-indirection-candidates"), listOf("tools/quality/jqassistant/rules/layering", "tools/quality/layering-indirection-enforcement/jqassistant/rules"), "reports/jqassistant-layering-indirection-relay-candidates")
    },
    bundle("shellLayer", 12, listOf("checkShellLayerEnforcement", "shellLayerArchitectureTest", "shellLayerTopologyCheck")) {
        rootTask("Run the dedicated Shell Layer enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("shell"), listOf("**/*.java"))
        archunit("shellLayerArchitectureTest", "Run only the Shell Layer-focused architecture test suite.", listOf("tools/quality/shell-layer-enforcement/archunit/src/test/java"), listOf("architecture/shell/layer/**"), listOf("architecture/shell/layer/**"), true)
    },
    bundle("domainUseCase", 13, listOf("checkDomainUseCaseEnforcement", "domainUseCaseTopologyCheck", "domainUseCaseDocumentationEnforcementCheck", "pmdDomainUseCaseEnforcement")) {
        rootTask("Run the dedicated Domain UseCase enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DomainApplicationNoSameContextPublishedDependency", "DomainUseCaseRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        pmdTask("pmdDomainUseCaseEnforcement", "Run the dedicated Domain UseCase PMD enforcement bundle.", "tools/quality/domain-usecase-enforcement/pmd/ruleset.xml", emptyList(), listOf("domain/**/application/**/*.java"), false, false)
        buildHarnessDocumentationCoverageSpecs(listOf("domainUseCase"))
    },
    bundle("layeringSprawl", 13, listOf("checkLayeringSprawlCandidates", "jqassistantScanLayeringSprawlCandidates", "jqassistantAnalyzeLayeringSprawlCandidates")) {
        rootTask("Run the focused Layering Sprawl diagnostics through one report-only root entrypoint.", false, false)
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "domain/**/*.java", "data/**/*.java", "view/**/*.java"))
        jqassistantTask("checkLayeringSprawlCandidates", "jqassistantScanLayeringSprawlCandidates", "jqassistantAnalyzeLayeringSprawlCandidates", "Scan SaltMarcher layering role and production dependency metadata for the report-only Layering Sprawl candidate surface.", "Analyze SaltMarcher role-hub, cross-feature, and public-boundary sprawl candidates through the report-only Layering Sprawl surface.", listOf("saltmarcher:layering-sprawl-candidates"), listOf("tools/quality/jqassistant/rules/layering", "tools/quality/layering-sprawl-enforcement/jqassistant/rules"), "reports/jqassistant-layering-sprawl-candidates")
    },
    bundle("domainApplicationService", 14, listOf("checkDomainApplicationServiceEnforcement", "domainApplicationServiceTopologyCheck", "domainApplicationServiceDocumentationEnforcementCheck", "pmdDomainApplicationServiceEnforcement")) {
        rootTask("Run the dedicated Domain ApplicationService enforcement bundle through one root entrypoint.", false, true)
        errorProneCheckers(listOf("DomainApplicationServiceApiShape", "DomainPublicBoundarySignaturePurity", "DomainApplicationServiceRoleBoundary"))
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        pmdTask("pmdDomainApplicationServiceEnforcement", "Run the dedicated Domain ApplicationService PMD enforcement bundle.", "tools/quality/domain-application-service-enforcement/pmd/ruleset.xml", emptyList(), listOf("domain/**/*ApplicationService.java"), false, false)
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
    bundle("dataModel", 17, listOf("checkDataModelEnforcement", "dataModelArchitectureTest", "dataModelTopologyCheck", "dataModelDocumentationEnforcementCheck", "pmdDataModelEnforcement")) {
        rootTask("Run the dedicated Data Model enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataModelSourceShape"))
        verificationSources(listOf("src"), listOf("data/**/model/**/*.java"))
        archunit("dataModelArchitectureTest", "Run only the Data Model-focused architecture test suite.", listOf("tools/quality/data-model-enforcement/archunit/src/test/java"), listOf("architecture/data/model/**"), listOf("architecture/data/model/**"), true)
        pmdTask("pmdDataModelEnforcement", "Run the dedicated Data Model PMD enforcement bundle.", "tools/quality/data-model-enforcement/pmd/ruleset.xml", emptyList(), listOf("data/**/model/**/*.java"), false, false)
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
    bundle("dataMapper", 18, listOf("checkDataMapperEnforcement", "dataMapperEnforcementDocumentationCheck", "pmdDataMapperEnforcement")) {
        rootTask("Run the dedicated Data Mapper enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("src"), listOf("data/**/mapper/**/*.java"))
        pmdTask("pmdDataMapperEnforcement", "Run the dedicated Data Mapper PMD enforcement bundle.", "tools/quality/data-mapper-enforcement/pmd/ruleset.xml", emptyList(), listOf("data/**/mapper/**/*.java"), false, false)
        buildHarnessDocumentationCoverageSpecs(listOf("dataMapper"))
    },
    bundle("dataPersistencecore", 18, listOf("checkDataPersistencecoreEnforcement", "dataPersistencecoreArchitectureTest", "dataPersistencecoreDocumentationEnforcementCheck")) {
        rootTask("Run the dedicated Data Persistencecore enforcement bundle through one root entrypoint.", true, true)
        verificationSources(listOf("src"), listOf("data/**/persistencecore/**/*.java"))
        archunit("dataPersistencecoreArchitectureTest", "Run only the Data Persistencecore-focused architecture test suite.", listOf("tools/quality/data-persistencecore-enforcement/archunit/src/test/java"), listOf("architecture/data/persistencecore/**"), listOf("architecture/data/persistencecore/**"), true)
        buildHarnessDocumentationCoverageSpecs(listOf("dataPersistencecore"))
    },
    bundle("dataQuery", 18, listOf("checkDataQueryEnforcement", "dataQueryTopologyCheck", "dataQueryEnforcementDocumentationCheck", "pmdDataQueryEnforcement", "checkDataQueryPublishedCarrierCandidates")) {
        rootTask("Run the dedicated Data Query enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataQueryGatewayCollaboratorBoundary", "DataQueryForeignPublishedReplyChannelRoundTrip", "DataQueryGatewayMutationBoundary", "DataQueryPublicSignatureBoundary", "DataQueryRoleContract"))
        verificationSources(listOf("src"), listOf("data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        pmdTask("pmdDataQueryEnforcement", "Run the dedicated Data Query PMD enforcement bundle.", "tools/quality/data-query-enforcement/pmd/ruleset.xml", emptyList(), listOf("data/**/query/**/*.java"), false, false)
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.data.query.DataQueryForeignPublishedPayloadSurfaceRules"))
        buildHarnessDocumentationCoverageSpecs(listOf("dataQuery"))
        buildHarnessMain("checkDataQueryPublishedCarrierCandidates", "saltmarcher.architecture.data.query.DataQueryPublishedCarrierCandidatesCheckMain")
    },
    bundle("dataRepository", 18, listOf("checkDataRepositoryEnforcement", "dataRepositoryEnforcementDocumentationCheck", "pmdDataRepositoryEnforcement")) {
        rootTask("Run the dedicated Data Repository enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataRepositoryRoleContract", "DataRepositoryPublicSignatureBoundary", "DataRepositoryGatewayCollaboratorBoundary"))
        verificationSources(listOf("src"), listOf("data/**/repository/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        pmdTask("pmdDataRepositoryEnforcement", "Run the dedicated Data Repository PMD enforcement bundle.", "tools/quality/data-repository-enforcement/pmd/ruleset.xml", listOf("src"), listOf("data/**/repository/**/*.java"), false, false)
        buildHarnessDocumentationCoverageSpecs(listOf("dataRepository"))
    },
    bundle("dataServiceContribution", 18, listOf("checkDataServiceContributionEnforcement", "dataServiceContributionDocumentationEnforcementCheck", "pmdDataServiceContributionEnforcement")) {
        rootTask("Run the dedicated Data ServiceContribution enforcement bundle through one root entrypoint.", true, true)
        errorProneCheckers(listOf("DataServiceContributionConstructionPurity", "DataServiceContributionShellApiAllowlist", "DataServiceContributionRegisterExportShape"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "data/**/*ServiceContribution.java", "data/**/repository/**/*.java", "data/**/query/**/*.java", "data/**/gateway/**/*.java", "data/**/mapper/**/*.java", "data/**/model/**/*.java", "data/**/persistencecore/**/*.java", "domain/**/*ApplicationService.java", "domain/**/application/**/*.java", "domain/**/aggregate/**/*.java", "domain/**/context/**/*.java", "domain/**/entity/**/*.java", "domain/**/event/**/*.java", "domain/**/factory/**/*.java", "domain/**/policy/**/*.java", "domain/**/port/**/*.java", "domain/**/published/**/*.java", "domain/**/service/**/*.java", "domain/**/specification/**/*.java", "domain/**/value/**/*.java"))
        pmdTask("pmdDataServiceContributionEnforcement", "Run the dedicated Data ServiceContribution PMD enforcement bundle.", "tools/quality/data-service-contribution-enforcement/pmd/ruleset.xml", emptyList(), listOf("data/**/*ServiceContribution.java"), false, false)
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
