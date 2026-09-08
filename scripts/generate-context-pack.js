#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { parseFrontmatter } = require("./validate-knowledge-metadata");

const SEARCH_ROOTS = [".kiro/specs", "docs", "lib", "tests", "knowledge"];
const EXCLUDED_DIRS = new Set([".git", "node_modules", "artifacts", "cache", ".terraform", ".semgrep_cache"]);
const EXCLUDED_EXTENSIONS = new Set([".key", ".pem", ".p8", ".p12", ".tfstate", ".tfplan"]);
const MAX_FILE_BYTES = 256 * 1024;
const DEFAULT_LIMIT = 12;

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function assertInsideRepository(repositoryRoot, candidatePath) {
  const root = path.resolve(repositoryRoot);
  const resolved = path.resolve(candidatePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("input path must stay inside repository root");
  }
  return resolved;
}

function extractTokens(text) {
  const stop = new Set([
    "the","and","for","with","from","into","this","that","markdown","github","repository",
    "loop","pack","context","note","input","output","initial","scope","goal","constraints",
    "expected","success","criteria"
  ]);
  const tokens = (text.toLowerCase().match(/[a-z][a-z0-9_.-]{2,}/g) || [])
    .map((token) => token.replace(/[._-]+$/g, ""))
    .filter((token) => token.length >= 3 && !stop.has(token));
  return [...new Set(tokens)].sort();
}

function shouldSkipFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXCLUDED_EXTENSIONS.has(ext);
}

function discoverFiles(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const result = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || shouldSkipFile(full)) continue;
      const stat = fs.statSync(full);
      if (stat.size > MAX_FILE_BYTES) continue;
      result.push(full);
    }
  }

  const agents = path.join(root, "AGENTS.md");
  if (fs.existsSync(agents)) result.push(agents);
  for (const scope of SEARCH_ROOTS) walk(path.join(root, scope));
  return [...new Set(result)].sort();
}

function scoreCandidate(relativePath, content, tokens) {
  const lowerPath = relativePath.toLowerCase();
  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (lowerPath.includes(token)) score += 5;
    const matches = lowerContent.split(token).length - 1;
    score += Math.min(matches, 5);
  }

  if (relativePath === "AGENTS.md") score += 1000;
  if (relativePath === "docs/module-registry.md") score += 3;
  if (relativePath === "docs/loop-engineering.md") score += 3;
  return score;
}

function rankRelatedFiles(repositoryRoot, inputPath, limit = DEFAULT_LIMIT) {
  const root = path.resolve(repositoryRoot);
  const safeInput = assertInsideRepository(root, inputPath);
  const inputContent = fs.readFileSync(safeInput, "utf8");
  const tokens = extractTokens(inputContent);

  return discoverFiles(root)
    .filter((file) => path.resolve(file) !== safeInput)
    .map((file) => {
      const relativePath = toPosix(path.relative(root, file));
      const content = fs.readFileSync(file, "utf8");
      return { path: relativePath, score: scoreCandidate(relativePath, content, tokens) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "context-pack";
}

function formatList(name, values) {
  if (values.length === 0) return name + ": []";
  return name + ":\n" + values.map((value) => "  - " + value).join("\n");
}

function buildContextPack({ repositoryRoot, inputPath, rankedFiles, date = new Date().toISOString().slice(0, 10) }) {
  const root = path.resolve(repositoryRoot);
  const safeInput = assertInsideRepository(root, inputPath);
  const relativeInput = toPosix(path.relative(root, safeInput));
  const input = fs.readFileSync(safeInput, "utf8");
  const metadata = parseFrontmatter(input);
  const sourceId = metadata.id;
  if (!sourceId) throw new Error("input note must have an id");

  const basename = slugify(path.basename(relativeInput));
  const contextId = "context-pack-" + basename;
  const related = rankedFiles.filter((item) => item.path !== "AGENTS.md");
  const sources = [relativeInput, ...rankedFiles.map((item) => item.path)];
  const tick = String.fromCharCode(96);

  return [
    "---",
    "id: " + contextId,
    "type: context-pack",
    "status: draft",
    "created: " + date,
    "updated: " + date,
    formatList("source", sources),
    "supports:",
    "  - " + sourceId,
    "contradicts: []",
    "supersedes: []",
    "reviewed_by: []",
    "---",
    "",
    "# Context Pack: " + sourceId,
    "",
    "## Intent",
    "",
    "Source inbox: " + tick + relativeInput + tick,
    "",
    "## Repository Rules",
    "",
    "- " + tick + "AGENTS.md" + tick + " must be read before implementation.",
    "- code / tests / module registry remain current implementation truth.",
    "",
    "## Related Files",
    "",
    ...(related.length
      ? related.map((item) => "- " + tick + item.path + tick + " (score: " + item.score + ")")
      : ["- No ranked related files found."]),
    "",
    "## Extracted Constraints",
    "",
    "- Preserve Evidence -> Schema -> Sign -> Store -> Ledger.",
    "- Keep Local-first / AWS-on-demand.",
    "- Do not add AWS resources or external AI services for Context Pack generation.",
    "- Do not store raw prompts, raw responses, secrets, credentials, or unnecessary PII.",
    "- Context Pack is supporting context, not a replacement for code/tests/module registry.",
    "- Human or independent Agent review remains required before implementation decisions are treated as approved.",
    "",
    "## Review Checklist",
    "",
    "- [ ] Related files are actually relevant to the Inbox intent.",
    "- [ ] No security-sensitive context is missing.",
    "- [ ] No stale knowledge is being treated as implementation truth.",
    "- [ ] Scope is narrow enough for the next spec/implementation step.",
    ""
  ].join("\n");
}

function generateContextPack(repositoryRoot, inputPath, options = {}) {
  const root = path.resolve(repositoryRoot);
  const safeInput = assertInsideRepository(root, path.resolve(root, inputPath));
  const rankedFiles = rankRelatedFiles(root, safeInput, options.limit || DEFAULT_LIMIT);
  const markdown = buildContextPack({
    repositoryRoot: root,
    inputPath: safeInput,
    rankedFiles,
    date: options.date
  });

  const basename = slugify(path.basename(safeInput));
  const outputDir = path.join(root, "knowledge", "20-research", "context-packs");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, basename + "-context.md");
  fs.writeFileSync(outputPath, markdown, "utf8");

  return {
    outputPath,
    relativeOutputPath: toPosix(path.relative(root, outputPath)),
    rankedFiles
  };
}

function runCli() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error("Usage: node scripts/generate-context-pack.js <repository-relative-inbox-note>");
    process.exitCode = 2;
    return;
  }

  try {
    const result = generateContextPack(repositoryRoot, inputArg);
    console.log("Context Pack generated: " + result.relativeOutputPath);
    for (const item of result.rankedFiles) {
      console.log("- " + item.path + " (" + item.score + ")");
    }
  } catch (error) {
    console.error("Context Pack generation failed: " + error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) runCli();

module.exports = {
  DEFAULT_LIMIT,
  SEARCH_ROOTS,
  assertInsideRepository,
  buildContextPack,
  discoverFiles,
  extractTokens,
  generateContextPack,
  rankRelatedFiles,
  scoreCandidate,
  slugify
};
