# SwarmCraft — Production Readiness Mission Brief (v2)

> **Audience**: A fresh AI assistant chat that has imported the `mayakilzy/SwarmCraft` repository (with all 8 fixes from the previous mission already applied). This document covers the **next evolution**: making SwarmCraft production-ready by adding LLM-powered code generation (so it can build ANY app, not just template-matched ones) and professional README generation (replacing the single-line description that GitHub Agent currently produces).

---

## 0. TL;DR — Your Mission

SwarmCraft currently has **8 fixes applied** and works as a **template-based code generator**. It can build 5 app types (Todo, TaskFlow, Counter, Calculator, HabitStreak) perfectly, but **fails for any other app type** because the dispatcher uses simple keyword matching (`lower.includes("streak")`) that misroutes prompts.

You will apply **3 critical fixes** to make SwarmCraft production-ready:

1. **FIX 9 — LLM-Powered Code Generation**: When no template matches, call the LLM via `/api/llm` to generate real Next.js code from the prompt. Validate the output before pushing to GitHub.
2. **FIX 10 — Smart Dispatch Logic**: Rewrite the dispatcher to use multi-keyword scoring (not single keyword matching) so "weekly streak" doesn't trigger the HabitStreak template.
3. **FIX 11 — Professional README Generator**: Replace the 1-line description with a `READMEGenerator` class that produces full professional READMEs (EN + AR) with badges, quick start, features, tech stack, structure tree, usage examples, and screenshots.

**Why this matters for production**: A template-based generator can only build ~5% of possible apps. An LLM-powered generator with template fallback can build 95%+ of apps. And a 1-line README is unprofessional — real projects need real documentation.

---

## 1. Current State — What's Already Done

The previous mission applied 8 fixes. All are working:

| Fix | Status | Verification |
|-----|--------|--------------|
| 1 — Builder shows file paths only | ✅ Working | Confirmed in FocusFlow test |
| 2 — GitHub Agent honest error handling | ✅ Working | 422 + 200 responses logged |
| 3 — A2A role-specific acceptance | ✅ Working | `[architect] ACCEPTING with notes...` |
| 4 — HabitStreak generator | ✅ Working | 10 files generated |
| 5 — React 19 lazy useState | ✅ Working | No lint warnings |
| 6 — TypeScript results array typing | ✅ Working | `tsc` passes |
| 8 — Permanent workspace (`/home/z/swarmcraft/` + `/home/z/APP/`) | ✅ Working | Files persist |

**The remaining gap**: When the FocusFlow prompt was tested, SwarmCraft misrouted it to the HabitStreak template (because both contain "streak"). This means:
- The generated app was HabitStreak, not FocusFlow
- No `focusflow-app` repo was created
- 0/8 FocusFlow features were implemented

---

## 2. The 3 Fixes — Overview

| # | Fix | Files | Severity |
|---|-----|-------|----------|
| 9 | LLM-Powered Code Generation | `code-generator.ts` + `app/api/llm/route.ts` + new `llm-code-generator.ts` | **Critical — Production** |
| 10 | Smart Dispatch Logic (multi-keyword scoring) | `code-generator.ts` | **Critical — Correctness** |
| 11 | Professional README Generator | new `readme-generator.ts` + `code-generator.ts` | **High — Professionalism** |

---

## 3. FIX 9 — LLM-Powered Code Generation

### Problem
`code-generator.ts` has 5 hardcoded templates (Todo, TaskFlow, Counter, Calculator, HabitStreak) + a generic fallback. When a prompt doesn't match any template, it falls back to `generateGenericApp()` which produces a minimal "Hello World" page — not a real app.

### Solution: 3-Layer Generation Architecture

```
User Prompt
    │
    ▼
[Layer 1: Template Matcher] ──match?──► Use template (fast, reliable)
    │ no match
    ▼
[Layer 2: LLM Generator] ──success?──► Use LLM output (flexible, handles any app)
    │ failure or invalid
    ▼
[Layer 3: Generic Fallback] ──always──► Minimal app (safe default)
```

### Step 1: Create the LLM Code Generator

**New file**: `/home/z/swarmcraft/src/swarm-engine/llm-code-generator.ts`

This file calls the LLM API to generate real Next.js code from a prompt. It includes:
- A system prompt that instructs the LLM to output structured JSON (file paths + contents)
- A validation step that checks the LLM output for required files
- A fallback that returns the generic app if LLM output is invalid

```typescript
// ============================================================
// LLM-Powered Code Generator — generates real Next.js code from any prompt
// Uses /api/llm (GLM-4.5 via z-ai-web-dev-sdk) with a structured output prompt.
// Falls back to generic template if LLM fails or output is invalid.
// ============================================================
import type { GeneratedFile, GeneratedProject } from "./code-generator";

const LLM_SYSTEM_PROMPT = `You are a Next.js code generator. Given a product description, you MUST output a valid JSON object with this exact schema:

{
  "projectName": "string — human-readable app name",
  "repoName": "string — lowercase-hyphenated, ends with -app (e.g., focusflow-app)",
  "description": "string — 1-2 sentence description",
  "files": [
    {
      "path": "string — relative path (e.g., src/app/page.tsx)",
      "content": "string — full file content",
      "message": "string — git commit message (e.g., feat: add page.tsx)"
    }
  ]
}

MANDATORY REQUIREMENTS:
1. Always include these 10 files:
   - package.json (with next, react, react-dom, typescript, tailwindcss, autoprefixer, postcss)
   - tsconfig.json (standard Next.js config)
   - next.config.ts
   - tailwind.config.ts (with darkMode: "class")
   - postcss.config.mjs
   - src/app/globals.css (Tailwind directives + dark mode base)
   - src/app/layout.tsx (RootLayout with metadata)
   - src/app/page.tsx ("use client" with full app logic — MUST be a complete working app, not a stub)
   - README.md (professional — see template below)
   - README.ar.md (Arabic version with RTL)

2. The src/app/page.tsx MUST:
   - Start with "use client"
   - Use React 19 lazy useState pattern for localStorage (NOT useEffect+setState)
   - Be a COMPLETE working app (not a stub or placeholder)
   - Use Tailwind CSS classes for styling
   - Include all features mentioned in the product description

3. The package.json MUST include any extra dependencies the app needs (e.g., lucide-react, date-fns, @dnd-kit/core).

4. The README.md MUST follow this structure:
   - H1 title + badges (Next.js, TypeScript, Tailwind, License)
   - One-paragraph description
   - ## Features (bullet list with emojis)
   - ## Quick Start (clone, install, dev — with code blocks)
   - ## Tech Stack (table)
   - ## Project Structure (tree)
   - ## Usage (examples with code blocks)
   - ## Configuration (env vars if any)
   - ## Roadmap (v2 features)
   - ## Contributing
   - ## License (MIT)

5. Output ONLY the JSON object — no markdown fences, no explanation, no text before or after.

6. The JSON must be valid (no trailing commas, no comments, proper escaping of newlines as \\n inside strings).`;

/**
 * Generate a project using the LLM.
 * Returns null if LLM fails or output is invalid (caller should fall back to generic).
 */
export async function generateProjectWithLLM(prompt: string): Promise<GeneratedProject | null> {
  try {
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "builder",
        systemPrompt: LLM_SYSTEM_PROMPT,
        userPrompt: `Product description:\n\n${prompt}\n\nGenerate the complete Next.js project as JSON.`,
        provider: "zai",
        model: "glm-4.5",
        temperature: 0.2,
        maxTokens: 8000,
      }),
    });

    if (!res.ok) {
      console.error("[llm-code-generator] /api/llm returned", res.status);
      return null;
    }

    const data = await res.json();
    const text = data.text || "";

    if (!text || text.length < 500) {
      console.error("[llm-code-generator] LLM response too short:", text.length, "chars");
      return null;
    }

    // Try to parse the JSON output
    const project = parseLLMOutput(text);
    if (!project) {
      console.error("[llm-code-generator] Failed to parse LLM output as JSON");
      return null;
    }

    // Validate required files
    const validation = validateProject(project);
    if (!validation.valid) {
      console.error("[llm-code-generator] Project validation failed:", validation.errors);
      return null;
    }

    console.log("[llm-code-generator] LLM generated project:", project.repoName, "with", project.files.length, "files");
    return project;
  } catch (e) {
    console.error("[llm-code-generator] Error:", (e as Error).message);
    return null;
  }
}

/**
 * Parse the LLM's text output into a GeneratedProject.
 * Handles common issues: markdown fences, extra text before/after JSON.
 */
function parseLLMOutput(text: string): GeneratedProject | null {
  let cleaned = text.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Find the first { and last } to extract just the JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.projectName || !parsed.repoName || !Array.isArray(parsed.files)) {
      return null;
    }
    return {
      projectName: String(parsed.projectName),
      repoName: String(parsed.repoName).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
      description: String(parsed.description || ""),
      files: parsed.files.map((f: any) => ({
        path: String(f.path),
        content: String(f.content),
        message: String(f.message || `feat: add ${f.path}`),
      })),
    };
  } catch (e) {
    console.error("[llm-code-generator] JSON.parse failed:", (e as Error).message);
    return null;
  }
}

/**
 * Validate that the project has all required files.
 */
function validateProject(project: GeneratedProject): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requiredPaths = [
    "package.json",
    "tsconfig.json",
    "next.config.ts",
    "tailwind.config.ts",
    "postcss.config.mjs",
    "src/app/globals.css",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "README.md",
    "README.ar.md",
  ];

  const filePaths = new Set(project.files.map((f) => f.path));
  for (const required of requiredPaths) {
    if (!filePaths.has(required)) {
      errors.push(`Missing required file: ${required}`);
    }
  }

  // Validate page.tsx is not empty
  const pageFile = project.files.find((f) => f.path === "src/app/page.tsx");
  if (pageFile && pageFile.content.length < 500) {
    errors.push("src/app/page.tsx is too short (likely a stub) — must be a complete app");
  }

  // Validate page.tsx starts with "use client"
  if (pageFile && !pageFile.content.trim().startsWith('"use client"')) {
    errors.push('src/app/page.tsx must start with "use client"');
  }

  // Validate package.json has required deps
  const pkgFile = project.files.find((f) => f.path === "package.json");
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      if (!pkg.dependencies?.next || !pkg.dependencies?.react) {
        errors.push("package.json missing required dependencies (next, react)");
      }
    } catch {
      errors.push("package.json is not valid JSON");
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Step 2: Update `generateProject` to use the 3-layer architecture

**File**: `/home/z/swarmcraft/src/swarm-engine/code-generator.ts`

The current `generateProject` is synchronous. We need to make it async to call the LLM. **However**, this breaks the existing API. To minimize disruption, we'll add a new `generateProjectAsync` function and update callers.

Find the `generateProject` function:
```typescript
export function generateProject(prompt: string): GeneratedProject {
  const lower = prompt.toLowerCase();
  
  if (lower.includes("habit") || lower.includes("streak")) {
    return generateHabitStreakApp(prompt);
  } else if (...) {
    // ... existing dispatch
  }
}
```

Replace the entire `generateProject` function with:
```typescript
/**
 * Synchronous template-based generation (kept for backward compatibility).
 * Use generateProjectAsync for LLM-powered generation.
 */
export function generateProject(prompt: string): GeneratedProject {
  const lower = prompt.toLowerCase();
  
  // Layer 1: Template matching (FIX 10 — smart scoring)
  const match = matchTemplate(lower);
  if (match) return match;

  // Layer 3: Generic fallback (no LLM in sync mode)
  return generateGenericApp(prompt);
}

/**
 * Async generation with LLM fallback (FIX 9).
 * Layer 1: Template → Layer 2: LLM → Layer 3: Generic fallback.
 */
export async function generateProjectAsync(prompt: string): Promise<GeneratedProject> {
  const lower = prompt.toLowerCase();

  // Layer 1: Template matching (FIX 10)
  const templateMatch = matchTemplate(lower);
  if (templateMatch) {
    console.log("[code-generator] Layer 1: Template matched");
    return templateMatch;
  }

  // Layer 2: LLM generation (FIX 9)
  console.log("[code-generator] Layer 2: Trying LLM generation...");
  const { generateProjectWithLLM } = await import("./llm-code-generator");
  const llmProject = await generateProjectWithLLM(prompt);
  if (llmProject) {
    console.log("[code-generator] Layer 2: LLM generation succeeded");
    return llmProject;
  }

  // Layer 3: Generic fallback
  console.log("[code-generator] Layer 3: Using generic fallback");
  return generateGenericApp(prompt);
}
```

### Step 3: Update `generateAndPushProject` to use async generation

**File**: `/home/z/swarmcraft/src/swarm-engine/github-agent.ts`

Find in the `generateAndPushProject` handler:
```typescript
// Step 1: Generate the project code
const project = generateProject(prompt);
```

Replace with:
```typescript
// Step 1: Generate the project code (FIX 9: async with LLM fallback)
let project;
try {
  const { generateProjectAsync } = await import("./code-generator");
  project = await generateProjectAsync(prompt);
} catch (e) {
  console.error("[github-agent] Async generation failed, using sync fallback:", (e as Error).message);
  const { generateProject } = await import("./code-generator");
  project = generateProject(prompt);
}
```

---

## 4. FIX 10 — Smart Dispatch Logic

### Problem
The current dispatcher uses simple `lower.includes("streak")` which matches both "habit streak" (HabitStreak template) and "weekly streak" (FocusFlow — should NOT match HabitStreak). This causes misrouting.

### Solution: Multi-Keyword Scoring

Instead of single keyword matching, use a **scoring system** where each template accumulates points based on how many of its characteristic keywords appear in the prompt.

### Implementation

**File**: `/home/z/swarmcraft/src/swarm-engine/code-generator.ts`

Add this function (place it near the top, after the imports and before `generateProject`):

```typescript
// ============================================================
// FIX 10 — Smart Dispatch Logic (multi-keyword scoring)
// Each template has a set of characteristic keywords with weights.
// The template with the highest score (above a threshold) wins.
// This prevents "weekly streak" from matching the HabitStreak template.
// ============================================================

interface TemplateSpec {
  name: string;
  generator: (prompt: string) => GeneratedProject;
  keywords: { word: string; weight: number }[];
}

const TEMPLATES: TemplateSpec[] = [
  {
    name: "habitstreak",
    generator: (p) => generateHabitStreakApp(p),
    keywords: [
      { word: "habit", weight: 5 },
      { word: "check-in", weight: 3 },
      { word: "checkin", weight: 3 },
      { word: "streak", weight: 2 },  // lower weight — "streak" alone isn't enough
      { word: "mindfulness", weight: 2 },
      { word: "daily habit", weight: 5 },
    ],
  },
  {
    name: "taskflow",
    generator: (p) => generateTaskFlowApp(p),
    keywords: [
      { word: "taskflow", weight: 10 },
      { word: "priority", weight: 4 },
      { word: "task", weight: 3 },
      { word: "todo", weight: 3 },
      { word: "high priority", weight: 4 },
      { word: "medium priority", weight: 4 },
      { word: "filter by priority", weight: 5 },
    ],
  },
  {
    name: "todo",
    generator: (p) => generateTodoApp(p),
    keywords: [
      { word: "todo", weight: 5 },
      { word: "to-do", weight: 5 },
      { word: "task list", weight: 3 },
      { word: "add task", weight: 3 },
      { word: "mark complete", weight: 3 },
      { word: "filter", weight: 1 },
    ],
  },
  {
    name: "counter",
    generator: (p) => generateCounterApp(p),
    keywords: [
      { word: "counter", weight: 8 },
      { word: "increment", weight: 5 },
      { word: "decrement", weight: 5 },
      { word: "count", weight: 3 },
    ],
  },
  {
    name: "calculator",
    generator: (p) => generateCalculatorApp(p),
    keywords: [
      { word: "calculator", weight: 10 },
      { word: "arithmetic", weight: 5 },
      { word: "addition", weight: 3 },
      { word: "subtraction", weight: 3 },
      { word: "multiplication", weight: 3 },
      { word: "division", weight: 3 },
    ],
  },
];

const MATCH_THRESHOLD = 6;  // Template must score ≥6 to win

/**
 * Score each template against the prompt. Return the best match or null.
 */
function matchTemplate(lowerPrompt: string): GeneratedProject | null {
  let bestMatch: { name: string; score: number; generator: (p: string) => GeneratedProject } | null = null;

  for (const template of TEMPLATES) {
    let score = 0;
    for (const { word, weight } of template.keywords) {
      if (lowerPrompt.includes(word)) {
        score += weight;
      }
    }
    if (score >= MATCH_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { name: template.name, score, generator: template.generator };
    }
  }

  if (bestMatch) {
    console.log(`[code-generator] Template matched: ${bestMatch.name} (score: ${bestMatch.score})`);
    return bestMatch.generator(lowerPrompt);
  }

  console.log("[code-generator] No template matched (score below threshold)");
  return null;
}
```

### How This Fixes the FocusFlow Problem

**FocusFlow prompt** contains: `"weekly streak"`, `"planner"`, `"time-blocking"`, `"drag"`, `"dnd"`, `"focus score"`, `"categories"`.

With the new scoring:
- **habitstreak template**: `"streak"` → 2 points. Total: 2. **Below threshold (6)** — no match.
- **taskflow template**: `"task"` → 3 points (FocusFlow mentions "tasks"). Total: 3. **Below threshold** — no match.
- **todo template**: no matches. Total: 0.
- **counter template**: no matches. Total: 0.
- **calculator template**: no matches. Total: 0.

**Result**: No template matches → falls through to Layer 2 (LLM generation) → LLM generates a real FocusFlow app.

**HabitStreak prompt** contains: `"habit"`, `"daily check-in"`, `"streak"`, `"mindfulness"`.

With the new scoring:
- **habitstreak template**: `"habit"` → 5 + `"check-in"` → 3 + `"streak"` → 2 + `"mindfulness"` → 2 = 12. **Above threshold** — match!

**Result**: HabitStreak template is correctly used.

---

## 5. FIX 11 — Professional README Generator

### Problem
The current README is a 1-line description:
```markdown
# HabitStreak

A habit tracking app with daily check-ins, streak counters, monthly calendar heatmap...
```

This is unprofessional. Production apps need:
- Badges (build status, license, tech stack)
- Features list with emojis
- Quick Start with code blocks
- Tech Stack table
- Project Structure tree
- Usage examples
- Configuration section
- Roadmap
- Contributing + License

### Solution: `READMEGenerator` class

**New file**: `/home/z/swarmcraft/src/swarm-engine/readme-generator.ts`

```typescript
// ============================================================
// Professional README Generator — produces full README.md + README.ar.md
// Replaces the 1-line description with a comprehensive document.
// ============================================================

export interface ReadmeConfig {
  projectName: string;
  repoName: string;
  description: string;
  features: string[];           // e.g., ["Add daily habits", "Streak counter"]
  techStack: { name: string; version: string; purpose: string }[];
  usageExamples?: { title: string; code: string; language: string }[];
  envVars?: { name: string; description: string; required: boolean }[];
  roadmap?: string[];
  projectStructure?: string;     // ASCII tree
  screenshots?: string[];        // paths to screenshots
}

export function generateProfessionalReadme(config: ReadmeConfig): string {
  const {
    projectName, repoName, description, features, techStack,
    usageExamples, envVars, roadmap, projectStructure, screenshots,
  } = config;

  const owner = "mayakilzy";
  const repoUrl = `https://github.com/${owner}/${repoName}`;

  let readme = `# ${projectName}\n\n`;

  // Badges
  readme += `![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)\n`;
  readme += `![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)\n`;
  readme += `![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square&logo=tailwindcss)\n`;
  readme += `![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)\n`;
  readme += `![Generated by SwarmCraft](https://img.shields.io/badge/Generated%20by-SwarmCraft-FF6B35?style=flat-square)\n\n`;

  // Description
  readme += `> ${description}\n\n`;

  // Screenshots (if provided)
  if (screenshots && screenshots.length > 0) {
    readme += `## Screenshots\n\n`;
    for (const shot of screenshots) {
      readme += `![${shot}](./screenshots/${shot})\n\n`;
    }
  }

  // Features
  readme += `## Features\n\n`;
  for (const feature of features) {
    readme += `- ${feature}\n`;
  }
  readme += `\n`;

  // Quick Start
  readme += `## Quick Start\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `# Clone the repository\n`;
  readme += `git clone ${repoUrl}.git\n`;
  readme += `cd ${repoName}\n\n`;
  readme += `# Install dependencies\n`;
  readme += `npm install\n\n`;
  readme += `# Start the development server\n`;
  readme += `npm run dev\n\n`;
  readme += `# Open http://localhost:3000 in your browser\n`;
  readme += `\`\`\`\n\n`;

  // Tech Stack
  readme += `## Tech Stack\n\n`;
  readme += `| Technology | Version | Purpose |\n`;
  readme += `|------------|---------|----------|\n`;
  for (const tech of techStack) {
    readme += `| ${tech.name} | ${tech.version} | ${tech.purpose} |\n`;
  }
  readme += `\n`;

  // Project Structure
  if (projectStructure) {
    readme += `## Project Structure\n\n`;
    readme += `\`\`\`\n${projectStructure}\n\`\`\`\n\n`;
  } else {
    readme += `## Project Structure\n\n`;
    readme += `\`\`\`\n`;
    readme += `${repoName}/\n`;
    readme += `├── src/\n`;
    readme += `│   └── app/\n`;
    readme += `│       ├── globals.css      # Tailwind directives + global styles\n`;
    readme += `│       ├── layout.tsx       # Root layout with metadata\n`;
    readme += `│       └── page.tsx         # Main application component\n`;
    readme += `├── package.json\n`;
    readme += `├── tsconfig.json\n`;
    readme += `├── next.config.ts\n`;
    readme += `├── tailwind.config.ts\n`;
    readme += `├── postcss.config.mjs\n`;
    readme += `└── README.md\n`;
    readme += `\`\`\`\n\n`;
  }

  // Usage
  if (usageExamples && usageExamples.length > 0) {
    readme += `## Usage\n\n`;
    for (const example of usageExamples) {
      readme += `### ${example.title}\n\n`;
      readme += `\`\`\`${example.language}\n${example.code}\n\`\`\`\n\n`;
    }
  } else {
    readme += `## Usage\n\n`;
    readme += `1. Start the dev server with \`npm run dev\`\n`;
    readme += `2. Open [\`http://localhost:3000\`](http://localhost:3000)\n`;
    readme += `3. All data is stored locally in your browser (localStorage)\n`;
    readme += `4. No backend or database required\n\n`;
  }

  // Configuration
  if (envVars && envVars.length > 0) {
    readme += `## Configuration\n\n`;
    readme += `| Variable | Description | Required |\n`;
    readme += `|----------|-------------|----------|\n`;
    for (const env of envVars) {
      readme += `| \`${env.name}\` | ${env.description} | ${env.required ? "Yes" : "No"} |\n`;
    }
    readme += `\n`;
    readme += `Create a \`.env.local\` file in the project root:\n\n`;
    readme += `\`\`\`bash\n`;
    for (const env of envVars) {
      readme += `${env.name}=\n`;
    }
    readme += `\`\`\`\n\n`;
  } else {
    readme += `## Configuration\n\n`;
    readme += `No environment variables required. All data persists in the browser via \`localStorage\`.\n\n`;
  }

  // Roadmap
  if (roadmap && roadmap.length > 0) {
    readme += `## Roadmap\n\n`;
    for (let i = 0; i < roadmap.length; i++) {
      readme += `${i + 1}. ${roadmap[i]}\n`;
    }
    readme += `\n`;
  }

  // Build for Production
  readme += `## Build for Production\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `# Create an optimized production build\n`;
  readme += `npm run build\n\n`;
  readme += `# Start the production server\n`;
  readme += `npm start\n`;
  readme += `\`\`\`\n\n`;

  // Contributing
  readme += `## Contributing\n\n`;
  readme += `1. Fork the repository\n`;
  readme += `2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)\n`;
  readme += `3. Commit your changes (\`git commit -m 'Add amazing feature'\`)\n`;
  readme += `4. Push to the branch (\`git push origin feature/amazing-feature\`)\n`;
  readme += `5. Open a Pull Request\n\n`;

  // License
  readme += `## License\n\n`;
  readme += `This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.\n\n`;

  // Footer
  readme += `---\n\n`;
  readme += `Generated with ❤️ by [SwarmCraft](https://github.com/${owner}/SwarmCraft) — an AI Product War Room that turns ideas into build-ready repos.\n`;

  return readme;
}

export function generateProfessionalArabicReadme(config: ReadmeConfig): string {
  const {
    projectName, repoName, description, features, techStack,
    usageExamples, envVars, roadmap, projectStructure,
  } = config;

  const owner = "mayakilzy";
  const repoUrl = `https://github.com/${owner}/${repoName}`;

  let readme = `<div dir="rtl" align="center">\n\n`;
  readme += `# ${projectName}\n\n`;
  readme += `![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)\n`;
  readme += `![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)\n`;
  readme += `![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square&logo=tailwindcss)\n`;
  readme += `![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)\n\n`;
  readme += `</div>\n\n`;

  readme += `> ${description}\n\n`;

  readme += `## المميزات\n\n`;
  for (const feature of features) {
    readme += `- ${feature}\n`;
  }
  readme += `\n`;

  readme += `## البدء السريع\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `# استنساخ المستودع\n`;
  readme += `git clone ${repoUrl}.git\n`;
  readme += `cd ${repoName}\n\n`;
  readme += `# تثبيت التبعيات\n`;
  readme += `npm install\n\n`;
  readme += `# تشغيل خادم التطوير\n`;
  readme += `npm run dev\n\n`;
  readme += `# افتح http://localhost:3000 في المتصفح\n`;
  readme += `\`\`\`\n\n`;

  readme += `## التقنيات المستخدمة\n\n`;
  readme += `| التقنية | الإصدار | الاستخدام |\n`;
  readme += `|---------|---------|----------|\n`;
  for (const tech of techStack) {
    readme += `| ${tech.name} | ${tech.version} | ${tech.purpose} |\n`;
  }
  readme += `\n`;

  readme += `## هيكل المشروع\n\n`;
  readme += `\`\`\`\n`;
  readme += `${repoName}/\n`;
  readme += `├── src/\n`;
  readme += `│   └── app/\n`;
  readme += `│       ├── globals.css      # أنماط Tailwind + الأنماط العامة\n`;
  readme += `│       ├── layout.tsx       # التخطيط الجذري مع البيانات الوصفية\n`;
  readme += `│       └── page.tsx         # المكوّن الرئيسي للتطبيق\n`;
  readme += `├── package.json\n`;
  readme += `├── tsconfig.json\n`;
  readme += `├── next.config.ts\n`;
  readme += `├── tailwind.config.ts\n`;
  readme += `└── README.md\n`;
  readme += `\`\`\`\n\n`;

  readme += `## الاستخدام\n\n`;
  readme += `1. شغّل خادم التطوير بـ \`npm run dev\`\n`;
  readme += `2. افتح [\`http://localhost:3000\`](http://localhost:3000)\n`;
  readme += `3. جميع البيانات تُحفظ محلياً في المتصفح (localStorage)\n`;
  readme += `4. لا حاجة لخادم خلفي أو قاعدة بيانات\n\n`;

  if (roadmap && roadmap.length > 0) {
    readme += `## خارطة الطريق\n\n`;
    for (let i = 0; i < roadmap.length; i++) {
      readme += `${i + 1}. ${roadmap[i]}\n`;
    }
    readme += `\n`;
  }

  readme += `## بناء الإنتاج\n\n`;
  readme += `\`\`\`bash\n`;
  readme += `# إنشاء نسخة إنتاجية محسّنة\n`;
  readme += `npm run build\n\n`;
  readme += `# تشغيل خادم الإنتاج\n`;
  readme += `npm start\n`;
  readme += `\`\`\`\n\n`;

  readme += `## المساهمة\n\n`;
  readme += `1. انسخ المستودع (Fork)\n`;
  readme += `2. أنشئ فرع الميزة (\`git checkout -b feature/amazing-feature\`)\n`;
  readme += `3. التزم بالتغييرات (\`git commit -m 'Add amazing feature'\`)\n`;
  readme += `4. ادفع الفرع (\`git push origin feature/amazing-feature\`)\n`;
  readme += `5. افتح طلب دمج (Pull Request)\n\n`;

  readme += `## الترخيص\n\n`;
  readme += `هذا المشروع مرخّص تحت رخصة MIT — راجع ملف [LICENSE](LICENSE) للتفاصيل.\n\n`;

  readme += `---\n\n`;
  readme += `<div dir="rtl">\n\n`;
  readme += `مولّد بـ ❤️ بواسطة [SwarmCraft](https://github.com/${owner}/SwarmCraft) — غرفة عمليات منتج ذكاء اصطناعي تحوّل الأفكار إلى مستودعات جاهزة للبناء.\n`;
  readme += `</div>\n`;

  return readme;
}
```

### Step 2: Update all template generators to use professional READMEs

**File**: `/home/z/swarmcraft/src/swarm-engine/code-generator.ts`

Each template generator currently calls:
```typescript
{ path: "README.md", message: "docs: add README.md", content: generateReadme(projectName, description, repoName) },
{ path: "README.ar.md", message: "docs: add README.ar.md (Arabic)", content: generateArReadme(projectName, description, repoName) },
```

Replace with calls to the professional README generator. At the top of `code-generator.ts`, add:
```typescript
import { generateProfessionalReadme, generateProfessionalArabicReadme, type ReadmeConfig } from "./readme-generator";
```

Then for each template (Todo, TaskFlow, Counter, Calculator, HabitStreak), replace the README file entries.

**For HabitStreak** (find `generateHabitStreakApp`):
```typescript
// Replace the README file entries with:
{ path: "README.md", message: "docs: add professional README.md", content: generateProfessionalReadme({
  projectName: "HabitStreak",
  repoName: "habitstreak-app",
  description: "A habit tracking app with daily check-ins, streak counters, monthly calendar heatmap, stats dashboard, light/dark mode toggle, and localStorage persistence. Categories: Health, Productivity, Mindfulness, Social.",
  features: [
    "📅 Add daily habits with custom icons, colors, and categories (Health, Productivity, Mindfulness, Social)",
    "✅ One-tap daily check-in to mark habits complete",
    "🔥 Streak counter (current streak + longest streak) per habit",
    "🗓️ 30-day calendar heatmap showing completion history",
    "📊 Stats dashboard: active habits, done today, 7-day rate, best category",
    "🌓 Light/dark mode toggle with no-flash theme script",
    "💾 All data persists in localStorage (no backend required)",
    "🎯 8 preset habits for quick onboarding",
    "📱 Mobile-first responsive design",
    "🚀 Empty state with onboarding for first-time users",
  ],
  techStack: [
    { name: "Next.js", version: "16", purpose: "App Router with Server Components" },
    { name: "React", version: "19", purpose: "UI library with lazy useState pattern" },
    { name: "TypeScript", version: "5", purpose: "Type safety for habit models" },
    { name: "Tailwind CSS", version: "3", purpose: "Utility-first styling with dark mode" },
    { name: "lucide-react", version: "0.460", purpose: "Icon library (Flame, Check, Calendar, etc.)" },
    { name: "date-fns", version: "4.1", purpose: "Date manipulation for streaks and heatmap" },
  ],
  roadmap: [
    "Cloud sync via Supabase for cross-device access",
    "Recurring habits (daily, weekly, custom)",
    "Habit categories customization (add your own)",
    "Notifications and reminders via Web Push API",
    "Social sharing of streaks",
    "AI-powered habit suggestions based on your routine",
  ],
}) },
{ path: "README.ar.md", message: "docs: add professional Arabic README", content: generateProfessionalArabicReadme({
  projectName: "HabitStreak",
  repoName: "habitstreak-app",
  description: "تطبيق تتبع العادات مع تسجيل دخول يومي، عدّادات السلاسل، خريطة حرارية شهرية، لوحة إحصائيات، تبديل الوضع الفاتح/الداكن، وحفظ البيانات محلياً. الفئات: صحة، إنتاجية، تأمل، اجتماعي.",
  features: [
    "📅 إضافة عادات يومية مع أيقونات وألوان وفئات مخصصة (صحة، إنتاجية، تأمل، اجتماعي)",
    "✅ تسجيل دخول يومي بنقرة واحدة لتحديد العادة كمكتملة",
    "🔥 عدّاد السلسلة (السلسلة الحالية + أطول سلسلة) لكل عادة",
    "🗓️ خريطة حرارية لآخر 30 يوماً تعرض سجل الإكمال",
    "📊 لوحة إحصائيات: العادات النشطة، المكتملة اليوم، معدل 7 أيام، أفضل فئة",
    "🌓 تبديل الوضع الفاتح/الداكن مع سكريبت منع الوميض",
    "💾 جميع البيانات تُحفظ محلياً (localStorage) — لا حاجة لخادم",
    "🎯 8 عادات جاهزة للبدء السريع",
    "📱 تصميم متجاوب يبدأ من الجوال",
    "🚀 حالة فارغة مع إرشاد للمستخدمين الجدد",
  ],
  techStack: [
    { name: "Next.js", version: "16", purpose: "موجّه التطبيقات مع مكوّنات الخادم" },
    { name: "React", version: "19", purpose: "مكتبة الواجهة مع نمط useState الكسول" },
    { name: "TypeScript", version: "5", purpose: "أمان الأنواع لنماذج العادات" },
    { name: "Tailwind CSS", version: "3", purpose: "تنسيق بأسلوب utility مع وضع داكن" },
    { name: "lucide-react", version: "0.460", purpose: "مكتبة الأيقونات" },
    { name: "date-fns", version: "4.1", purpose: "معالجة التواريخ للسلاسل والخريطة الحرارية" },
  ],
  roadmap: [
    "مزامنة سحابية عبر Supabase للوصول من أجهزة متعددة",
    "عادات متكررة (يومية، أسبوعية، مخصصة)",
    "تخصيص فئات العادات (أضف فئاتك الخاصة)",
    "إشعارات وتذكيرات عبر Web Push API",
    "مشاركة السلاسل اجتماعياً",
    "اقتراحات عادات ذكية مدعومة بالذكاء الاصطناعي",
  ],
}) },
```

**Repeat for the other 4 templates** (Todo, TaskFlow, Counter, Calculator) with their respective features/techStack/roadmap. Use the same pattern — replace the `generateReadme(...)` and `generateArReadme(...)` calls with `generateProfessionalReadme({...})` and `generateProfessionalArabicReadme({...})`.

### Step 3: Update the generic fallback to use professional README

**File**: `/home/z/swarmcraft/src/swarm-engine/code-generator.ts`

Find `generateGenericApp` and replace its README entries with:
```typescript
{ path: "README.md", message: "docs: add professional README.md", content: generateProfessionalReadme({
  projectName: projectName,
  repoName: repoName,
  description: description,
  features: [
    "🚀 Next.js 16 App Router",
    "💻 TypeScript 5 for type safety",
    "🎨 Tailwind CSS 3 with dark mode",
    "💾 localStorage persistence",
    "📱 Responsive design",
  ],
  techStack: [
    { name: "Next.js", version: "16", purpose: "App Router" },
    { name: "React", version: "19", purpose: "UI library" },
    { name: "TypeScript", version: "5", purpose: "Type safety" },
    { name: "Tailwind CSS", version: "3", purpose: "Styling" },
  ],
  roadmap: [
    "Add custom features based on your prompt",
    "Implement persistence layer",
    "Add tests",
  ],
}) },
```

### Step 4: Update the LLM code generator to use professional READMEs

**File**: `/home/z/swarmcraft/src/swarm-engine/llm-code-generator.ts`

In the `LLM_SYSTEM_PROMPT`, the README section should be updated. Find:
```
4. The README.md MUST follow this structure:
```

And append after the README structure section:
```
IMPORTANT: The README.md must be a PROFESSIONAL document, not a 1-line description. It must include:
- H1 title + badges (use shields.io URLs for Next.js, TypeScript, Tailwind, License, SwarmCraft)
- One-paragraph description (the project description, NOT just the title)
- ## Features section with bullet points and emojis
- ## Quick Start with bash code blocks (clone, install, dev)
- ## Tech Stack as a markdown table
- ## Project Structure as an ASCII tree
- ## Usage with examples
- ## Configuration section (or "No environment variables required")
- ## Roadmap with v2 features
- ## Build for Production section
- ## Contributing section
- ## License (MIT)
- Footer: "Generated with ❤️ by SwarmCraft"
```

---

## 6. Verification — Test Plan

### Test 1: FocusFlow (the prompt that failed before)

Run this exact prompt in SwarmCraft:

```
Build a productivity dashboard app called "FocusFlow" with these features:
- A weekly planner view showing tasks grouped by day (Mon-Sun)
- Add tasks with: title, estimated duration (15/30/60/90 min), 
  category (Deep Work, Meetings, Learning, Break, Personal)
- Time-blocking: drag tasks onto a timeline (8:00 AM - 8:00 PM)
- Daily focus score: percentage of planned tasks completed
- Weekly streak: count of days where completion rate ≥ 80%
- Categories have distinct colors and icons
- All data persists in localStorage (no backend)
- Dark mode by default with light mode toggle

Tech stack: Next.js 16 App Router, TypeScript, Tailwind CSS, 
lucide-react for icons, date-fns for date handling, 
@dnd-kit/core for drag-and-drop.
```

**Expected behavior with fixes applied:**
1. ✅ FIX 10: No template matches (score below threshold) — falls through to LLM
2. ✅ FIX 9: LLM generates a real FocusFlow app with DnD, timeline, weekly planner
3. ✅ FIX 11: README.md is a professional document (not 1-line)
4. ✅ `/home/z/APP/focusflow-app/` created with 10+ files
5. ✅ `github.com/mayakilzy/focusflow-app` created
6. ✅ App runs locally with all FocusFlow features

### Test 2: HabitStreak (regression test)

Run the original HabitStreak prompt. Verify it still works:
1. ✅ FIX 10: habitstreak template matches (score ≥ 6)
2. ✅ No LLM call (template is faster)
3. ✅ Professional README generated
4. ✅ `/home/z/APP/habitstreak-app/` created (files overwritten)

### Test 3: README Quality Check

After generating any app, verify the README.md has:
- [ ] Badges (5 shields.io badges)
- [ ] Description paragraph
- [ ] Features list with emojis (≥ 8 features)
- [ ] Quick Start with bash code block
- [ ] Tech Stack table (≥ 4 rows)
- [ ] Project Structure tree
- [ ] Usage section
- [ ] Configuration section
- [ ] Roadmap (≥ 3 items)
- [ ] Build for Production section
- [ ] Contributing section
- [ ] License section
- [ ] Footer with SwarmCraft attribution

### Build Verification

```bash
cd /home/z/swarmcraft

# TypeScript check
npx tsc --noEmit
# Expected: 0 new errors (the pre-existing z-ai-web-dev-sdk error is OK)

# Next.js build
npx next build
# Expected: ✓ Compiled successfully

# Run SwarmCraft
npx next dev
# Expected: http://localhost:3000 loads
```

### Generated App Verification

After FocusFlow test:
```bash
# Check local files
ls /home/z/APP/focusflow-app/
# Expected: package.json, tsconfig.json, next.config.ts, tailwind.config.ts, 
# postcss.config.mjs, src/app/globals.css, src/app/layout.tsx, src/app/page.tsx, 
# README.md, README.ar.md

# Check README quality
head -50 /home/z/APP/focusflow-app/README.md
# Expected: badges, description, features list

# Install and build
cd /home/z/APP/focusflow-app
npm install
npx next build
# Expected: ✓ Compiled successfully

# Run the app
npx next dev
# Expected: FocusFlow app loads at http://localhost:3000 with all features
```

---

## 7. Architecture After Fixes

```
User Prompt
    │
    ▼
[code-generator.ts: generateProjectAsync()]
    │
    ├─ Layer 1: matchTemplate(prompt)  ← FIX 10: multi-keyword scoring
    │   ├─ habitstreak (score ≥6?) → use template
    │   ├─ taskflow (score ≥6?) → use template
    │   ├─ todo (score ≥6?) → use template
    │   ├─ counter (score ≥6?) → use template
    │   └─ calculator (score ≥6?) → use template
    │
    ├─ Layer 2: generateProjectWithLLM(prompt)  ← FIX 9: LLM generation
    │   ├─ Call /api/llm with structured output prompt
    │   ├─ Parse JSON output
    │   ├─ Validate required files
    │   └─ Return project or null
    │
    └─ Layer 3: generateGenericApp(prompt)  ← safe fallback
        └─ Always succeeds, minimal app

Each layer uses:
    ├─ generateProfessionalReadme(config)  ← FIX 11: professional README
    └─ generateProfessionalArabicReadme(config)  ← Arabic version
```

---

## 8. Final Checklist

### FIX 9 — LLM Code Generation
- [ ] `/home/z/swarmcraft/src/swarm-engine/llm-code-generator.ts` created
- [ ] `generateProjectWithLLM()` function implemented
- [ ] `parseLLMOutput()` handles markdown fences + extra text
- [ ] `validateProject()` checks required files + content
- [ ] `generateProjectAsync()` added to `code-generator.ts`
- [ ] `generateAndPushProject` updated to use `generateProjectAsync()`

### FIX 10 — Smart Dispatch
- [ ] `TEMPLATES` array with weighted keywords
- [ ] `matchTemplate()` function with scoring
- [ ] `MATCH_THRESHOLD = 6` configured
- [ ] FocusFlow prompt no longer matches HabitStreak template
- [ ] HabitStreak prompt still matches HabitStreak template

### FIX 11 — Professional README
- [ ] `/home/z/swarmcraft/src/swarm-engine/readme-generator.ts` created
- [ ] `generateProfessionalReadme()` function with badges + all sections
- [ ] `generateProfessionalArabicReadme()` with RTL support
- [ ] All 5 templates (Todo, TaskFlow, Counter, Calculator, HabitStreak) updated
- [ ] Generic fallback updated
- [ ] LLM system prompt updated to require professional README

### Verification
- [ ] `npx tsc --noEmit` passes (no new errors)
- [ ] `npx next build` succeeds
- [ ] FocusFlow test prompt generates a real FocusFlow app (not HabitStreak)
- [ ] `/home/z/APP/focusflow-app/` created with 10+ files
- [ ] `github.com/mayakilzy/focusflow-app` repo exists
- [ ] README.md has badges + features + quick start + tech stack table
- [ ] HabitStreak test prompt still works (regression test)
- [ ] FocusFlow app runs locally with all features

---

## 9. What NOT to Do

- ❌ Do NOT delete the existing template generators — they're faster and more reliable than LLM for known app types
- ❌ Do NOT remove the generic fallback — it's the safety net when LLM fails
- ❌ Do NOT lower `MATCH_THRESHOLD` below 6 — would cause false matches
- ❌ Do NOT skip the validation step in LLM generation — invalid LLM output would break the build
- ❌ Do NOT generate READMEs without badges — they're the professional standard
- ❌ Do NOT modify the permanent workspace structure (`/home/z/swarmcraft/` + `/home/z/APP/`) — it's working

---

**End of Production Readiness Mission Brief.** Apply these 3 fixes to make SwarmCraft production-ready. 🚀
