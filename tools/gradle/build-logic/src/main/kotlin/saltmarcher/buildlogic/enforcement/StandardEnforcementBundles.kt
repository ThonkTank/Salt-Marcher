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

fun standardEnforcementBundleDescriptors(): List<EnforcementBundleDescriptor> = listOf(
    bundle(
        "view",
        0,
        listOf(
            "checkViewEnforcement",
            "checkViewLayerEnforcement",
            "checkViewContributionEnforcement",
            "checkViewContributionModelEnforcement",
            "checkViewContentModelEnforcement",
            "checkViewBinderEnforcement",
            "checkViewInspectorEntryEnforcement",
            "checkViewInputEventEnforcement",
            "checkViewIntentHandlerEnforcement",
            "checkViewFxmlResources",
            "pmdViewContributionEnforcement"
        )
    ) {
        rootTask("Run the merged View enforcement surface through one root entrypoint.", true, true)
        rootTaskDependencies(listOf("checkViewLayerEnforcement"))
        errorProneCheckers(
            listOf(
                "PassiveViewDependencyBoundaries",
                "PassiveViewLocalStateBoundary",
                "PassiveViewModelReadApis",
                "PassiveViewModelMutationBoundary",
                "PassiveViewProjectionConstructionBoundary",
                "ViewPresentationDecisionLeak",
                "ViewInputEventApi",
                "PassiveViewCallbackSeamBoundary",
                "ViewContributionDependencyBoundary",
                "ViewContributionShellApiAllowlist",
                "ViewBinderDependencyBoundary",
                "ViewBinderViewInputEventWiring",
                "ViewBinderApplicationSinkWiring",
                "ViewBinderApplicationServiceReadback",
                "ViewBinderProjectionModelRequestProtocol",
                "ViewContributionModelDependencyBoundary",
                "ViewContributionModelFlatSurface",
                "ViewContributionModelRequestProtocol",
                "ViewContentModelDependencyBoundary",
                "ViewContentModelFlatSurface",
                "DungeonMapContentModelProjectionBoundary",
                "ViewContentModelPublishedTranslationBoundary",
                "ViewInputEventBoundary",
                "ViewInputEventRawSnapshotBoundary",
                "ViewIntentHandlerDependencyBoundary",
                "ViewIntentHandlerViewInputEvent"
            )
        )
        verificationSources(listOf("bootstrap", "shell", "src"), listOf("api/**/*.java", "view/**/*.java", "domain/**/*.java"))
        pmdTask(
            "pmdViewContributionEnforcement",
            "Run the contribution entrypoint shape checks through the merged View enforcement surface.",
            "tools/quality/view-contribution-enforcement/pmd/ruleset.xml",
            listOf("bootstrap", "shell", "src"),
            listOf("**/*.java"),
            false,
            false
        )
        customTask("checkViewFxmlResources", "viewFxmlResources")
        buildHarnessArchitectureRules(
            listOf(
                "saltmarcher.architecture.view.ViewTopologyPerimeterRules",
                "saltmarcher.architecture.view.layer.ViewLayerTopologyRules"
            )
        )
        buildHarnessRules(
            "checkViewLayerEnforcement",
            listOf(
                "saltmarcher.architecture.view.ViewTopologyPerimeterRules",
                "saltmarcher.architecture.view.layer.ViewLayerTopologyRules"
            )
        )
    },
    bundle(
        "styling",
        1,
        listOf(
            "checkStylingEnforcement",
            "checkStylingLayerEnforcement",
            "checkStylingViewEnforcement",
            "pmdStylingLayerEnforcement",
            "checkCentralizedStylesheets",
            "checkStylingCentralStylesheetOwner",
            "checkDefinedStyleClassSelectors"
        )
    ) {
        rootTask("Run the merged styling enforcement surface through one root entrypoint.", true, true)
        errorProneCheckers(listOf("ViewProgrammaticStyling", "ViewDirectRenderStylingPlacement"))
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "view/**/*.java", "domain/**/published/**/*.java"))
        pmdTask(
            "pmdStylingLayerEnforcement",
            "Run the styling-layer PMD rule bundle.",
            "tools/quality/styling-layer-enforcement/pmd/ruleset.xml",
            listOf("bootstrap", "shell", "src"),
            listOf("**/*.java"),
            false,
            false
        )
        customTask("checkCentralizedStylesheets", "centralizedStylesheets")
        customTask("checkStylingCentralStylesheetOwner", "stylingCentralStylesheetOwner")
        customTask("checkDefinedStyleClassSelectors", "definedStyleClassSelectors")
    },
    bundle(
        "shell",
        2,
        listOf(
            "checkShellEnforcement",
            "checkShellLayerEnforcement",
            "checkShellRuntimeContextEnforcement",
            "checkShellAppShellEnforcement",
            "shellLayerArchitectureTest",
            "shellLayerTopologyCheck"
        )
    ) {
        rootTask("Run the merged Shell enforcement surface through one root entrypoint.", true, true)
        rootTaskDependencies(listOf("checkShellRuntimeContextEnforcement"))
        errorProneCheckers(listOf("ShellLifecycleHookOwnership"))
        verificationSources(listOf("shell"), listOf("**/*.java"))
        archunit(
            "shellLayerArchitectureTest",
            "Run the merged Shell architecture suite.",
            listOf("tools/quality/shell-layer-enforcement/archunit/src/test/java"),
            listOf("architecture/shell/layer/**"),
            listOf("architecture/shell/layer/**"),
            true
        )
        pmdTask(
            "checkShellRuntimeContextEnforcement",
            "Run the ShellRuntimeContext PMD architecture rule bundle.",
            "tools/quality/shell-runtime-context-enforcement/pmd/ruleset.xml",
            listOf("shell/api"),
            listOf("ShellRuntimeContext.java"),
            false,
            false
        )
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.shell.layer.ShellLayerTopologyRules"))
        buildHarnessRules("shellLayerTopologyCheck", listOf("saltmarcher.architecture.shell.layer.ShellLayerTopologyRules"))
    },
    bundle(
        "bootstrap",
        3,
        listOf(
            "checkBootstrapEnforcement",
            "checkBootstrapLayerEnforcement",
            "checkBootstrapAppBootstrapEnforcement",
            "bootstrapLayerArchitectureTest",
            "bootstrapLayerTopologyCheck"
        )
    ) {
        rootTask("Run the merged Bootstrap enforcement surface through one root entrypoint.", true, true)
        verificationSources(listOf("bootstrap", "shell"), listOf("**/*.java"))
        archunit(
            "bootstrapLayerArchitectureTest",
            "Run the merged Bootstrap architecture suite.",
            listOf("tools/quality/bootstrap-layer-enforcement/archunit/src/test/java"),
            listOf("architecture/bootstrap/layer/**"),
            listOf("architecture/bootstrap/layer/**"),
            true
        )
        buildHarnessArchitectureRules(listOf("saltmarcher.architecture.bootstrap.layer.BootstrapLayerTopologyRules"))
        buildHarnessRules("bootstrapLayerTopologyCheck", listOf("saltmarcher.architecture.bootstrap.layer.BootstrapLayerTopologyRules"))
    },
    bundle(
        "layering",
        4,
        listOf(
            "checkLayeringEnforcement",
            "checkLayeringArchitectureEnforcement",
            "checkLayeringIndirectionEnforcement",
            "jqassistantScanLayeringIndirectionEnforcement",
            "jqassistantAnalyzeLayeringIndirectionEnforcement",
            "layeringArchitectureTopologyCheck",
            "layeringArchitectureDocumentationEnforcementCheck"
        )
    ) {
        rootTask("Run the merged layering enforcement surface through one root entrypoint.", true, true)
        rootTaskDependencies(listOf("checkLayeringIndirectionEnforcement"))
        verificationSources(listOf("bootstrap", "shell", "src"), listOf("api/**/*.java", "view/**/*.java", "domain/**/*.java", "data/**/*.java"))
        jqassistantTask(
            "checkLayeringIndirectionEnforcement",
            "jqassistantScanLayeringIndirectionEnforcement",
            "jqassistantAnalyzeLayeringIndirectionEnforcement",
            "Scan SaltMarcher relay-only role metadata for the blocker layering-indirection surface.",
            "Analyze SaltMarcher substantive relay-only role constraints through the blocker layering-indirection surface.",
            listOf("saltmarcher:layering-indirection-enforcement"),
            listOf("tools/quality/jqassistant/rules/layering", "tools/quality/layering-indirection-enforcement/jqassistant/rules"),
            "reports/jqassistant-layering-indirection-enforcement"
        )
        buildHarnessArchitectureRules(
            listOf(
                "saltmarcher.architecture.layering.LayeringArchitectureTopologyRules",
                "saltmarcher.architecture.layering.LayeringPassiveCarrierMirrorRules"
            )
        )
        buildHarnessDocumentationRules(listOf("saltmarcher.architecture.documentation.layering.LayeringArchitectureEnforcementCoverageRules"))
        buildHarnessRules(
            "layeringArchitectureTopologyCheck",
            listOf(
                "saltmarcher.architecture.layering.LayeringArchitectureTopologyRules",
                "saltmarcher.architecture.layering.LayeringPassiveCarrierMirrorRules"
            )
        )
        buildHarnessRules(
            "layeringArchitectureDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.documentation.layering.LayeringArchitectureEnforcementCoverageRules")
        )
    },
    bundle(
        "domain",
        5,
        listOf(
            "checkDomainEnforcement",
            "checkDomainLayerEnforcement",
            "checkDomainContextEnforcement",
            "checkDomainApplicationServiceEnforcement",
            "checkDomainUseCaseEnforcement",
            "checkDomainPublishedEnforcement",
            "checkDomainPortEnforcement",
            "checkDomainRepositoryEnforcement",
            "checkDomainModelEnforcement",
            "checkDomainHelperEnforcement",
            "checkDomainConstantsEnforcement",
            "domainLayerArchitectureTest",
            "domainLayerTopologyCheck",
            "domainLayerDocumentationEnforcementCheck",
            "domainContextEnforcementDocumentationCheck",
            "domainApplicationServiceTopologyCheck",
            "domainApplicationServiceDocumentationEnforcementCheck",
            "pmdDomainApplicationServiceEnforcement",
            "domainUseCaseTopologyCheck",
            "domainUseCaseDocumentationEnforcementCheck",
            "pmdDomainUseCaseEnforcement",
            "domainPublishedTopologyCheck",
            "domainPublishedDocumentationEnforcementCheck",
            "domainPortTopologyCheck",
            "domainPortEnforcementDocumentationCheck",
            "domainRepositoryTopologyCheck",
            "domainRepositoryDocumentationEnforcementCheck",
            "domainModelTopologyCheck",
            "domainModelDocumentationEnforcementCheck",
            "domainHelperTopologyCheck",
            "domainHelperDocumentationEnforcementCheck",
            "domainConstantsTopologyCheck",
            "domainConstantsDocumentationEnforcementCheck"
        )
    ) {
        rootTask("Run the merged Domain enforcement surface through one root entrypoint.", true, true)
        errorProneCheckers(
            listOf(
                "DomainForbiddenInfrastructureDependency",
                "DomainModuleNoPublishedCarrierDependency",
                "DomainSourceTopologyPerimeter",
                "DomainApplicationServiceApiShape",
                "DomainPublicBoundarySignaturePurity",
                "DomainApplicationNoSameContextPublishedDependency",
                "DomainPublishedCarrierShape",
                "DomainPublishedBoundarySignaturePurity",
                "DomainPublishedReadModelShape"
            )
        )
        verificationSources(listOf("src"), listOf("domain/**/*.java"))
        archunit(
            "domainLayerArchitectureTest",
            "Run the merged Domain architecture suite.",
            listOf("tools/quality/domain-layer-enforcement/archunit/src/test/java"),
            listOf("architecture/domain/layer/**"),
            listOf("architecture/domain/layer/**"),
            true
        )
        pmdTask(
            "pmdDomainApplicationServiceEnforcement",
            "Run the ApplicationService PMD bundle through the merged Domain surface.",
            "tools/quality/domain-application-service-enforcement/pmd/ruleset.xml",
            emptyList(),
            listOf("domain/**/*ApplicationService.java"),
            false,
            false
        )
        pmdTask(
            "pmdDomainUseCaseEnforcement",
            "Run the UseCase PMD bundle through the merged Domain surface.",
            "tools/quality/domain-usecase-enforcement/pmd/ruleset.xml",
            emptyList(),
            listOf("domain/**/application/**/*.java"),
            false,
            false
        )
        buildHarnessArchitectureRules(
            listOf(
                "saltmarcher.architecture.domain.layer.DomainLayerTopologyRules",
                "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceTopologyRules",
                "saltmarcher.architecture.domain.usecase.DomainUseCaseTopologyRules",
                "saltmarcher.architecture.domain.published.DomainPublishedTopologyRules",
                "saltmarcher.architecture.domain.port.DomainPortTopologyRules",
                "saltmarcher.architecture.domain.repository.DomainRepositoryTopologyRules",
                "saltmarcher.architecture.domain.model.DomainModelTopologyRules",
                "saltmarcher.architecture.domain.helper.DomainHelperTopologyRules",
                "saltmarcher.architecture.domain.constants.DomainConstantsTopologyRules"
            )
        )
        buildHarnessDocumentationRules(
            listOf(
                "saltmarcher.architecture.domain.layer.DomainLayerEnforcementCoverageRules",
                "saltmarcher.architecture.documentation.domaincontext.DomainContextDocumentationRules",
                "saltmarcher.architecture.documentation.domaincontext.DomainContextEnforcementCoverageRules",
                "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceDocumentationRules",
                "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceEnforcementCoverageRules",
                "saltmarcher.architecture.domain.usecase.DomainUseCaseEnforcementCoverageRules",
                "saltmarcher.architecture.domain.published.DomainPublishedEnforcementCoverageRules",
                "saltmarcher.architecture.documentation.domainport.DomainPortEnforcementDocumentationRules",
                "saltmarcher.architecture.domain.repository.DomainRepositoryEnforcementCoverageRules",
                "saltmarcher.architecture.domain.model.DomainModelEnforcementCoverageRules",
                "saltmarcher.architecture.domain.helper.DomainHelperEnforcementCoverageRules",
                "saltmarcher.architecture.domain.constants.DomainConstantsEnforcementCoverageRules"
            )
        )
        buildHarnessRules("domainLayerTopologyCheck", listOf("saltmarcher.architecture.domain.layer.DomainLayerTopologyRules"))
        buildHarnessRules(
            "domainLayerDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.domain.layer.DomainLayerEnforcementCoverageRules")
        )
        buildHarnessRules(
            "domainContextEnforcementDocumentationCheck",
            listOf(
                "saltmarcher.architecture.documentation.domaincontext.DomainContextDocumentationRules",
                "saltmarcher.architecture.documentation.domaincontext.DomainContextEnforcementCoverageRules"
            )
        )
        buildHarnessRules(
            "domainApplicationServiceTopologyCheck",
            listOf("saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceTopologyRules")
        )
        buildHarnessRules(
            "domainApplicationServiceDocumentationEnforcementCheck",
            listOf(
                "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceDocumentationRules",
                "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceEnforcementCoverageRules"
            )
        )
        buildHarnessRules("domainUseCaseTopologyCheck", listOf("saltmarcher.architecture.domain.usecase.DomainUseCaseTopologyRules"))
        buildHarnessRules(
            "domainUseCaseDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.domain.usecase.DomainUseCaseEnforcementCoverageRules")
        )
        buildHarnessRules("domainPublishedTopologyCheck", listOf("saltmarcher.architecture.domain.published.DomainPublishedTopologyRules"))
        buildHarnessRules(
            "domainPublishedDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.domain.published.DomainPublishedEnforcementCoverageRules")
        )
        buildHarnessRules("domainPortTopologyCheck", listOf("saltmarcher.architecture.domain.port.DomainPortTopologyRules"))
        buildHarnessRules(
            "domainPortEnforcementDocumentationCheck",
            listOf("saltmarcher.architecture.documentation.domainport.DomainPortEnforcementDocumentationRules")
        )
        buildHarnessRules("domainRepositoryTopologyCheck", listOf("saltmarcher.architecture.domain.repository.DomainRepositoryTopologyRules"))
        buildHarnessRules(
            "domainRepositoryDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.domain.repository.DomainRepositoryEnforcementCoverageRules")
        )
        buildHarnessRules("domainModelTopologyCheck", listOf("saltmarcher.architecture.domain.model.DomainModelTopologyRules"))
        buildHarnessRules(
            "domainModelDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.domain.model.DomainModelEnforcementCoverageRules")
        )
        buildHarnessRules("domainHelperTopologyCheck", listOf("saltmarcher.architecture.domain.helper.DomainHelperTopologyRules"))
        buildHarnessRules(
            "domainHelperDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.domain.helper.DomainHelperEnforcementCoverageRules")
        )
        buildHarnessRules("domainConstantsTopologyCheck", listOf("saltmarcher.architecture.domain.constants.DomainConstantsTopologyRules"))
        buildHarnessRules(
            "domainConstantsDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.domain.constants.DomainConstantsEnforcementCoverageRules")
        )
    },
    bundle(
        "data",
        6,
        listOf(
            "checkDataEnforcement",
            "checkDataLayerEnforcement",
            "checkDataModelEnforcement",
            "checkDataGatewayEnforcement",
            "checkDataMapperEnforcement",
            "checkDataPersistencecoreEnforcement",
            "checkDataQueryEnforcement",
            "checkDataRepositoryEnforcement",
            "checkDataServiceContributionEnforcement",
            "dataLayerArchitectureTest",
            "dataLayerTopologyCheck",
            "dataLayerDocumentationEnforcementCheck",
            "dataModelTopologyCheck",
            "dataModelDocumentationEnforcementCheck",
            "pmdDataModelEnforcement",
            "dataGatewayEnforcementDocumentationCheck",
            "dataMapperEnforcementDocumentationCheck",
            "pmdDataMapperEnforcement",
            "dataPersistencecoreDocumentationEnforcementCheck",
            "dataQueryTopologyCheck",
            "dataQueryEnforcementDocumentationCheck",
            "pmdDataQueryEnforcement",
            "dataRepositoryEnforcementDocumentationCheck",
            "pmdDataRepositoryEnforcement",
            "dataServiceContributionDocumentationEnforcementCheck",
            "pmdDataServiceContributionEnforcement"
        )
    ) {
        rootTask("Run the merged Data enforcement surface through one root entrypoint.", true, true)
        errorProneCheckers(
            listOf(
                "ServiceRegistryRegistrationPlacement",
                "DataModelSourceShape",
                "DataGatewayReturnTypeBoundary",
                "DataQueryGatewayCollaboratorBoundary",
                "DataQueryForeignPublishedReplyChannelRoundTrip",
                "DataQueryGatewayMutationBoundary",
                "DataQueryPublicSignatureBoundary",
                "DataQueryRoleContract",
                "DataRepositoryRoleContract",
                "DataRepositoryPublicSignatureBoundary",
                "DataRepositoryGatewayCollaboratorBoundary",
                "DataServiceContributionConstructionPurity",
                "DataServiceContributionShellApiAllowlist",
                "DataServiceContributionRegisterExportShape"
            )
        )
        verificationSources(listOf("shell", "src"), listOf("api/**/*.java", "data/**/*.java", "domain/**/*.java"))
        archunit(
            "dataLayerArchitectureTest",
            "Run the merged Data architecture suite.",
            listOf("tools/quality/data-layer-enforcement/archunit/src/test/java"),
            listOf("architecture/data/layer/**"),
            listOf("architecture/data/layer/**"),
            true
        )
        pmdTask(
            "pmdDataModelEnforcement",
            "Run the Data Model PMD bundle through the merged Data surface.",
            "tools/quality/data-model-enforcement/pmd/ruleset.xml",
            emptyList(),
            listOf("data/**/model/**/*.java"),
            false,
            false
        )
        pmdTask(
            "pmdDataMapperEnforcement",
            "Run the Data Mapper PMD bundle through the merged Data surface.",
            "tools/quality/data-mapper-enforcement/pmd/ruleset.xml",
            emptyList(),
            listOf("data/**/mapper/**/*.java"),
            false,
            false
        )
        pmdTask(
            "pmdDataQueryEnforcement",
            "Run the Data Query PMD bundle through the merged Data surface.",
            "tools/quality/data-query-enforcement/pmd/ruleset.xml",
            emptyList(),
            listOf("data/**/query/**/*.java"),
            false,
            false
        )
        pmdTask(
            "pmdDataRepositoryEnforcement",
            "Run the Data Repository PMD bundle through the merged Data surface.",
            "tools/quality/data-repository-enforcement/pmd/ruleset.xml",
            listOf("src"),
            listOf("data/**/repository/**/*.java"),
            false,
            false
        )
        pmdTask(
            "pmdDataServiceContributionEnforcement",
            "Run the Data ServiceContribution PMD bundle through the merged Data surface.",
            "tools/quality/data-service-contribution-enforcement/pmd/ruleset.xml",
            emptyList(),
            listOf("data/**/*ServiceContribution.java"),
            false,
            false
        )
        buildHarnessArchitectureRules(
            listOf(
                "saltmarcher.architecture.data.layer.DataLayerTopologyRules",
                "saltmarcher.architecture.data.model.DataModelTopologyRules",
                "saltmarcher.architecture.data.query.DataQueryForeignPublishedPayloadSurfaceRules"
            )
        )
        buildHarnessDocumentationRules(
            listOf(
                "saltmarcher.architecture.data.layer.DataLayerEnforcementCoverageRules",
                "saltmarcher.architecture.data.model.DataModelEnforcementCoverageRules",
                "saltmarcher.architecture.documentation.datagateway.DataGatewayEnforcementDocumentationRules",
                "saltmarcher.architecture.documentation.datamapper.DataMapperEnforcementDocumentationRules",
                "saltmarcher.architecture.data.persistencecore.DataPersistencecoreEnforcementCoverageRules",
                "saltmarcher.architecture.documentation.dataquery.DataQueryEnforcementDocumentationRules",
                "saltmarcher.architecture.documentation.datarepository.DataRepositoryEnforcementDocumentationRules",
                "saltmarcher.architecture.documentation.dataservicecontribution.DataServiceContributionEnforcementCoverageRules"
            )
        )
        buildHarnessRules("dataLayerTopologyCheck", listOf("saltmarcher.architecture.data.layer.DataLayerTopologyRules"))
        buildHarnessRules(
            "dataLayerDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.data.layer.DataLayerEnforcementCoverageRules")
        )
        buildHarnessRules("dataModelTopologyCheck", listOf("saltmarcher.architecture.data.model.DataModelTopologyRules"))
        buildHarnessRules(
            "dataModelDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.data.model.DataModelEnforcementCoverageRules")
        )
        buildHarnessRules(
            "dataGatewayEnforcementDocumentationCheck",
            listOf("saltmarcher.architecture.documentation.datagateway.DataGatewayEnforcementDocumentationRules")
        )
        buildHarnessRules(
            "dataMapperEnforcementDocumentationCheck",
            listOf("saltmarcher.architecture.documentation.datamapper.DataMapperEnforcementDocumentationRules")
        )
        buildHarnessRules(
            "dataPersistencecoreDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.data.persistencecore.DataPersistencecoreEnforcementCoverageRules")
        )
        buildHarnessRules(
            "dataQueryTopologyCheck",
            listOf("saltmarcher.architecture.data.query.DataQueryForeignPublishedPayloadSurfaceRules")
        )
        buildHarnessRules(
            "dataQueryEnforcementDocumentationCheck",
            listOf("saltmarcher.architecture.documentation.dataquery.DataQueryEnforcementDocumentationRules")
        )
        buildHarnessRules(
            "dataRepositoryEnforcementDocumentationCheck",
            listOf("saltmarcher.architecture.documentation.datarepository.DataRepositoryEnforcementDocumentationRules")
        )
        buildHarnessRules(
            "dataServiceContributionDocumentationEnforcementCheck",
            listOf("saltmarcher.architecture.documentation.dataservicecontribution.DataServiceContributionEnforcementCoverageRules")
        )
    }
)
