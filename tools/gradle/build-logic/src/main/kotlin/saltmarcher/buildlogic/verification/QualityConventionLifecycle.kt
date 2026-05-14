package saltmarcher.buildlogic.verification

import org.gradle.api.Project
import java.io.File
import org.gradle.api.plugins.quality.Pmd
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.withType
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.tasks.CheckNoCompiledArtifactsTask
import saltmarcher.buildlogic.tasks.hygiene.CkjmReportTask
import saltmarcher.buildlogic.tasks.hygiene.CheckNoDeadCodeTask
import saltmarcher.buildlogic.tasks.hygiene.CpdCheckTask
import saltmarcher.buildlogic.tasks.hygiene.LizardCheckTask
import saltmarcher.buildlogic.tasks.hygiene.PmdSourceCheckTask
import saltmarcher.buildlogic.tasks.hygiene.SetupLizardTask

internal fun Project.registerQualityConventionLifecycleTasks(
    environment: QualityConventionEnvironment,
    toolConfigurations: QualityConventionToolConfigurations
){
    val verificationLayout = environment.verificationLayout
    val lizardRequirementsFile = layout.projectDirectory.file("tools/quality/config/lizard/requirements.txt")
    val lizardVenvDir = layout.projectDirectory.dir(".gradle/shared-tools/lizard/venv")
    val lizardReadyMarker = layout.projectDirectory.file(".gradle/shared-tools/lizard/venv/.lizard-ready")
    val cpdReportFile = layout.buildDirectory.file("reports/cpd/main.txt")
    val ckjmBaselineFile = layout.projectDirectory.file("tools/quality/config/ckjm/baseline.tsv")
    val ckjmReportFile = layout.buildDirectory.file("reports/ckjm/main.txt")
    val ckjmSummaryFile = layout.buildDirectory.file("reports/ckjm/summary.md")
    val verificationLifecycleCatalog = standardVerificationLifecycleCatalog()

    val setupLizard = tasks.register<SetupLizardTask>("setupLizard") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Create a build-local Python environment with the pinned Lizard version."
        projectRoot.set(layout.projectDirectory)
        requirementsFile.set(lizardRequirementsFile)
        venvDirectory.set(lizardVenvDir)
        readyMarker.set(lizardReadyMarker)
        pythonCommand.set("python3")
    }

    tasks.register<LizardCheckTask>("lizardMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run Lizard complexity checks against production Java sources."
        dependsOn(setupLizard)
        projectRoot.set(layout.projectDirectory)
        venvDirectory.set(lizardVenvDir)
        requirementsMarker.set(lizardReadyMarker)
        sourceRoots.from(verificationLayout.sourceJavaRoots)
        maxCyclomaticComplexity.set(15)
        reportFile.set(layout.buildDirectory.file("reports/lizard/main.txt"))
    }

    tasks.register<CpdCheckTask>("cpdMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run PMD CPD duplicate-code checks against production Java sources."
        projectRoot.set(layout.projectDirectory)
        sourceRoots.from(verificationLayout.sourceJavaRoots)
        toolClasspath.from(toolConfigurations.cpdCli)
        minimumTokens.set(100)
        reportFile.set(cpdReportFile)
    }

    val pmdMain = tasks.named<Pmd>("pmdMain")
    val pmdStrictMain = tasks.register<PmdSourceCheckTask>("pmdStrictMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Derive the text-first PMD source-smell report from the pmdMain XML report."
        dependsOn(pmdMain)
        projectRoot.set(layout.projectDirectory)
        xmlReportFile.set(
            layout.file(pmdMain.map { pmdTask -> pmdTask.reports.xml.outputLocation.get().asFile })
        )
        reportFile.set(layout.buildDirectory.file("reports/pmd/main-strict.txt"))
    }

    pmdMain.configure {
        if (environment.includeQualityRules) {
            dependsOn(gradle.includedBuild("quality-rules").task(":jar"))
        }
        source = verificationLayout.sourceJavaRoots.asFileTree
        include("**/*.java")
        classpath = files(configurations.named("compileClasspath"))
        ignoreFailures = true
        finalizedBy(pmdStrictMain)
    }

    tasks.named<Pmd>("pmdTest") {
        enabled = false
    }

    tasks.register<CkjmReportTask>("ckjmMain") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Run CKJM ext OO metrics against compiled production classes and write reports."
        dependsOn(tasks.named("classes"))
        projectRoot.set(layout.projectDirectory)
        compiledClasses.from(verificationLayout.mainJavaClassesDir)
        toolClasspath.from(toolConfigurations.ckjmToolClasspath)
        runtimeClasspath.from(configurations.named("runtimeClasspath"))
        baselineFile.set(ckjmBaselineFile)
        reportFile.set(ckjmReportFile)
        summaryFile.set(ckjmSummaryFile)
    }

    tasks.register<CheckNoCompiledArtifactsTask>("checkNoCompiledArtifactsInSource") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Fail if compiled .class artifacts are present in bootstrap/, shell/ or src/."
        projectRoot.set(layout.projectDirectory)
        sourceRoots.from(verificationLayout.sourceJavaRoots)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkNoCompiledArtifactsInSource/success.marker"))
    }

    tasks.register<CheckNoDeadCodeTask>("checkNoDeadCode") {
        group = LifecycleBasePlugin.VERIFICATION_GROUP
        description = "Fail if production code contains unreachable files, types, methods, constructors, or fields."
        dependsOn(tasks.named("classes"))
        toolClasspath.from(toolConfigurations.proguardToolClasspath)
        compiledClassesDirectory.set(verificationLayout.mainJavaClassesDir)
        runtimeClasspath.from(configurations.named("runtimeClasspath"))
        javaHomeJmodsDirectory.set(
            layout.dir(
                providers.provider { File(System.getProperty("java.home"), "jmods") }
            )
        )
        resourceRoots.from(layout.projectDirectory.dir("resources"))
        keepRulesFiles.from(layout.projectDirectory.file("tools/quality/config/deadcode/keep-rules.pro"))
        mainClassName.set(environment.packagingMetadata.mainClassNameProvider)
        preloaderClassName.set(environment.packagingMetadata.preloaderClassNameProvider)
        workingDirectory.set(layout.buildDirectory.dir("tmp/checkNoDeadCode"))
        reportFile.set(layout.buildDirectory.file("reports/deadcode/main.txt"))
        successMarker.set(layout.buildDirectory.file("verification-markers/checkNoDeadCode/success.marker"))
    }

    tasks.named("check") {
        setDependsOn(verificationLifecycleCatalog.surface("check").dependencyTaskNames)
    }

    tasks.withType<Pmd>().configureEach {
        reports {
            html.required.set(true)
            xml.required.set(true)
        }
    }

}
