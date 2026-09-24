import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");

const aliasTargets = new Map(
  [
    ["config/constants.js", "config/constants-enhanced.js"],
    ["config/weapons.js", "config/weapons-enhanced.js"],
    ["config/presentations.js", "config/presentations-enhanced.js"],
    ["audio/MazeAudioEngine.js", "audio/MazeAudioEngine-enhanced.js"],
    ["components/GameUi.jsx", "components/GameUiEnhanced.jsx"],
    ["components/LevelSelectScreen.jsx", "components/LevelSelectScreen-2.0.jsx"],
    ["services/leaderboard.js", "services/leaderboard-enhanced.js"],
    ["game/gameplay.js", "game/gameplay-2.0.js"],
    ["game/labyrinth.js", "game/labyrinth-enhanced.js"],
    ["game/world.js", "game/world-enhanced.js"],
    ["game/rendering.js", "game/rendering-2.0.js"],
  ].map(([source, replacement]) => [
    path.join(sourceRoot, source),
    path.join(sourceRoot, replacement),
  ]),
);

function collectSourceFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath);
      }

      return /\.(?:js|jsx)$/.test(entry.name)
        ? [entryPath]
        : [];
    });
}

function extractImports(source) {
  const imports = [];
  const staticPattern =
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicPattern =
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [staticPattern, dynamicPattern]) {
    let match = pattern.exec(source);

    while (match) {
      imports.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return imports;
}

function findExistingModule(modulePath) {
  const candidates = [
    modulePath,
    `${modulePath}.js`,
    `${modulePath}.jsx`,
    path.join(modulePath, "index.js"),
    path.join(modulePath, "index.jsx"),
  ];

  return candidates.find(
    (candidate) =>
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isFile(),
  );
}

function resolveImport(importer, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const [pathname, query = ""] = specifier.split("?", 2);
  const bypassAlias =
    new URLSearchParams(query).has("core");
  const resolved = findExistingModule(
    path.resolve(path.dirname(importer), pathname),
  );

  if (!resolved) {
    throw new Error(
      `Missing local import in ${path.relative(projectRoot, importer)}: ${specifier}`,
    );
  }

  return bypassAlias
    ? resolved
    : aliasTargets.get(resolved) ?? resolved;
}

const files = collectSourceFiles(sourceRoot);
const graph = new Map();

for (const file of files) {
  const imports = extractImports(fs.readFileSync(file, "utf8"));
  graph.set(
    file,
    imports
      .map((specifier) => resolveImport(file, specifier))
      .filter(Boolean),
  );
}

const states = new Map();
const stack = [];
const cycles = new Set();

function visit(file) {
  states.set(file, "visiting");
  stack.push(file);

  for (const dependency of graph.get(file) ?? []) {
    const dependencyState = states.get(dependency);

    if (dependencyState === "visiting") {
      const cycleStart = stack.indexOf(dependency);
      const cycle = [
        ...stack.slice(cycleStart),
        dependency,
      ].map((entry) => path.relative(projectRoot, entry));
      cycles.add(cycle.join(" -> "));
      continue;
    }

    if (dependencyState !== "visited") {
      visit(dependency);
    }
  }

  stack.pop();
  states.set(file, "visited");
}

for (const file of files) {
  if (!states.has(file)) {
    visit(file);
  }
}

if (cycles.size) {
  console.error("Import cycles detected:");

  for (const cycle of cycles) {
    console.error(`- ${cycle}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    `Import-cycle audit passed: ${files.length} source modules, ${aliasTargets.size} Vite aliases.`,
  );
}
