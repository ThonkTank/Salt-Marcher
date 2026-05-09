package saltmarcher.buildlogic.tasks.hygiene

import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import javax.inject.Inject
import javax.xml.XMLConstants
import javax.xml.stream.XMLInputFactory
import javax.xml.stream.XMLStreamConstants
import org.gradle.api.Action
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Classpath
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.Optional
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.api.tasks.VerificationException
import org.gradle.process.ExecOperations
import org.gradle.process.JavaExecSpec

@CacheableTask
abstract class CheckNoDeadCodeTask @Inject constructor(
    private val execOperations: ExecOperations
) : DefaultTask() {

    @get:Classpath
    abstract val toolClasspath: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val compiledClassesDirectory: DirectoryProperty

    @get:Classpath
    abstract val runtimeClasspath: ConfigurableFileCollection

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val javaHomeJmodsDirectory: DirectoryProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val resourceRoots: ConfigurableFileCollection

    @get:Optional
    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val keepRulesFiles: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val workingDirectory: DirectoryProperty

    @get:OutputFile
    abstract val reportFile: RegularFileProperty

    @get:OutputFile
    abstract val successMarker: RegularFileProperty

    @TaskAction
    fun check() {
        val compiledRoot = compiledClassesDirectory.get().asFile
        val classEntries = loadClassEntries(compiledRoot)
        val workDir = workingDirectory.get().asFile.toPath()
        val generatedKeepRulesFile = workDir.resolve("generated-keep-rules.pro")
        val configFile = workDir.resolve("proguard-deadcode.pro")
        val usageFile = workDir.resolve("usage.txt")
        val outputJar = workDir.resolve("deadcode-out.jar")

        resetDirectory(workDir)
        Files.createDirectories(workDir)
        writeGeneratedKeepRules(generatedKeepRulesFile)
        writeProguardConfig(
            configFile = configFile,
            usageFile = usageFile,
            outputJar = outputJar,
            generatedKeepRulesFile = generatedKeepRulesFile
        )
        Files.deleteIfExists(successMarker.get().asFile.toPath())

        execOperations.javaexec(object : Action<JavaExecSpec> {
            override fun execute(spec: JavaExecSpec) {
                spec.classpath = toolClasspath
                spec.mainClass.set("proguard.ProGuard")
                spec.args(configFile.toString())
            }
        })

        val findings = parseFindings(classEntries, usageFile)
        writeReport(findings)
        if (findings.hasFailures()) {
            throw VerificationException(
                "Dead code remains in production sources. See ${reportFile.get().asFile.invariantPath()}."
            )
        }
        Files.writeString(successMarker.get().asFile.toPath(), "passed\n")
    }

    private fun writeGeneratedKeepRules(outputFile: Path) {
        val resourceRootDirs = resourceRoots.files.filter(File::isDirectory).sortedBy(File::invariantPath)
        val fxmlRoots = loadFxmlRoots(resourceRootDirs)
        val serviceLoaderRoots = loadServiceLoaderRoots(resourceRootDirs)
        val explicitKeepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val lines = buildList {
            add("# Generated structural dead-code roots.")
            add("-keep class * extends javafx.application.Application {")
            add("    public <init>();")
            add("    public static void main(java.lang.String[]);")
            add("    public void init();")
            add("    public void start(...);")
            add("    public void stop();")
            add("}")
            add("-keep class * extends javafx.application.Preloader {")
            add("    public <init>();")
            add("    public void init();")
            add("    public void start(...);")
            add("    public void stop();")
            add("    public void handleApplicationNotification(...);")
            add("    public void handleStateChangeNotification(...);")
            add("}")
            add("-keep class src.view.leftbartabs.**.*Contribution implements shell.api.ShellContribution {")
            add("    public <init>();")
            add("    *** registrationSpec(...);")
            add("    *** bind(...);")
            add("}")
            add("-keep class src.view.statetabs.**.*Contribution implements shell.api.ShellContribution {")
            add("    public <init>();")
            add("    *** registrationSpec(...);")
            add("    *** bind(...);")
            add("}")
            add("-keep class src.view.dropdowns.**.*Contribution implements shell.api.ShellContribution {")
            add("    public <init>();")
            add("    *** registrationSpec(...);")
            add("    *** bind(...);")
            add("}")
            add("-keep class src.data.**.*ServiceContribution implements shell.api.ServiceContribution {")
            add("    public <init>();")
            add("    *** register(...);")
            add("}")
            fxmlRoots.forEach { root ->
                add("-keep class ${root.binaryName} {")
                add("    public <init>();")
                add("    *** initialize(...);")
                root.methods.sorted().forEach { methodName ->
                    add("    *** $methodName(...);")
                }
                root.fields.sorted().forEach { fieldName ->
                    add("    *** $fieldName;")
                }
                add("}")
            }
            serviceLoaderRoots.sorted().forEach { binaryName ->
                add("-keep class $binaryName {")
                add("    public <init>();")
                add("}")
            }
            if (explicitKeepFiles.isNotEmpty()) {
                add("# Repo-owned fallback keep rules are included from the main config.")
            }
        }
        Files.writeString(outputFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun writeProguardConfig(
        configFile: Path,
        usageFile: Path,
        outputJar: Path,
        generatedKeepRulesFile: Path
    ) {
        val keepFiles = keepRulesFiles.files.filter(File::isFile).sortedBy(File::invariantPath)
        val runtimeJars = runtimeClasspath.files
            .asSequence()
            .filter(File::isFile)
            .sortedBy(File::invariantPath)
            .toList()
        val jmods = javaHomeJmodsDirectory.get().asFile.listFiles()
            ?.filter { file -> file.isFile && file.extension == "jmod" }
            ?.sortedBy(File::invariantPath)
            .orEmpty()

        val lines = buildList {
            add("-injars ${compiledClassesDirectory.get().asFile.invariantPath()}")
            add("-outjars ${outputJar.toFile().invariantPath()}")
            add("-printusage ${usageFile.toFile().invariantPath()}")
            add("-dontobfuscate")
            add("-dontoptimize")
            add("-dontpreverify")
            add("-dontnote")
            add("-dontwarn **")
            add("-ignorewarnings")
            add("-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod")
            jmods.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            runtimeJars.forEach { file ->
                add("-libraryjars ${file.invariantPath()}")
            }
            add("-include ${generatedKeepRulesFile.toFile().invariantPath()}")
            keepFiles.forEach { file ->
                add("-include ${file.invariantPath()}")
            }
        }
        Files.writeString(configFile, lines.joinToString(separator = "\n", postfix = "\n"))
    }

    private fun parseFindings(classEntries: List<ClassEntry>, usageFile: Path): DeadCodeFindings {
        val lines = if (Files.isRegularFile(usageFile)) {
            Files.readAllLines(usageFile)
                .map(String::trim)
                .filter(String::isNotEmpty)
                .sorted()
        } else {
            emptyList()
        }
        val classesByBinaryName = classEntries.associateBy(ClassEntry::binaryName)
        val deadTypes = mutableListOf<DeadType>()
        val deadMethods = mutableListOf<DeadMember>()
        val deadFields = mutableListOf<DeadMember>()

        lines.forEach { line ->
            if (':' !in line) {
                val entry = classesByBinaryName[line] ?: return@forEach
                deadTypes += DeadType(entry.sourceRelativePath, entry.binaryName)
                return@forEach
            }
            val owner = line.substringBefore(':').trim()
            val member = line.substringAfter(':').trim()
            val entry = classesByBinaryName[owner] ?: return@forEach
            if ('(' in member) {
                deadMethods += DeadMember(entry.sourceRelativePath, "$owner#$member")
            } else {
                deadFields += DeadMember(entry.sourceRelativePath, "$owner#$member")
            }
        }

        val deadTypeNames = deadTypes.map(DeadType::name).toSet()
        val deadFiles = classEntries
            .groupBy(ClassEntry::topLevelBinaryName)
            .values
            .filter { siblings -> siblings.all { sibling -> sibling.binaryName in deadTypeNames } }
            .map { siblings -> siblings.first().sourceRelativePath }
            .distinct()
            .sorted()

        return DeadCodeFindings(
            deadFiles = deadFiles,
            deadTypes = deadTypes.sortedWith(compareBy(DeadType::sourceRelativePath, DeadType::name)),
            deadMethods = deadMethods.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name)),
            deadFields = deadFields.sortedWith(compareBy(DeadMember::sourceRelativePath, DeadMember::name))
        )
    }

    private fun writeReport(findings: DeadCodeFindings) {
        val reportPath = reportFile.get().asFile.toPath()
        Files.createDirectories(reportPath.parent)
        Files.writeString(reportPath, findings.render())
    }

    private fun loadClassEntries(compiledRoot: File): List<ClassEntry> {
        if (!compiledRoot.isDirectory) {
            return emptyList()
        }
        val rootPath = compiledRoot.toPath()
        return compiledRoot.walkTopDown()
            .filter { file -> file.isFile && file.extension == "class" }
            .sortedBy(File::invariantPath)
            .mapNotNull { classFile ->
                val relativePath = rootPath.relativize(classFile.toPath()).invariantPath()
                val internalName = relativePath.removeSuffix(".class")
                val simpleName = internalName.substringAfterLast('$')
                when {
                    simpleName.isBlank() -> null
                    simpleName.firstOrNull()?.isDigit() == true -> null
                    "$$" in simpleName -> null
                    else -> {
                        val binaryName = internalName.replace('/', '.')
                        val topLevelBinaryName = internalName.substringBefore('$').replace('/', '.')
                        ClassEntry(
                            binaryName = binaryName,
                            topLevelBinaryName = topLevelBinaryName,
                            sourceRelativePath = "${internalName.substringBefore('$')}.java"
                        )
                    }
                }
            }
            .toList()
    }

    private fun loadFxmlRoots(resourceRoots: List<File>): List<FxmlRoot> {
        val xmlFactory = XMLInputFactory.newFactory().apply {
            setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false)
            setProperty(XMLInputFactory.SUPPORT_DTD, false)
            setProperty(XMLConstants.ACCESS_EXTERNAL_DTD, "")
            setProperty(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "")
        }
        return resourceRoots
            .asSequence()
            .flatMap { root ->
                root.walkTopDown()
                    .asSequence()
                    .filter { file -> file.isFile && file.extension == "fxml" }
                    .sortedBy(File::invariantPath)
                    .mapNotNull { file ->
                        val methods = linkedSetOf<String>()
                        val fields = linkedSetOf<String>()
                        var controllerBinaryName: String? = null
                        file.inputStream().use { input ->
                            val reader = xmlFactory.createXMLStreamReader(input)
                            while (reader.hasNext()) {
                                if (reader.next() != XMLStreamConstants.START_ELEMENT) {
                                    continue
                                }
                                for (index in 0 until reader.attributeCount) {
                                    val value = reader.getAttributeValue(index) ?: continue
                                    val localName = reader.getAttributeLocalName(index)
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "controller") {
                                        controllerBinaryName = value
                                    }
                                    if (value.startsWith("#")) {
                                        methods += value.removePrefix("#")
                                    }
                                    if (reader.getAttributePrefix(index) == "fx" && localName == "id") {
                                        fields += value
                                    }
                                }
                            }
                            reader.close()
                        }
                        controllerBinaryName?.let { binaryName ->
                            FxmlRoot(
                                binaryName = binaryName,
                                methods = methods,
                                fields = fields
                            )
                        }
                    }
            }
            .distinctBy(FxmlRoot::binaryName)
            .toList()
    }

    private fun loadServiceLoaderRoots(resourceRoots: List<File>): Set<String> {
        return resourceRoots
            .asSequence()
            .map { root -> root.resolve("META-INF/services") }
            .filter(File::isDirectory)
            .flatMap { servicesDir ->
                servicesDir.walkTopDown()
                    .asSequence()
                    .filter(File::isFile)
                    .sortedBy(File::invariantPath)
                    .flatMap { file ->
                        file.readLines()
                            .asSequence()
                            .map(String::trim)
                            .filter { line -> line.isNotEmpty() && !line.startsWith("#") }
                    }
            }
            .toSortedSet()
    }

    private fun resetDirectory(directory: Path) {
        if (!Files.exists(directory)) {
            return
        }
        Files.walk(directory)
            .sorted(Comparator.reverseOrder())
            .forEach(Files::deleteIfExists)
    }
}

private data class ClassEntry(
    val binaryName: String,
    val topLevelBinaryName: String,
    val sourceRelativePath: String
)

private data class FxmlRoot(
    val binaryName: String,
    val methods: Set<String>,
    val fields: Set<String>
)

private data class DeadType(
    val sourceRelativePath: String,
    val name: String
)

private data class DeadMember(
    val sourceRelativePath: String,
    val name: String
)

private data class DeadCodeFindings(
    val deadFiles: List<String>,
    val deadTypes: List<DeadType>,
    val deadMethods: List<DeadMember>,
    val deadFields: List<DeadMember>
) {
    fun hasFailures(): Boolean =
        deadFiles.isNotEmpty() || deadTypes.isNotEmpty() || deadMethods.isNotEmpty() || deadFields.isNotEmpty()

    fun render(): String = buildString {
        appendLine("# Dead Code Report")
        appendLine()
        appendLine("Files: ${deadFiles.size}")
        appendLine("Types: ${deadTypes.size}")
        appendLine("Methods: ${deadMethods.size}")
        appendLine("Fields: ${deadFields.size}")
        appendLine()
        appendSection("Dead Files", deadFiles)
        appendSection("Dead Types", deadTypes.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Methods", deadMethods.map { "${it.sourceRelativePath} :: ${it.name}" })
        appendSection("Dead Fields", deadFields.map { "${it.sourceRelativePath} :: ${it.name}" })
    }

    private fun StringBuilder.appendSection(title: String, items: List<String>) {
        appendLine("## $title")
        if (items.isEmpty()) {
            appendLine("none")
        } else {
            items.forEach { item -> appendLine(item) }
        }
        appendLine()
    }
}

private fun Path.invariantPath(): String = toString().replace(File.separatorChar, '/')

private fun File.invariantPath(): String = path.replace(File.separatorChar, '/')
