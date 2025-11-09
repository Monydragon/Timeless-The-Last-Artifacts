const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PROJECT_ROOT = path.join(__dirname, "..");
const MAIN_PATH = path.join(PROJECT_ROOT, "main.js");
const ARTIFACT_DIR = path.join(PROJECT_ROOT, "data", "artifacts");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanText(text) {
  if (text === null || text === undefined) return text;
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, (match) => (match === "\n" ? "\n" : match));
}

function sanitizeArtifact(artifact) {
  const cleaned = {
    id: artifact.id,
    name: cleanText(artifact.name),
    rarity: artifact.rarity,
    summary: cleanText(artifact.summary),
    positive: cleanText(artifact.positive),
    negative: cleanText(artifact.negative),
    neutral: cleanText(artifact.neutral),
  };

  if (artifact.effects) {
    cleaned.effects = JSON.parse(JSON.stringify(artifact.effects));
  }

  if (artifact.apply) {
    cleaned.applyScript = cleanText(artifact.apply.toString());
  }

  return cleaned;
}

function main() {
  const source = fs.readFileSync(MAIN_PATH, "utf8");
  const start = source.indexOf("const CORE_ARTIFACTS");
  const end = source.indexOf("const SCENES");
  if (start === -1 || end === -1) {
    throw new Error("Unable to locate artifact definitions in main.js");
  }
  let snippet = source.slice(start, end);

  snippet = snippet.replace(
    /function createArtifact[\s\S]*?}\s*\n/,
    "function createArtifact(definition) { __collected.push(definition); return definition; }\n"
  );
  snippet = snippet.replace(
    /function runArtifactEffects[\s\S]*?function hashString/,
    "function runArtifactEffects() {}\nfunction hashString"
  );

  const sandbox = {
    __collected: [],
    console,
  };
  vm.createContext(sandbox);
  try {
    vm.runInContext(snippet, sandbox);
  } catch (error) {
    console.error("Failed to evaluate artifact definitions:", error);
    throw error;
  }

  let core = [];
  try {
    core = vm.runInContext("CORE_ARTIFACTS", sandbox) || [];
  } catch {}
  const expanded = sandbox.__collected || [];
  console.log(`Extracted counts -> core: ${core.length}, expanded: ${expanded.length}`);

  const artifactsArray = [...core, ...expanded];
  if (!artifactsArray.length) {
    throw new Error("No artifacts extracted");
  }

  const artifacts = artifactsArray;
  if (!Array.isArray(artifacts) || !artifacts.length) {
    throw new Error("No artifacts extracted");
  }

  ensureDir(ARTIFACT_DIR);
  const manifest = [];

  artifacts.forEach((artifact) => {
    const sanitized = sanitizeArtifact(artifact);
    const filename = `${sanitized.id}.json`;
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, filename),
      JSON.stringify(sanitized, null, 2),
      "utf8"
    );
    manifest.push(filename);
  });

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "index.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  console.log(`Exported ${manifest.length} artifacts to ${ARTIFACT_DIR}`);
}

if (require.main === module) {
  main();
}
