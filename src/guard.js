"use strict";

(function () {
  const form = document.getElementById("guard-form");
  const contractInput = document.getElementById("contract");
  const sourceInput = document.getElementById("source");
  const emptyState = document.getElementById("results-empty");
  const output = document.getElementById("results-output");
  const findingsNode = document.getElementById("findings");
  const confirmedNode = document.getElementById("confirmed-count");
  const reviewNode = document.getElementById("review-count");
  const lineNode = document.getElementById("line-count");
  const resultActions = document.getElementById("result-actions");
  const copyPlanButton = document.getElementById("copy-plan");
  let lastFindings = [];
  const MAX_CONTRACT_CHARS = 12000;
  const MAX_SOURCE_CHARS = 100000;

  const SAMPLE_CONTRACT = `colors = #f2eee5, #18231d, #a95038, #ffffff
fonts = Georgia, Arial
font-sizes = 16px, 24px, 48px
spacing = 8px, 16px, 24px, 48px
radii = 0, 2px, 4px`;

  const SAMPLE_SOURCE = `.hero {
  color: #18231d;
  background: #f2eee5;
  padding: 48px 23px;
  gap: 24px;
}

.hero h1 {
  font-family: Georgia, serif;
  font-size: 52px;
}

.hero .primary-action {
  color: #ffffff;
  background-color: #675ff0;
  border-radius: 999px;
  padding: 15px 24px;
}`;

  const RULE_META = {
    colors: {
      id: "PPG-COLOR-001",
      title: "Colour outside the declared palette",
      repair: "Replace the literal colour with the correct named colour token. Confirm the semantic role before changing it."
    },
    fonts: {
      id: "PPG-TYPE-001",
      title: "Font family outside the declared type system",
      repair: "Use an approved font-family token. Keep an appropriate fallback after the approved family."
    },
    "font-sizes": {
      id: "PPG-TYPE-002",
      title: "Font size outside the declared scale",
      repair: "Map the text role to the closest approved type token. Review hierarchy before rounding the value."
    },
    spacing: {
      id: "PPG-SPACE-001",
      title: "Spacing value outside the declared scale",
      repair: "Replace the raw spacing value with the intended spacing token. Check the surrounding rhythm at each viewport."
    },
    radii: {
      id: "PPG-RADIUS-001",
      title: "Corner radius outside the declared set",
      repair: "Use the radius assigned to this component type. Do not replace every radius without checking component roles."
    }
  };

  function cleanLine(line) {
    return line.trim();
  }

  function normalizeHex(value) {
    const v = value.toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(v)) {
      return "#" + v.slice(1).split("").map(function (c) { return c + c; }).join("");
    }
    if (/^#[0-9a-f]{4}$/.test(v)) {
      return "#" + v.slice(1).split("").map(function (c) { return c + c; }).join("");
    }
    return v.replace(/\s+/g, "");
  }

  function normalizeMeasure(value) {
    const v = value.toLowerCase().replace(/\s+/g, "");
    if (/^-?0+(?:\.0+)?(?:px|rem|em)?$/.test(v)) return "0";
    return v.replace(/^(-?)\./, "$10.");
  }

  function normalizeFont(value) {
    return value.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  }

  function splitContractValues(value) {
    const values = [];
    let current = "";
    let depth = 0;
    let quote = "";
    for (let i = 0; i < value.length; i += 1) {
      const char = value[i];
      if (quote) {
        current += char;
        if (char === quote && value[i - 1] !== "\\") quote = "";
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        current += char;
      } else if (char === "(") {
        depth += 1;
        current += char;
      } else if (char === ")") {
        depth = Math.max(0, depth - 1);
        current += char;
      } else if (char === "," && depth === 0) {
        if (current.trim()) values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) values.push(current.trim());
    return values;
  }

  function parseContract(text) {
    const contract = { colors: [], fonts: [], "font-sizes": [], spacing: [], radii: [] };
    text.split(/\r?\n/).forEach(function (rawLine) {
      const line = cleanLine(rawLine);
      if (!line) return;
      const match = line.match(/^\s*(colors?|fonts?|font-sizes?|type-sizes?|spacing|radii|radius)\s*[:=]\s*(.+)$/i);
      if (!match) return;
      let category = match[1].toLowerCase();
      if (category === "color") category = "colors";
      if (category === "font") category = "fonts";
      if (category === "font-size" || category === "type-size" || category === "type-sizes") category = "font-sizes";
      if (category === "radius") category = "radii";
      contract[category] = contract[category].concat(splitContractValues(match[2]));
    });

    contract.colors = contract.colors.map(normalizeHex);
    contract.fonts = contract.fonts.map(normalizeFont);
    contract["font-sizes"] = contract["font-sizes"].map(normalizeMeasure);
    contract.spacing = contract.spacing.map(normalizeMeasure);
    contract.radii = contract.radii.map(normalizeMeasure);
    return contract;
  }

  function inertSource(text) {
    return text
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, function (block) { return block.replace(/[^\n]/g, " "); })
      .replace(/\/\*[\s\S]*?\*\//g, function (block) { return block.replace(/[^\n]/g, " "); });
  }

  function declarationValues(line, propertyPattern) {
    const values = [];
    const valuePattern = "((?:\\\"[^\\\"\\n]*\\\"|'[^'\\n]*'|[^;}\\\"'\\n])+)";
    const re = new RegExp("(?:^|[;{\\s\\\"])(" + propertyPattern + ")\\s*:\\s*" + valuePattern, "gi");
    let match;
    while ((match = re.exec(line)) !== null) {
      values.push({ property: match[1].toLowerCase(), value: match[2].trim() });
    }
    return values;
  }

  function skipExpression(value) {
    return /\b(?:var|calc|clamp|min|max)\s*\(/i.test(value);
  }

  function addFinding(list, seen, category, status, line, property, found, expected) {
    const meta = RULE_META[category];
    const key = [meta.id, status, line, property, found].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      category: category,
      id: meta.id,
      title: meta.title,
      status: status,
      line: line,
      property: property,
      found: found,
      expected: expected,
      repair: meta.repair
    });
  }

  function compareValue(list, seen, contract, category, lineNumber, property, rawValue, normalized) {
    const allowed = contract[category] || [];
    if (allowed.length === 0) {
      addFinding(list, seen, category, "Review", lineNumber, property, rawValue, "No approved values were supplied for this category.");
      return;
    }
    if (!allowed.includes(normalized)) {
      addFinding(list, seen, category, "Violation", lineNumber, property, rawValue, allowed.join(", "));
    }
  }

  function scan(contract, source) {
    const findings = [];
    const seen = new Set();
    const lines = inertSource(source).split(/\r?\n/);

    lines.forEach(function (line, index) {
      const lineNumber = index + 1;

      declarationValues(line, "color|background|background-color|border(?:-(?:top|right|bottom|left|inline(?:-start|-end)?|block(?:-start|-end)?))?(?:-color)?|outline-color|fill|stroke").forEach(function (decl) {
        if (skipExpression(decl.value)) return;
        const matches = decl.value.match(/#[0-9a-f]{3,8}\b|(?:rgb|hsl)a?\([^)]*\)/gi) || [];
        matches.forEach(function (value) {
          compareValue(findings, seen, contract, "colors", lineNumber, decl.property, value, normalizeHex(value));
        });
      });

      declarationValues(line, "font-family").forEach(function (decl) {
        if (skipExpression(decl.value)) return;
        const firstFamily = decl.value.split(",")[0].trim();
        compareValue(findings, seen, contract, "fonts", lineNumber, decl.property, firstFamily, normalizeFont(firstFamily));
      });

      declarationValues(line, "font-size").forEach(function (decl) {
        if (skipExpression(decl.value)) return;
        const values = decl.value.match(/-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)\b/gi) || [];
        values.forEach(function (value) {
          compareValue(findings, seen, contract, "font-sizes", lineNumber, decl.property, value, normalizeMeasure(value));
        });
      });

      declarationValues(line, "margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|gap|row-gap|column-gap").forEach(function (decl) {
        if (skipExpression(decl.value)) return;
        const values = decl.value.match(/-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)\b|(?:^|\s)0(?=\s|$)/gi) || [];
        values.forEach(function (value) {
          const clean = value.trim();
          compareValue(findings, seen, contract, "spacing", lineNumber, decl.property, clean, normalizeMeasure(clean));
        });
      });

      declarationValues(line, "border-radius|border-(?:top|bottom)-(?:left|right)-radius").forEach(function (decl) {
        if (skipExpression(decl.value)) return;
        const values = decl.value.match(/(?:\d+\.?\d*|\.\d+)(?:px|rem|em)\b|(?:^|\s)0(?=\s|$)/gi) || [];
        values.forEach(function (value) {
          const clean = value.trim();
          compareValue(findings, seen, contract, "radii", lineNumber, decl.property, clean, normalizeMeasure(clean));
        });
      });
    });

    return { findings: findings, lines: lines.length };
  }

  function text(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  }

  function render(result) {
    lastFindings = result.findings;
    findingsNode.replaceChildren();
    const confirmed = result.findings.filter(function (item) { return item.status === "Violation"; }).length;
    const review = result.findings.filter(function (item) { return item.status === "Review"; }).length;
    confirmedNode.textContent = String(confirmed);
    reviewNode.textContent = String(review);
    lineNode.textContent = String(result.lines);
    emptyState.hidden = true;
    output.hidden = false;
    resultActions.hidden = result.findings.length === 0;

    if (result.findings.length === 0) {
      const article = text("article", "finding review", "");
      const header = document.createElement("header");
      header.appendChild(text("h3", "", "No outside literal values were found"));
      header.appendChild(text("span", "status", "Limited result"));
      article.appendChild(header);
      article.appendChild(text("p", "", "This does not prove that the rendered interface follows the contract. It only means these five text checks found no literal value mismatch."));
      findingsNode.appendChild(article);
      return;
    }

    result.findings.forEach(function (item) {
      const article = document.createElement("article");
      article.className = item.status === "Review" ? "finding review" : "finding";
      const header = document.createElement("header");
      header.appendChild(text("h3", "", item.title));
      header.appendChild(text("span", "status", item.status));
      article.appendChild(header);
      article.appendChild(text("p", "", item.id + " · line " + item.line + " · " + item.property));
      article.appendChild(text("code", "", "Found: " + item.found + "\nAllowed: " + item.expected));
      article.appendChild(text("p", "", item.repair));
      findingsNode.appendChild(article);
    });
  }

  function validationMessage(titleText, message) {
    lastFindings = [];
    emptyState.hidden = false;
    output.hidden = true;
    const title = emptyState.querySelector("h2");
    const paragraph = emptyState.querySelector("p:last-child");
    title.textContent = titleText;
    paragraph.textContent = message;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const contractText = contractInput.value.trim();
    const sourceText = sourceInput.value.trim();
    if (!contractText || !sourceText) {
      validationMessage("The check needs both inputs.", "Add approved values and the CSS or HTML text to inspect.");
      return;
    }
    if (contractText.length > MAX_CONTRACT_CHARS || sourceText.length > MAX_SOURCE_CHARS) {
      validationMessage("This check is too large for Guard Lite.", "Use no more than 12,000 contract characters and 100,000 source characters per check.");
      return;
    }
    const contract = parseContract(contractText);
    const suppliedCategories = Object.keys(contract).filter(function (key) { return contract[key].length > 0; });
    if (suppliedCategories.length === 0) {
      validationMessage("The contract format was not recognised.", "Use colors, fonts, font-sizes, spacing and radii as shown in the example.");
      return;
    }
    render(scan(contract, sourceText));
  });

  document.getElementById("load-sample").addEventListener("click", function () {
    contractInput.value = SAMPLE_CONTRACT;
    sourceInput.value = SAMPLE_SOURCE;
    form.requestSubmit();
  });

  document.getElementById("clear-tool").addEventListener("click", function () {
    contractInput.value = "";
    sourceInput.value = "";
    lastFindings = [];
    findingsNode.replaceChildren();
    output.hidden = true;
    emptyState.hidden = false;
    emptyState.querySelector("h2").textContent = "The result will separate contract violations from values that need review.";
    emptyState.querySelector("p:last-child").textContent = "A violation means the relevant category has approved values and Guard found a different literal value. A review means the contract does not contain enough information for a firm decision.";
    contractInput.focus();
  });

  function repairPlan() {
    const lines = [
      "PIXEL PERFECT GUARD LITE REPAIR PLAN",
      "",
      "Read the declared design values before editing. Change only the listed implementation values. Preserve routes, logic, content and accessibility behaviour.",
      ""
    ];
    lastFindings.forEach(function (item, index) {
      lines.push((index + 1) + ". " + item.id + " — " + item.title);
      lines.push("   Status: " + item.status);
      lines.push("   Location: line " + item.line + ", " + item.property);
      lines.push("   Found: " + item.found);
      lines.push("   Allowed: " + item.expected);
      lines.push("   Action: " + item.repair);
      lines.push("");
    });
    lines.push("After editing, rerun the same checks and inspect the rendered interface at its required viewports. Do not report visual completion from source checks alone.");
    return lines.join("\n");
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
    return Promise.resolve();
  }

  copyPlanButton.addEventListener("click", function () {
    copyText(repairPlan()).then(function () {
      copyPlanButton.textContent = "Repair plan copied";
      window.setTimeout(function () { copyPlanButton.textContent = "Copy repair plan"; }, 1800);
    }).catch(function () {
      copyPlanButton.textContent = "Copy failed";
    });
  });
}());
