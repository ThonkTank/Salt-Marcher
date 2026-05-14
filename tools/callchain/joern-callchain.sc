import io.shiftleft.codepropertygraph.generated.nodes.Method
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths}
import scala.collection.mutable

@main def exec(
    cpgFile: String,
    selector: String,
    outDir: String,
    depth: String,
    includeExternal: String
): Unit = {
  importCpg(cpgFile)

  val maxDepth = depth.toInt
  val includeNonProject = includeExternal.toBoolean
  val outputRoot = Paths.get(outDir)
  Files.createDirectories(outputRoot)

  def normalizeSelector(raw: String): String =
    raw.trim.replace('#', '.')

  def projectMethod(method: Method): Boolean = {
    val fullName = Option(method.fullName).getOrElse("")
    fullName.startsWith("bootstrap.") ||
      fullName.startsWith("shell.") ||
      fullName.startsWith("src.")
  }

  def visible(method: Method): Boolean =
    includeNonProject || projectMethod(method)

  def methodSource(method: Method): String = {
    val file = Option(method.filename).getOrElse("")
    val line = method.lineNumber.map(_.toString).getOrElse("")
    if (file.nonEmpty && line.nonEmpty) s"$file:$line"
    else if (file.nonEmpty) file
    else ""
  }

  def methodLabel(method: Method): String = {
    val source = methodSource(method)
    val base = Option(method.fullName).getOrElse(method.name)
    if (source.isEmpty) base else s"$base\\n$source"
  }

  val normalized = normalizeSelector(selector)
  val candidates = cpg.method
    .filter { method =>
      val fullName = Option(method.fullName).getOrElse("")
      fullName == selector ||
        fullName == normalized ||
        fullName.contains(selector) ||
        fullName.contains(normalized) ||
        method.name == selector ||
        method.name == normalized
    }
    .l
    .filter(visible)
    .sortBy(method => (method.fullName, methodSource(method)))

  writeText(
    outputRoot.resolve("candidates.tsv"),
    candidates
      .map(method => s"${method.fullName}\t${method.name}\t${methodSource(method)}")
      .mkString("", "\n", "\n")
  )

  if (candidates.isEmpty) {
    System.err.println(s"No Joern method matched selector '$selector'. See candidates.tsv.")
    System.exit(3)
  }

  if (candidates.size > 1) {
    System.err.println(s"Selector '$selector' matched ${candidates.size} methods. Narrow the selector; see candidates.tsv.")
    System.exit(4)
  }

  val root = candidates.head
  val rootFullName = root.fullName

  val allMethodsByFullName = cpg.method.l
    .filter(visible)
    .groupBy(_.fullName)
    .view
    .mapValues(_.head)
    .toMap

  def outgoing(fullName: String): List[String] =
    cpg.method.fullNameExact(fullName).callOut.methodFullName.l
      .distinct
      .filter(allMethodsByFullName.contains)
      .sorted

  def incoming(fullName: String): List[String] =
    cpg.method.fullNameExact(fullName).callIn.method.fullName.l
      .distinct
      .filter(allMethodsByFullName.contains)
      .sorted

  def traverse(seed: String, next: String => List[String]): Set[(String, String)] = {
    val edges = mutable.LinkedHashSet.empty[(String, String)]
    val queue = mutable.Queue((seed, 0))
    val seen = mutable.Set(seed)
    while (queue.nonEmpty) {
      val (current, currentDepth) = queue.dequeue()
      if (currentDepth < maxDepth) {
        next(current).foreach { target =>
          edges += ((current, target))
          if (!seen.contains(target)) {
            seen += target
            queue.enqueue((target, currentDepth + 1))
          }
        }
      }
    }
    edges.toSet
  }

  val calleeEdges = traverse(rootFullName, outgoing)
  val callerEdges = traverse(rootFullName, incoming).map { case (caller, called) => (called, caller) }
  val bothEdges = calleeEdges ++ callerEdges

  writeText(outputRoot.resolve("callees.dot"), dotGraph("callees", rootFullName, calleeEdges, allMethodsByFullName, "out"))
  writeText(outputRoot.resolve("callers.dot"), dotGraph("callers", rootFullName, callerEdges, allMethodsByFullName, "in"))
  writeText(outputRoot.resolve("both.dot"), dotGraph("both", rootFullName, bothEdges, allMethodsByFullName, "both"))
  writeText(outputRoot.resolve("summary.txt"), summary(rootFullName, calleeEdges, callerEdges, maxDepth, includeNonProject))
}

def summary(
    rootFullName: String,
    calleeEdges: Set[(String, String)],
    callerEdges: Set[(String, String)],
    maxDepth: Int,
    includeNonProject: Boolean
): String =
  s"""Root: $rootFullName
     |Depth: $maxDepth
     |Include external: $includeNonProject
     |Callee edges: ${calleeEdges.size}
     |Caller edges: ${callerEdges.size}
     |
     |Static-analysis limits:
     |- Reflection, JavaFX event dispatch, ServiceLoader discovery, and runtime listener registration are not complete proof surfaces.
     |- Joern call edges are the authoritative input for this generated diagram; inspect source when a dynamic seam matters.
     |""".stripMargin

def dotGraph(
    name: String,
    rootFullName: String,
    edges: Set[(String, String)],
    methods: Map[String, Method],
    direction: String
): String = {
  val nodes = (edges.flatMap(edge => Set(edge._1, edge._2)) + rootFullName).toList.sorted
  val builder = new StringBuilder
  builder.append("digraph ").append(quoteId(name)).append(" {\n")
  builder.append("  graph [rankdir=LR, splines=true, overlap=false];\n")
  builder.append("  node [shape=box, style=\"rounded,filled\", fillcolor=\"#f8fafc\", fontname=\"Inter,Arial,sans-serif\", fontsize=10];\n")
  builder.append("  edge [color=\"#475569\", arrowsize=0.8];\n")
  builder.append("  label=").append(quote(s"SaltMarcher callchain: $direction")).append(";\n")
  nodes.foreach { fullName =>
    val method = methods.get(fullName)
    val label = method.map(methodLabel).getOrElse(fullName)
    val fill = if (fullName == rootFullName) "#fde68a" else "#f8fafc"
    builder
      .append("  ")
      .append(quoteId(fullName))
      .append(" [label=")
      .append(quote(label))
      .append(", fillcolor=")
      .append(quote(fill))
      .append("];\n")
  }
  edges.toList.sorted.foreach { case (from, to) =>
    builder.append("  ").append(quoteId(from)).append(" -> ").append(quoteId(to)).append(";\n")
  }
  builder.append("}\n")
  builder.toString()
}

def writeText(path: Path, text: String): Unit =
  Files.write(path, text.getBytes(StandardCharsets.UTF_8))

def quoteId(value: String): String =
  quote(value)

def quote(value: String): String =
  "\"" + value
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")
    .replace("\n", "\\n") + "\""
