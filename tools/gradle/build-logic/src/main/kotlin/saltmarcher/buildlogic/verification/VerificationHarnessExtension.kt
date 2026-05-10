package saltmarcher.buildlogic.verification

import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.Directory
import org.gradle.api.file.FileCollection
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.SourceSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.language.base.plugins.LifecycleBasePlugin
import saltmarcher.buildlogic.enforcement.EnforcementUtilityTaskKind
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.CheckCentralizedStylesheetsTask
import saltmarcher.buildlogic.tasks.CheckDefinedStyleClassSelectorsTask
import saltmarcher.buildlogic.tasks.CheckStylingCentralStylesheetOwnerTask
import saltmarcher.buildlogic.tasks.CheckViewFxmlResourcesTask
import saltmarcher.buildlogic.tasks.MainClassesSystemPropertyProvider

internal open class VerificationHarnessExtension(
    private val project: Project,
    private val enforcementBundles: EnforcementBundlesExtension,
    private val sourceSets: SourceSetContainer,
    private val mainSourceSet: SourceSet,
    private val sourceRoots: FileCollection,
    private val sourceJavaRoots: FileCollection,
    private val commonFocusedArchunitSupportIncludes: List<String>,
    private val configureCommonErrorProneOptions: JavaCompile.() -> Unit
) {
    private fun compileJavaTaskName(sourceSetName: String): String =
        "compile${sourceSetName.replaceFirstChar(Char::uppercaseChar)}Java"

    private fun classesTaskName(sourceSetName: String): String = "${sourceSetName}Classes"

    fun registerFocusedVerificationCompileTask(
        bundleId: String,
        checkerNames: List<String>,
        taskDescription: String
    ): TaskProvider<JavaCompile> {
        val descriptor = enforcementBundles.descriptor(bundleId)
        val roots = descriptor.verificationSourceRoots.ifEmpty {
            error("Missing verificationSourceRoots metadata for enforcement bundle '$bundleId'.")
        }
        val includes = descriptor.verificationSourceIncludes.ifEmpty {
            error("Missing verificationSourceIncludes metadata for enforcement bundle '$bundleId'.")
        }
        val sourceSetName = "${bundleId.replaceFirstChar(Char::lowercaseChar)}Verification"
        sourceSets.register(sourceSetName) {
            java.setSrcDirs(roots)
            includes.forEach(java::include)
            resources.setSrcDirs(emptyList<String>())
            compileClasspath += mainSourceSet.compileClasspath
            runtimeClasspath += output + compileClasspath
        }
        return project.tasks.named<JavaCompile>(compileJavaTaskName(sourceSetName)) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            options.sourcepath = sourceJavaRoots
            destinationDirectory.set(project.layout.buildDirectory.dir("classes/java/verification/$bundleId"))
            if (checkerNames.isEmpty()) {
                options.errorprone.enabled.set(false)
            } else {
                apply(configureCommonErrorProneOptions)
                checkerNames.forEach(options.errorprone::error)
            }
        }
    }

    fun registerFocusedArchunitTestTask(
        bundleId: String,
        taskName: String,
        taskDescription: String,
        selectedCompileJava: TaskProvider<JavaCompile>,
        archunitIncludes: List<String>,
        includePatterns: List<String>
    ): TaskProvider<Test> {
        val sourceSetName = "${bundleId.replaceFirstChar(Char::lowercaseChar)}EnforcementArchunit"
        val mainClassesDirectory = selectedCompileJava.flatMap { task -> task.destinationDirectory }
        val archunitSourceSet = sourceSets.register(sourceSetName) {
            java.setSrcDirs(listOf("src/test/java"))
            commonFocusedArchunitSupportIncludes.forEach(java::include)
            archunitIncludes.forEach(java::include)
            resources.setSrcDirs(emptyList<String>())
            compileClasspath += project.files(project.configurations.named("testCompileClasspath"))
            runtimeClasspath += output +
                compileClasspath +
                project.files(project.configurations.named("testRuntimeClasspath"), mainClassesDirectory)
        }
        val archunitClassesDirs = project.files(archunitSourceSet.map(SourceSet::getOutput).map { output -> output.classesDirs })
        val archunitRuntimeClasspath = project.files(archunitSourceSet.map(SourceSet::getRuntimeClasspath))
        return project.tasks.register<Test>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            dependsOn(selectedCompileJava)
            dependsOn(project.tasks.named(classesTaskName(sourceSetName)))
            inputs.dir(mainClassesDirectory)
                .withPropertyName("mainClassesDirectory")
                .withPathSensitivity(PathSensitivity.RELATIVE)
            testClassesDirs = archunitClassesDirs
            classpath = archunitRuntimeClasspath
            useJUnitPlatform()
            includePatterns.forEach(::include)
            jvmArgumentProviders += project.objects.newInstance(MainClassesSystemPropertyProvider::class.java).apply {
                this.mainClassesDirectory.set(mainClassesDirectory)
            }
        }
    }

    fun registerUtilityVerificationTask(
        taskName: String,
        kind: EnforcementUtilityTaskKind
    ): TaskProvider<out Task> = when (kind) {
        EnforcementUtilityTaskKind.VIEW_FXML_RESOURCES -> project.tasks.register<CheckViewFxmlResourcesTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Validate declarative passive-view FXML resource placement and controller ownership."
            projectRoot.set(project.layout.projectDirectory)
            verificationInputs.from(
                project.layout.projectDirectory.asFileTree.matching {
                    include("resources/**")
                    include("shell/**")
                    include("src/**")
                    exclude("**/.gradle/**")
                    exclude("**/build/**")
                    exclude("**/.git/**")
                }
            )
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.CENTRALIZED_STYLESHEETS -> project.tasks.register<CheckCentralizedStylesheetsTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if stylesheet files exist outside the central resources/salt-marcher.css file."
            stylesheetFiles.from(
                project.layout.projectDirectory.asFileTree.matching {
                    include("**/*.css", "**/*.scss", "**/*.sass", "**/*.less", "**/*.styl")
                    exclude("**/.git/**", "**/.gradle/**", "**/build/**")
                }
            )
            canonicalStylesheetRelativePath.set("resources/salt-marcher.css")
            canonicalStylesheetFile.set(project.layout.projectDirectory.file("resources/salt-marcher.css"))
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.STYLING_CENTRAL_STYLESHEET_OWNER -> project.tasks.register<CheckStylingCentralStylesheetOwnerTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if SaltMarcher styling stops using the canonical resources/salt-marcher.css owner."
            configuredStylesheetPath.set(project.providers.gradleProperty("saltMarcherStylesheet").orElse("resources/salt-marcher.css"))
            canonicalStylesheetRelativePath.set("resources/salt-marcher.css")
            canonicalStylesheetFile.set(project.layout.projectDirectory.file("resources/salt-marcher.css"))
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.DEFINED_STYLE_CLASS_SELECTORS -> project.tasks.register<CheckDefinedStyleClassSelectorsTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if Java-authored style classes are missing from resources/salt-marcher.css selectors."
            stylesheetFiles.from(
                project.layout.projectDirectory.asFileTree.matching {
                    include("**/*.css", "**/*.scss", "**/*.sass", "**/*.less", "**/*.styl")
                    exclude("**/.git/**", "**/.gradle/**", "**/build/**")
                }
            )
            javaSourceFiles.from(
                project.files("bootstrap", "shell", "src").asFileTree.matching {
                    include("**/*.java")
                    exclude("**/build/**")
                }
            )
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
    }
}
