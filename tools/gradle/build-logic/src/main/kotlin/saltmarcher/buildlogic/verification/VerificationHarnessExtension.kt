package saltmarcher.buildlogic.verification

import java.security.MessageDigest
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.file.Directory
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
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementJqassistantTask
import saltmarcher.buildlogic.enforcement.EnforcementUtilityTaskKind
import saltmarcher.buildlogic.tasks.CheckCentralizedStylesheetsTask
import saltmarcher.buildlogic.tasks.CheckDefinedStyleClassSelectorsTask
import saltmarcher.buildlogic.tasks.CheckManualNodeStylingTask
import saltmarcher.buildlogic.tasks.CheckStylingCentralStylesheetOwnerTask
import saltmarcher.buildlogic.tasks.CheckViewFxmlResourcesTask
import saltmarcher.buildlogic.tasks.MainClassesSystemPropertyProvider

internal open class VerificationHarnessExtension(
    private val project: Project,
    private val sourceSets: SourceSetContainer,
    private val mainSourceSet: SourceSet,
    private val commonFocusedArchunitSupportSourceRoots: List<String>,
    private val commonFocusedArchunitSupportIncludes: List<String>,
    private val includeQualityRulesErrorProne: Boolean,
    private val jqassistantTaskRegistrar: JqassistantTaskRegistrar
) {
    private fun compileJavaTaskName(sourceSetName: String): String =
        "compile${sourceSetName.replaceFirstChar(Char::uppercaseChar)}Java"

    private fun classesTaskName(sourceSetName: String): String = "${sourceSetName}Classes"

    fun registerFocusedVerificationCompileTask(
        sliceKey: FocusedVerificationSliceKey,
        checkerNames: List<String>,
        taskDescription: String
    ): TaskProvider<JavaCompile> {
        val sourceSetName = "focusedVerification${sliceKey.sliceId}"
        val roots = sliceKey.verificationSourceRoots
        val includes = sliceKey.verificationSourceIncludes
        val mainClassesSupportClasspath = project.files(project.layout.buildDirectory.dir("classes/java/main"))
        sourceSets.register(sourceSetName) {
            java.setSrcDirs(roots)
            includes.forEach(java::include)
            resources.setSrcDirs(emptyList<String>())
            compileClasspath += mainClassesSupportClasspath + mainSourceSet.compileClasspath
            runtimeClasspath += output + compileClasspath
        }
        return project.tasks.named<JavaCompile>(compileJavaTaskName(sourceSetName)) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            setSource(project.files(roots).asFileTree.matching {
                FocusedVerificationPaths.configureDefaultSourceFilter(this, includes)
            }.matching {
                FocusedVerificationPaths.configureFocusedCompileSourceFilter(this, roots, includes)
            })
            classpath = mainClassesSupportClasspath + mainSourceSet.compileClasspath
            options.sourcepath = project.files()
            destinationDirectory.set(project.layout.buildDirectory.dir("classes/java/verification/${sliceKey.sliceId}"))
            if (checkerNames.isEmpty()) {
                options.errorprone.enabled.set(false)
            } else {
                require(includeQualityRulesErrorProne) {
                    "Focused Error Prone verification requires the quality-rules-errorprone included build."
                }
                dependsOn(project.gradle.includedBuild("quality-rules-errorprone").task(":jar"))
                options.errorprone.enabled.set(true)
                options.errorprone.disableWarningsInGeneratedCode.set(true)
                options.errorprone.disableAllChecks.set(true)
                options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
                FocusedVerificationPaths.errorProneExcludedPathsPattern()?.let { excludedPathsPattern ->
                    options.errorprone.excludedPaths.set(excludedPathsPattern)
                }
                checkerNames.forEach(options.errorprone::error)
            }
            inputs.property("focusedVerificationCheckerNames", checkerNames.joinToString(","))
            inputs.property("focusedVerificationPaths", FocusedVerificationPaths.propertyInput())
        }
    }

    fun registerFocusedArchunitTestTask(
        bundleId: String,
        taskName: String,
        taskDescription: String,
        mainClassFilterRoots: List<String>,
        mainClassFilterIncludes: List<String>,
        archunitSourceRoots: List<String>,
        archunitIncludes: List<String>,
        includePatterns: List<String>,
        inputPaths: List<String>
    ): TaskProvider<Test> {
        val sourceSetName = "${bundleId.replaceFirstChar(Char::lowercaseChar)}EnforcementArchunit"
        val mainClassesSupportClasspath = project.files(project.layout.buildDirectory.dir("classes/java/main"))
        requireArchunitSources(bundleId, taskName, archunitSourceRoots, archunitIncludes)
        val hasFocusedSelection = FocusedVerificationPaths.hasSelection()
        val filterMainClasses = hasFocusedSelection &&
            FocusedVerificationPaths.selectionContainsPathUnderAnyRoot(mainClassFilterRoots)
        val mainClassesDirectory = if (filterMainClasses) {
            val focusedOutputKey = FocusedVerificationPaths.focusedOutputKey() ?: "focused"
            val focusedCompileTaskName =
                "compile${bundleId.replaceFirstChar(Char::uppercaseChar)}ArchunitFocusedMainClasses"
            val focusedMainClassesDirectory =
                project.layout.buildDirectory.dir("classes/java/verification/${bundleId}-archunit-$focusedOutputKey")
            val focusedCompileTask = project.tasks.register<JavaCompile>(focusedCompileTaskName) {
                group = LifecycleBasePlugin.VERIFICATION_GROUP
                description = "Compile package-focused production classes imported by $bundleId ArchUnit enforcement."
                setSource(project.files(mainClassFilterRoots).asFileTree.matching {
                    FocusedVerificationPaths.configureDefaultSourceFilter(this, mainClassFilterIncludes)
                }.matching {
                    FocusedVerificationPaths.configureFocusedCompileSourceFilter(
                        this,
                        mainClassFilterRoots,
                        mainClassFilterIncludes
                    )
                }
                )
                classpath = mainClassesSupportClasspath + mainSourceSet.compileClasspath
                options.sourcepath = project.files()
                destinationDirectory.set(focusedMainClassesDirectory)
                options.errorprone.enabled.set(false)
                inputs.property("focusedVerificationPaths", FocusedVerificationPaths.propertyInput())
            }
            focusedCompileTask to focusedMainClassesDirectory
        } else {
            val mainCompileJava = project.tasks.named<JavaCompile>("compileJava")
            mainCompileJava to mainCompileJava.flatMap { task -> task.destinationDirectory }
        }
        val archunitSourceSet = sourceSets.register(sourceSetName) {
            java.setSrcDirs(commonFocusedArchunitSupportSourceRoots + archunitSourceRoots)
            commonFocusedArchunitSupportIncludes.forEach(java::include)
            archunitIncludes.forEach(java::include)
            resources.setSrcDirs(emptyList<String>())
            compileClasspath += project.files(project.configurations.named("testCompileClasspath"))
            runtimeClasspath += output +
                compileClasspath +
                project.files(project.configurations.named("testRuntimeClasspath"), mainClassesDirectory.second)
        }
        val archunitClassesDirs = project.files(archunitSourceSet.map(SourceSet::getOutput).map { output -> output.classesDirs })
        val archunitRuntimeClasspath = project.files(archunitSourceSet.map(SourceSet::getRuntimeClasspath))
        return project.tasks.register<Test>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = taskDescription
            dependsOn(mainClassesDirectory.first)
            dependsOn(project.tasks.named(classesTaskName(sourceSetName)))
            inputs.dir(mainClassesDirectory.second)
                .withPropertyName("mainClassesDirectory")
                .withPathSensitivity(PathSensitivity.RELATIVE)
            inputPaths.forEachIndexed { index, inputPath ->
                inputs.files(project.files(inputPath))
                    .withPropertyName("archunitInputPath$index")
                    .withPathSensitivity(PathSensitivity.RELATIVE)
            }
            testClassesDirs = archunitClassesDirs
            classpath = archunitRuntimeClasspath
            useJUnitPlatform()
            includePatterns.forEach(::include)
            jvmArgumentProviders += project.objects.newInstance(MainClassesSystemPropertyProvider::class.java).apply {
                this.mainClassesDirectory.set(mainClassesDirectory.second)
            }
        }
    }

    private fun requireArchunitSources(
        bundleId: String,
        taskName: String,
        sourceRoots: List<String>,
        sourceIncludes: List<String>
    ) {
        val matchedSources = project.files(sourceRoots).asFileTree.matching {
            FocusedVerificationPaths.configureDefaultSourceFilter(this, sourceIncludes)
        }.files
        require(matchedSources.isNotEmpty()) {
            "ArchUnit enforcement bundle '$bundleId' task '$taskName' declares no matching sources. " +
                "Roots: ${sourceRoots.joinToString(", ")}; includes: ${sourceIncludes.joinToString(", ")}."
        }
    }

    fun registerJqassistantTask(
        bundleId: String,
        taskSpec: EnforcementJqassistantTask
    ): JqassistantTaskPair {
        val compileJava = project.tasks.named<JavaCompile>("compileJava")
        val mainClassesSupportClasspath = project.files(project.layout.buildDirectory.dir("classes/java/main"))
        val selectedFocusedOutputKey = FocusedVerificationPaths.focusedOutputKey()
        val focusJqassistant = selectedFocusedOutputKey != null &&
            FocusedVerificationPaths.selectionContainsPathUnderAnyRoot(taskSpec.sourceRoots)
        var focusedCompileTask: TaskProvider<JavaCompile>? = null
        val mainClassesDirectory = if (focusJqassistant) {
            val focusedOutputKey = selectedFocusedOutputKey ?: error("Missing focused output key.")
            val filteredMainClassesDirectory =
                project.layout.buildDirectory.dir("classes/java/verification/$bundleId-jqassistant-$focusedOutputKey")
            focusedCompileTask = project.tasks.register<JavaCompile>(
                "compile${bundleId.replaceFirstChar(Char::uppercaseChar)}Jqassistant${focusedOutputKey.replace("-", "").replaceFirstChar(Char::uppercaseChar)}MainClasses"
            ) {
                group = LifecycleBasePlugin.VERIFICATION_GROUP
                description = "Compile package-focused production classes scanned by $bundleId jQAssistant enforcement."
                setSource(project.files(taskSpec.sourceRoots).asFileTree.matching {
                    FocusedVerificationPaths.configureDefaultSourceFilter(this, taskSpec.sourceIncludes)
                }.matching {
                    FocusedVerificationPaths.configureFocusedCompileSourceFilter(
                        this,
                        taskSpec.sourceRoots,
                        taskSpec.sourceIncludes
                    )
                }
                )
                classpath = mainClassesSupportClasspath + mainSourceSet.compileClasspath
                options.sourcepath = project.files()
                destinationDirectory.set(filteredMainClassesDirectory)
                options.errorprone.enabled.set(false)
                inputs.property("focusedVerificationPaths", FocusedVerificationPaths.propertyInput())
            }
            filteredMainClassesDirectory
        } else {
            compileJava.flatMap(JavaCompile::getDestinationDirectory)
        }
        val sourceRoots = project.files(taskSpec.sourceRoots).asFileTree.matching {
            FocusedVerificationPaths.configureDefaultSourceFilter(this, taskSpec.sourceIncludes)
        }.matching {
            if (focusJqassistant) {
                FocusedVerificationPaths.configureFocusedSourceFilter(this, taskSpec.sourceRoots)
            }
        }
        return jqassistantTaskRegistrar.registerTaskPair(
            bundleId = bundleId,
            taskSpec = taskSpec,
            mainClassesDirectory = mainClassesDirectory,
            sourceRoots = sourceRoots,
            outputKey = selectedFocusedOutputKey.takeIf { focusJqassistant },
            dependsOnTasks = focusedCompileTask?.let(::listOf) ?: listOf(project.tasks.named("classes"))
        )
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
                    FocusedVerificationPaths.configureDefaultSourceFilter(this, listOf("resources/**", "shell/**", "src/**"))
                }.matching {
                    FocusedVerificationPaths.configureFocusedSourceFilter(this, listOf(""))
                    exclude("**/.gradle/**")
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
                }.matching {
                    FocusedVerificationPaths.configureFocusedSourceFilter(this, listOf(""))
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
                }.matching {
                    FocusedVerificationPaths.configureFocusedSourceFilter(this, listOf(""))
                }
            )
            javaSourceFiles.from(
                project.files("bootstrap", "shell", "src").asFileTree.matching {
                    FocusedVerificationPaths.configureDefaultSourceFilter(this, listOf("**/*.java"))
                }.matching {
                    FocusedVerificationPaths.configureFocusedSourceFilter(this, listOf("bootstrap", "shell", "src"))
                }
            )
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
        EnforcementUtilityTaskKind.MANUAL_NODE_STYLING -> project.tasks.register<CheckManualNodeStylingTask>(taskName) {
            group = LifecycleBasePlugin.VERIFICATION_GROUP
            description = "Fail if active code uses inline style backchannels or passive Views use manual node layout styling."
            javaSourceFiles.from(
                project.files("bootstrap", "shell", "src").asFileTree.matching {
                    FocusedVerificationPaths.configureDefaultSourceFilter(this, listOf("**/*.java"))
                }.matching {
                    FocusedVerificationPaths.configureFocusedSourceFilter(this, listOf("bootstrap", "shell", "src"))
                }
            )
            successMarker.set(project.layout.buildDirectory.file("verification-markers/$taskName/success.marker"))
        }
    }
}

internal data class FocusedVerificationSliceKey(
    val verificationSourceRoots: List<String>,
    val verificationSourceIncludes: List<String>,
    val compileClasspathOwner: String
) {
    val sliceId: String = "Slice${stableHash(verificationSourceRoots, verificationSourceIncludes, compileClasspathOwner)}"

    companion object {
        private const val MAIN_COMPILE_CLASSPATH_OWNER = "mainCompileClasspath"

        fun from(descriptor: EnforcementBundleDescriptor): FocusedVerificationSliceKey {
            val roots = descriptor.verificationSourceRoots.normalized("verificationSourceRoots", descriptor.bundleId)
            val includes = descriptor.verificationSourceIncludes.normalized("verificationSourceIncludes", descriptor.bundleId)
            return FocusedVerificationSliceKey(
                verificationSourceRoots = roots,
                verificationSourceIncludes = includes,
                compileClasspathOwner = MAIN_COMPILE_CLASSPATH_OWNER
            )
        }

        fun from(groupId: String, descriptors: List<EnforcementBundleDescriptor>): FocusedVerificationSliceKey {
            val roots = descriptors
                .flatMap(EnforcementBundleDescriptor::verificationSourceRoots)
                .normalized("verificationSourceRoots", groupId)
            val includes = descriptors
                .flatMap(EnforcementBundleDescriptor::verificationSourceIncludes)
                .normalized("verificationSourceIncludes", groupId)
            return FocusedVerificationSliceKey(
                verificationSourceRoots = roots,
                verificationSourceIncludes = includes,
                compileClasspathOwner = MAIN_COMPILE_CLASSPATH_OWNER
            )
        }

        private fun List<String>.normalized(metadataName: String, bundleId: String): List<String> {
            val normalized = map { value ->
                value.trim()
                    .replace('\\', '/')
                    .removePrefix("./")
                    .removeSuffix("/")
            }.filter(String::isNotEmpty)
                .distinct()
                .sorted()
            return normalized.ifEmpty {
                error("Missing $metadataName metadata for enforcement bundle '$bundleId'.")
            }
        }

        private fun stableHash(
            roots: List<String>,
            includes: List<String>,
            compileClasspathOwner: String
        ): String {
            val digest = MessageDigest.getInstance("SHA-256")
            roots.forEach { digest.update("root:$it\n".toByteArray()) }
            includes.forEach { digest.update("include:$it\n".toByteArray()) }
            digest.update("classpath:$compileClasspathOwner\n".toByteArray())
            return digest.digest()
                .take(6)
                .joinToString("") { byte -> "%02x".format(byte) }
                .replaceFirstChar(Char::uppercaseChar)
        }
    }
}
