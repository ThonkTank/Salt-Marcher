package saltmarcher.buildlogic.verification

import org.gradle.api.Task
import org.gradle.api.tasks.Sync
import org.gradle.api.tasks.TaskProvider
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin

internal data class QualityConventionJqassistantTasks(
    val installJqassistant: TaskProvider<Sync>,
    val registrar: JqassistantTaskRegistrar,
    val checkViewArchitecture: TaskProvider<out Task>
)

internal fun org.gradle.api.Project.registerQualityConventionHarness(
    environment: QualityConventionEnvironment,
    jqassistantTasks: QualityConventionJqassistantTasks,
    lifecycleTasks: QualityConventionLifecycleTasks
): VerificationHarnessExtension {
    val verificationLayout = environment.verificationLayout
    val harness = VerificationHarnessExtension(
        project = this,
        enforcementBundles = environment.enforcementBundles,
        sourceSets = verificationLayout.sourceSets,
        mainSourceSet = verificationLayout.mainSourceSet,
        sourceRoots = verificationLayout.sourceRoots,
        sourceJavaRoots = verificationLayout.sourceJavaRoots,
        commonFocusedArchunitSupportIncludes = verificationLayout.commonFocusedArchunitSupportIncludes,
        jqassistantTaskRegistrar = jqassistantTasks.registrar,
        configureCommonErrorProneOptions = { applyCommonErrorProneOptions(this) },
        productionBuild = lifecycleTasks.productionBuild,
        checkQualityHygiene = lifecycleTasks.checkQualityHygiene,
        checkArchitecture = lifecycleTasks.checkArchitecture,
        checkViewArchitecture = jqassistantTasks.checkViewArchitecture,
        ckjmMain = lifecycleTasks.ckjmMain,
        check = lifecycleTasks.check
    )
    extensions.add(VerificationHarnessExtension::class.java, "saltmarcherVerificationHarness", harness)
    return harness
}

internal fun org.gradle.api.Project.registerQualityConventionJqassistantTasks(
    environment: QualityConventionEnvironment,
    toolConfigurations: QualityConventionToolConfigurations
): QualityConventionJqassistantTasks {
    val verificationLayout = environment.verificationLayout
    val jqassistantInstallDir = layout.buildDirectory.dir("tools/jqassistant")
    val installJqassistant = tasks.register<Sync>("installJqassistant") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Install the jQAssistant command-line distribution into the build directory."
        from({
            toolConfigurations.jqassistantDistribution.get().resolve().map { zipTree(it) }
        })
        into(jqassistantInstallDir)
    }
    val jqassistantCliFile = jqassistantInstallDir.map { installDir ->
        installDir.file("jqassistant-commandline-neo4jv5-${environment.jqassistantVersion}/bin/jqassistant")
    }
    val jqassistantJvmOpens = listOf(
        "--add-opens", "java.base/java.lang=ALL-UNNAMED",
        "--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED",
        "--add-opens", "java.base/java.io=ALL-UNNAMED",
        "--add-opens", "java.base/java.nio=ALL-UNNAMED"
    ).joinToString(" ")
    val registrar = JqassistantTaskRegistrar(
        project = this,
        cliFile = jqassistantCliFile,
        jvmOpens = jqassistantJvmOpens,
        installJqassistant = installJqassistant
    )
    val taskPair = registrar.registerTaskPair(
        scanTaskName = "jqassistantScanViewArchitecture",
        analyzeTaskName = "jqassistantAnalyzeViewArchitecture",
        scanDescription = "Scan SaltMarcher bytecode and source topology for view-architecture analysis.",
        analyzeDescription = "Analyze SaltMarcher passive-view topology constraints with jQAssistant.",
        ruleGroups = loadJqassistantRuleGroups(project.file("tools/quality/jqassistant/config.yml")),
        rulesDirPaths = listOf("tools/quality/jqassistant/rules"),
        mainClassesDirectory = verificationLayout.mainJavaClassesDir,
        sourceRoots = verificationLayout.sourceJavaRoots,
        storeDirectory = layout.buildDirectory.dir("tools/jqassistant/check-view-architecture-store"),
        reportsDirectory = layout.buildDirectory.dir("reports/jqassistant"),
        dependsOnTasks = listOf(tasks.named("classes"))
    )
    registrar.registerCommandTask(
        taskName = "jqassistantEffectiveRules",
        description = "Print the effective SaltMarcher passive-view topology rules.",
        commandName = "effective-rules",
        sourceConfigPath = "tools/quality/jqassistant/config.yml",
        rulesDirPaths = listOf("tools/quality/jqassistant/rules"),
        mainClassesDirectory = verificationLayout.mainJavaClassesDir,
        sourceRoots = verificationLayout.sourceJavaRoots,
        dependsOnTasks = emptyList()
    )
    registrar.registerCommandTask(
        taskName = "jqassistantServer",
        description = "Start the local jQAssistant Neo4j server for passive-view topology rule development.",
        commandName = "server",
        sourceConfigPath = "tools/quality/jqassistant/config.yml",
        rulesDirPaths = listOf("tools/quality/jqassistant/rules"),
        mainClassesDirectory = verificationLayout.mainJavaClassesDir,
        sourceRoots = verificationLayout.sourceJavaRoots,
        dependsOnTasks = listOf(tasks.named("classes"))
    )
    val checkViewArchitecture = tasks.register("checkViewArchitecture") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run the canonical SaltMarcher cockpit view-architecture topology blocker via jQAssistant."
        dependsOn(taskPair.analyzeTask)
    }
    return QualityConventionJqassistantTasks(
        installJqassistant = installJqassistant,
        registrar = registrar,
        checkViewArchitecture = checkViewArchitecture
    )
}
