#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_FIELDS = [
  "id",
  "type",
  "status",
  "created",
  "updated",
  "source",
  "supports",
  "contradicts",
  "supersedes",
  "reviewed_by"
];

const LIST_FIELDS = new Set([
  "source",
  "supports",
  "contradicts",
  "supersedes",
  "reviewed_by"
]);

const RELATION_FIELDS = ["supports", "contradicts", "supersedes"];
const ALLOWED_STATUSES = new Set(["inbox", "draft", "reviewed", "approved", "superseded"]);

function stripQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("missing frontmatter opening delimiter");
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error("missing frontmatter closing delimiter");
  }

  const block = normalized.slice(4, end);
  const metadata = {};
  let currentListKey = null;

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch) {
      if (!currentListKey) {
        throw new Error(`list item without list field: ${line.trim()}`);
      }
      metadata[currentListKey].push(stripQuotes(listMatch[1].trim()));
      continue;
    }

    const fieldMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!fieldMatch) {
      throw new Error(`unsupported frontmatter line: ${line.trim()}`);
    }

    const [, key, rawValue = ""] = fieldMatch;
    const value = rawValue.trim();

    if (LIST_FIELDS.has(key)) {
      if (value === "" || value === "[]") {
        metadata[key] = [];
        currentListKey = value === "" ? key : null;
      } else {
        throw new Error(`list field ${key} must use [] or block-list syntax`);
      }
      continue;
    }

    metadata[key] = stripQuotes(value);
    currentListKey = null;
  }

  return metadata;
}

function listMarkdownFiles(rootDir) {
  const result = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        if (relativePath === "templates" || relativePath.startsWith(`templates${path.sep}`)) {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") continue;
      if (entry.name.toLowerCase() === "readme.md") continue;
      result.push(fullPath);
    }
  }

  walk(rootDir);
  return result.sort();
}

function validateNoteMetadata(metadata, relativePath) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in metadata)) {
      errors.push(`${relativePath}: missing required field '${field}'`);
    }
  }

  if (metadata.id !== undefined && String(metadata.id).trim() === "") {
    errors.push(`${relativePath}: id must not be empty`);
  }

  if (metadata.type !== undefined && String(metadata.type).trim() === "") {
    errors.push(`${relativePath}: type must not be empty`);
  }

  if (metadata.status !== undefined && !ALLOWED_STATUSES.has(metadata.status)) {
    errors.push(
      `${relativePath}: invalid status '${metadata.status}' (allowed: ${[...ALLOWED_STATUSES].join(", ")})`
    );
  }

  for (const field of LIST_FIELDS) {
    if (field in metadata && !Array.isArray(metadata[field])) {
      errors.push(`${relativePath}: ${field} must be a list`);
    }
  }

  if (metadata.status === "reviewed" || metadata.status === "approved") {
    if (!Array.isArray(metadata.source) || metadata.source.length === 0) {
      errors.push(`${relativePath}: ${metadata.status} note requires at least one source`);
    }
    if (!Array.isArray(metadata.reviewed_by) || metadata.reviewed_by.length === 0) {
      errors.push(`${relativePath}: ${metadata.status} note requires at least one reviewed_by entry`);
    }
  }

  return errors;
}

function validateKnowledgeDirectory(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return { notes: [], errors: [`knowledge directory does not exist: ${rootDir}`] };
  }

  const files = listMarkdownFiles(rootDir);
  const notes = [];
  const errors = [];

  for (const file of files) {
    const relativePath = path.relative(rootDir, file).split(path.sep).join("/");
    try {
      const metadata = parseFrontmatter(fs.readFileSync(file, "utf8"));
      errors.push(...validateNoteMetadata(metadata, relativePath));
      notes.push({ file, relativePath, metadata });
    } catch (error) {
      errors.push(`${relativePath}: ${error.message}`);
    }
  }

  const byId = new Map();
  for (const note of notes) {
    const id = note.metadata.id;
    if (!id) continue;
    if (byId.has(id)) {
      errors.push(
        `${note.relativePath}: duplicate id '${id}' also used by ${byId.get(id).relativePath}`
      );
    } else {
      byId.set(id, note);
    }
  }

  for (const note of notes) {
    for (const relationField of RELATION_FIELDS) {
      const targets = note.metadata[relationField];
      if (!Array.isArray(targets)) continue;

      for (const target of targets) {
        if (!byId.has(target)) {
          errors.push(
            `${note.relativePath}: ${relationField} references unknown note id '${target}'`
          );
        }
      }
    }
  }

  return { notes, errors };
}

function runCli() {
  const rootDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "..", "knowledge");

  const result = validateKnowledgeDirectory(rootDir);

  if (result.errors.length > 0) {
    console.error(`Knowledge metadata validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Knowledge metadata validation passed for ${result.notes.length} note(s).`);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  ALLOWED_STATUSES,
  LIST_FIELDS,
  RELATION_FIELDS,
  REQUIRED_FIELDS,
  listMarkdownFiles,
  parseFrontmatter,
  validateKnowledgeDirectory,
  validateNoteMetadata
};
