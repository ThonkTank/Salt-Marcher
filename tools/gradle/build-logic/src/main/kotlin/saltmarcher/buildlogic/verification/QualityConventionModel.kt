package saltmarcher.buildlogic.verification

import java.io.File
import net.ltgt.gradle.errorprone.errorprone
import org.gradle.api.NamedDomainObjectProvider
import org.gradle.api.Project
import org.gradle.api.artifacts.Configuration
import org.gradle.api.file.Directory
import org.gradle.api.file.FileCollection
import org.gradle.api.provider.Provider
import org.gradle.api.tasks.SourceSet
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.get
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.resolveDesktopDirectory

private const val DefaultJqassistantVersion = "2.9.1"

internal data class QualityConventionVerificationLayout(
    val sourceSets: SourceSetContainer,
    val mainSourceSet: SourceSet,
    val sourceRoots: FileCollection,
    val sourceJavaRoots: FileCollection,
    val mainJavaClassesDir: Provider<Directory>,
    val commonFocusedArchunitSupportIncludes: List<String>
)

internal data class QualityConventionPackagingMetadata(
    val appDisplayNameProvider: Provider<String>,
    val desktopIconSourceRelativePathProvider: Provider<String>,
    val desktopEntryIconRelativePathProvider: Provider<String>,
    val windowIconRelativePathProvider: Provider<String>,
    val launcherNameProvider: Provider<String>,
    val mainClassNameProvider: Provider<String>,
    val packageVersionProvider: Provider<String>,
    val preloaderClassNameProvider: Provider<String>,
    val startupWmClassProvider: Provider<String>,
    val stylesheetRelativePathProvider: Provider<String>,
    val installedAppDirectory: Provider<Directory>,
    val desktopDirectory: Provider<Directory>,
    val applicationsDirectory: Provider<Directory>
)

internal data class QualityConventionEnvironment(
    val enforcementBundles: EnforcementBundlesExtension,
    val focusedEnforcementBundleMode: Boolean,
    val verificationLayout: QualityConventionVerificationLayout,
    val packagingMetadata: QualityConventionPackagingMetadata,
    val jqassistantVersion: String
)

internal data class QualityConventionToolConfigurations(
    val cpdCli: NamedDomainObjectProvider<Configuration>,
    val pmdCli: NamedDomainObjectProvider<Configuration>,
    val ckjmToolClasspath: NamedDomainObjectProvider<Configuration>,
    val proguardToolClasspath: NamedDomainObjectProvider<Configuration>,
    val jqassistantDistribution: NamedDomainObjectProvider<Configuration>
)

internal fun Project.createQualityConventionEnvironment(
    enforcementBundles: EnforcementBundlesExtension
): QualityConventionEnvironment {
    val appDisplayNameProvider = providers.gradleProperty("saltMarcherDisplayName").orElse("SaltMarcher")
    val desktopIconSourceRelativePathProvider = providers.gradleProperty("saltMarcherDesktopIconSource")
        .orElse("icons/salt-marcher.svg")
    val desktopEntryIconRelativePathProvider = providers.gradleProperty("saltMarcherDesktopEntryIcon")
        .orElse(desktopIconSourceRelativePathProvider)
    val windowIconRelativePathProvider = providers.gradleProperty("saltMarcherWindowIcon")
        .orElse("icons/salt-marcher.png")
    val launcherNameProvider = providers.gradleProperty("saltMarcherLauncherName").orElse("saltmarcher")
    val mainClassNameProvider = providers.gradleProperty("saltMarcherMainClass").orElse("bootstrap.SaltMarcherApp")
    val packageVersionProvider = providers.gradleProperty("saltMarcherVersion").orElse("0.1.0")
    val preloaderClassNameProvider = providers.gradleProperty("saltMarcherPreloaderClass")
        .orElse("bootstrap.SaltMarcherPreloader")
    val startupWmClassProvider = providers.gradleProperty("saltMarcherStartupWmClass")
        .orElse("bootstrap.SaltMarcherApp")
    val stylesheetRelativePathProvider = providers.gradleProperty("saltMarcherStylesheet")
        .orElse("resources/salt-marcher.css")
    val jqassistantVersion = providers.gradleProperty("saltMarcherJqassistantVersion").orNull ?: DefaultJqassistantVersion
    val sourceRoots = files("bootstrap", "shell", "src")
    val sourceJavaRoots = files("bootstrap", "shell", "src")
    val sourceSets = the<SourceSetContainer>()
    val mainSourceSet = sourceSets["main"]
    val mainJavaClassesDir = tasks.named<JavaCompile>("compileJava").flatMap(JavaCompile::getDestinationDirectory)
    val commonFocusedArchunitSupportIncludes = listOf(
        "architecture/AnalyzeMainClasses.java",
        "architecture/MainSourceLocationProvider.java"
    )
    val installedAppDirectory = layout.dir(
        launcherNameProvider.map { launcherName ->
            File(System.getProperty("user.home"), ".local/opt/$launcherName")
        }
    )
    val desktopDirectory = layout.dir(providers.provider { resolveDesktopDirectory().toFile() })
    val applicationsDirectory = layout.dir(
        providers.provider { File(System.getProperty("user.home"), ".local/share/applications") }
    )

    return QualityConventionEnvironment(
        enforcementBundles = enforcementBundles,
        focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode,
        verificationLayout = QualityConventionVerificationLayout(
            sourceSets = sourceSets,
            mainSourceSet = mainSourceSet,
            sourceRoots = sourceRoots,
            sourceJavaRoots = sourceJavaRoots,
            mainJavaClassesDir = mainJavaClassesDir,
            commonFocusedArchunitSupportIncludes = commonFocusedArchunitSupportIncludes
        ),
        packagingMetadata = QualityConventionPackagingMetadata(
            appDisplayNameProvider = appDisplayNameProvider,
            desktopIconSourceRelativePathProvider = desktopIconSourceRelativePathProvider,
            desktopEntryIconRelativePathProvider = desktopEntryIconRelativePathProvider,
            windowIconRelativePathProvider = windowIconRelativePathProvider,
            launcherNameProvider = launcherNameProvider,
            mainClassNameProvider = mainClassNameProvider,
            packageVersionProvider = packageVersionProvider,
            preloaderClassNameProvider = preloaderClassNameProvider,
            startupWmClassProvider = startupWmClassProvider,
            stylesheetRelativePathProvider = stylesheetRelativePathProvider,
            installedAppDirectory = installedAppDirectory,
            desktopDirectory = desktopDirectory,
            applicationsDirectory = applicationsDirectory
        ),
        jqassistantVersion = jqassistantVersion
    )
}

internal fun Project.registerQualityConventionToolConfigurations(): QualityConventionToolConfigurations {
    fun registerToolConfiguration(name: String): NamedDomainObjectProvider<Configuration> {
        return configurations.register(name) {
            isCanBeConsumed = false
        }
    }

    return QualityConventionToolConfigurations(
        cpdCli = registerToolConfiguration("cpdCli"),
        pmdCli = registerToolConfiguration("pmdCli"),
        ckjmToolClasspath = registerToolConfiguration("ckjmToolClasspath"),
        proguardToolClasspath = registerToolConfiguration("proguardToolClasspath"),
        jqassistantDistribution = registerToolConfiguration("jqassistantDistribution")
    )
}

internal fun Project.registerQualityConventionDependencies(
    toolConfigurations: QualityConventionToolConfigurations,
    environment: QualityConventionEnvironment
) {
    dependencies {
        add("errorprone", "com.google.errorprone:error_prone_core:2.48.0")
        add("errorprone", "com.uber.nullaway:nullaway:0.13.1")
        add("errorprone", "saltmarcher.quality:quality-rules-errorprone:1.0-SNAPSHOT")
        add(toolConfigurations.cpdCli.name, "net.sourceforge.pmd:pmd-cli:7.23.0")
        add(toolConfigurations.cpdCli.name, "net.sourceforge.pmd:pmd-java:7.23.0")
        add(toolConfigurations.pmdCli.name, "net.sourceforge.pmd:pmd-cli:7.23.0")
        add(toolConfigurations.pmdCli.name, "net.sourceforge.pmd:pmd-java:7.23.0")
        add(toolConfigurations.ckjmToolClasspath.name, "gr.spinellis.ckjm:ckjm_ext:2.10")
        add(toolConfigurations.ckjmToolClasspath.name, "org.apache.bcel:bcel:6.11.0")
        add(toolConfigurations.ckjmToolClasspath.name, "org.apache.ant:ant:1.10.15")
        add(toolConfigurations.ckjmToolClasspath.name, "org.apache.commons:commons-math3:3.6.1")
        add(toolConfigurations.proguardToolClasspath.name, "net.sf.proguard:proguard-base:6.0.3")
        add(
            toolConfigurations.jqassistantDistribution.name,
            "com.buschmais.jqassistant.cli:jqassistant-commandline-neo4jv5:${environment.jqassistantVersion}:distribution@zip"
        )
    }
}

internal fun Project.applyCommonErrorProneOptions(task: JavaCompile) {
    with(task) {
        dependsOn(gradle.includedBuild("quality-rules-errorprone").task(":jar"))
        options.errorprone.enabled.set(true)
        options.errorprone.disableWarningsInGeneratedCode.set(true)
        options.errorprone.disable("DuplicateBranches")
        options.errorprone.disable("StringConcatToTextBlock")
        options.errorprone.disable("ThreadJoinLoop")
        options.errorprone.error("EqualsNull")
        options.errorprone.error("NullAway")
        options.errorprone.error("ReferenceEquality")
        options.errorprone.error("StringCaseLocaleUsage")
        options.errorprone.error("StringSplitter")
        options.errorprone.option("NullAway:AnnotatedPackages", "bootstrap,shell,src")
        options.compilerArgs.add("-XDaddTypeAnnotationsToSymbol=true")
    }
}
