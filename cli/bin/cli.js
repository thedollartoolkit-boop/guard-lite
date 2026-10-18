#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const PACK = require(path.join(__dirname, "..", "package.json"));
const engine = require(path.join(__dirname, "..", "lib", "engine.js"));

const EXIT_CLEAN = 0;
const EXIT_FINDINGS = 1;
const EXIT_USAGE = 2;

function usage() {
  const c = [
    "",
    "  " + PACK.name + " v" + PACK.version + " — Guard Lite design-contract checker",
    "",
    "  Usage:",
    "    design-contract-checker --contract <file> [source files...]",
    "    design-contract-checker --json --contract <file> [source files...]",
    "",
    "  Contract file format (one line per category, comma separated):",
    "    colors = #f2eee5, #18231d, #a95038",
    "    fonts = Georgia, Arial",
    "    font-sizes = 16px, 24px, 48px",
    "    spacing = 8px, 16px, 24px, 48px",
    "    radii = 0, 2px, 4px",
    "",
    "  Options:",
    "    --contract <file>  Required. Path to the declared design contract.",
    "    --json             Print machine-readable JSON instead of text.",
    "    -h, --help         Show this help.",
    "",
    "  Checks: PPG-COLOR-001 PPG-TYPE-001 PPG-TYPE-002 PPG-SPACE-001 PPG-RADIUS-001",
    "  Text analysis only: var()/calc()/clamp() values are skipped, not resolved.",
    "  Learn: https://pixel-perfect-system.netlify.app/guard/",
    "",
  ].join("\n");
  process.stdout.write(c + "\n");
}

function fail(message, details) {
  process.stderr.write("Error: " + message + (details ? "\n" + details : "") + "\n");
  process.exit(EXIT_USAGE);
}

function parseArgs(argv) {
  const out = { contractPath: null, json: false, help: false, sources: [] };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help" || arg === "help") {
      out.help = true;
      i += 1;
      continue;
    }
    if (arg === "--json") {
      out.json = true;
      i += 1;
      continue;
    }
    if (arg === "--contract") {
      const next = argv[i + 1];
      if (!next) fail("--contract requires a file path.");
      out.contractPath = next;
      i += 2;
      continue;
    }
    if (arg.indexOf("--") === 0) fail("Unknown option: " + arg, "Run with --help.");
    out.sources.push(arg);
    i += 1;
  }
  return out;
}

function readFileChecked(fullPath, maxChars, maxBytesLabel) {
  let text;
  try {
    text = fs.readFileSync(fullPath, "utf8");
  } catch (e) {
    fail("Cannot read " + fullPath + ": " + e.message);
  }
  if (text.length > maxChars) {
    fail(fullPath + " is too large for Guard Lite (" + text.length + " chars).", maxBytesLabel);
  }
  return text;
}

function outputText(summary, results, total) {
  const out = [];
  results.forEach(function (res) {
    out.push(res.file + ": " + res.summary.lines + " lines inspected, " +
      res.summary.violations + " contract violations, " + res.summary.reviews + " needs review\n");
    res.findings.forEach(function (f) {
      out.push("[" + f.id + "] " + res.file + ":" + f.line + " " + f.property);
      if (f.status === "Review") {
        out.push("  REVIEW — " + f.title);
        out.push("  Found: " + f.found + " | " + f.expected);
      } else {
        out.push("  VIOLATION — " + f.title);
        const allowed = f.expected.split(", ").filter(Boolean);
        const list = allowed.length > 8 ? allowed.slice(0, 8).join(", ") + ", …" : allowed.join(", ");
        out.push("  Found: " + f.found + " | Allowed: " + list);
      }
      out.push("  Repair: " + f.repair + "\n");
    });
    if (res.findings.length === 0) {
      out.push("  No outside literal values were found. This does not prove the rendered interface follows the contract — only that these five text checks saw nothing outside it.\n");
    }
  });
  out.push("Summary: " + total.violations + " contract violations, " + total.reviews + " needs review.");
  process.stdout.write(out.join("\n") + "\n");
}

function outputJson(summary, results, total) {
  const payload = {
    tool: PACK.name,
    version: PACK.version,
    note: "Text analysis only. Values through var(), calc(), clamp() or keywords are skipped. Rule IDs are stable identifiers.",
    summary: total,
    results: results
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(EXIT_CLEAN);
  }
  if (!args.contractPath) fail("Missing --contract.", "Run with --help for the format.");
  if (args.sources.length === 0) fail("No source files given.", "Pass one or more CSS, HTML or text files after --contract <file>.");

  const contractText = readFileChecked(
    path.resolve(args.contractPath),
    engine.MAX_CONTRACT_CHARS,
    "Limit: 12000 contract characters."
  );
  const contract = engine.parseContract(contractText);
  const supplied = Object.keys(contract).filter(function (k) { return contract[k].length > 0; });
  if (supplied.length === 0) {
    fail("The contract format was not recognised.",
      "Use lines like: colors = #f2eee5, #18231d (names: colors, fonts, font-sizes, spacing, radii).");
  }

  const results = [];
  args.sources.forEach(function (sourcePath) {
    const sourceText = readFileChecked(
      path.resolve(sourcePath),
      engine.MAX_SOURCE_CHARS,
      "Limit: 100000 source characters per file."
    );
    const r = engine.scan(contract, sourceText);
    results.push({
      file: path.relative(process.cwd(), path.resolve(sourcePath)) || sourcePath,
      summary: engine.summarize(r),
      findings: r.findings
    });
  });

  const total = {
    violations: results.reduce(function (s, r) { return s + r.summary.violations; }, 0),
    reviews: results.reduce(function (s, r) { return s + r.summary.reviews; }, 0),
    lines: results.reduce(function (s, r) { return s + r.summary.lines; }, 0)
  };

  if (args.json) outputJson(total, results, total);
  else outputText(total, results, total);

  process.exit(total.violations > 0 ? EXIT_FINDINGS : EXIT_CLEAN);
}

main();
