/**
 * Knowledge template registry — struktur catatan per domain.
 *
 * Filosofi: "skill bukan cuma template, tapi punya domain knowledge".
 * Template di sini = kerangka catatan yang diisi AI dari hasil crawl,
 * jadi struktur catatannya memang dirancang buat AI baca & pakai.
 * Finance beda sama Legal beda sama Tech — sections-nya beda.
 *
 * NOTE: Semua dokumen knowledge di-generate dalam BAHASA INGGRIS
 * (headings & guidance di sini English biar LLM output konsisten),
 * walaupun user nulis prompt / sumbernya bahasa Indonesia.
 */

export interface TemplateSection {
  /** Key unik (dipakai di JSON LLM). */
  key: string;
  /** Heading markdown yang dirender. */
  heading: string;
  /** Guidance ke LLM: apa yang harus diisi di section ini. */
  guidance: string;
  required: boolean;
}

export interface KnowledgeTemplate {
  id: string;
  name: string;
  description: string;
  /** Keyword di nama specialist buat auto-detect. Lowercase. */
  match: string[];
  sections: TemplateSection[];
}

export const TEMPLATES: KnowledgeTemplate[] = [
  {
    id: "finance",
    name: "Finance",
    description: "Tax, accounting, financial regulation, Indonesian taxation.",
    match: ["finance", "keuangan", "akuntan", "akuntansi", "pajak", "tax", "accounting", "finansial"],
    sections: [
      {
        key: "summary",
        heading: "Summary",
        guidance:
          "2-4 concise sentences: what the topic is, why it matters, and the most essential points. Write it like an executive summary.",
        required: true,
      },
      {
        key: "regulations",
        heading: "Regulations & Legal Basis",
        guidance:
          "List relevant regulations: full name (Law/PP/PMK/PER-...), number & year, and one line about its core content. Example: 'Law No. 7/2021 (HPP) — changes to income tax rates'. If no specific regulation exists, state the general provisions that apply.",
        required: true,
      },
      {
        key: "rates_formulas",
        heading: "Rates, Formulas & Provisions",
        guidance:
          "Rates, calculation formulas, thresholds, and technical provisions. Include exact figures from the sources. If there is a rate table, write it as bullet points.",
        required: true,
      },
      {
        key: "examples",
        heading: "Examples / Calculations",
        guidance:
          "At least 1 concrete calculation example with numbers (illustrative). Show the step-by-step calculation.",
        required: true,
      },
      {
        key: "obligations",
        heading: "Obligations & Deadlines",
        guidance:
          "Obligations of the taxpayer/entity related to this topic: what must be done, when (deadline), where (institution), and penalties for being late.",
        required: false,
      },
      {
        key: "pitfalls",
        heading: "Common Mistakes / Pitfalls",
        guidance:
          "Frequent mistakes (misinterpretation, miscalculation, late filing) and how to avoid them.",
        required: false,
      },
      {
        key: "glossary",
        heading: "Glossary",
        guidance:
          "5-10 key terms + short definition (1 line each), format: 'Term: definition'. Focus on terms that often cause confusion.",
        required: false,
      },
    ],
  },
  {
    id: "legal",
    name: "Legal",
    description: "Law, regulation, contracts, compliance.",
    match: ["legal", "hukum", "lawyer", "pengacara", "advokat", "kontrak", "compliance"],
    sections: [
      {
        key: "summary",
        heading: "Summary",
        guidance:
          "2-4 concise sentences: the topic, the main legal basis, and its practical implications.",
        required: true,
      },
      {
        key: "legal_basis",
        heading: "Legal Basis",
        guidance:
          "Relevant laws/regulations: full name, number & year, the relevant article, and the core content of that article.",
        required: true,
      },
      {
        key: "parties",
        heading: "Parties & Obligations",
        guidance:
          "The parties involved (legal subjects), each party's rights & obligations, and the consequences if not fulfilled.",
        required: true,
      },
      {
        key: "procedure",
        heading: "Procedure / Flow",
        guidance:
          "Step-by-step procedural steps (registration, application, reporting, dispute resolution) in order.",
        required: false,
      },
      {
        key: "sanctions",
        heading: "Sanctions & Consequences",
        guidance:
          "Administrative/criminal/civil sanctions for violations, fine amounts if any, and enforcement case examples.",
        required: false,
      },
      {
        key: "examples",
        heading: "Case Examples",
        guidance:
          "Examples of this law applied in real cases (illustrative allowed) and how the law is applied.",
        required: false,
      },
      {
        key: "faq",
        heading: "FAQ",
        guidance: "3-5 most common questions + short answers, format: 'Q: ... / A: ...'.",
        required: false,
      },
    ],
  },
  {
    id: "tech",
    name: "Tech / Development",
    description: "Programming, architecture, tooling, best practices.",
    match: ["tech", "developer", "engineer", "programmer", "it specialist", "it support", "it manager", "information technology", "code", "dev", "software", "backend", "frontend", "database", "infrastructure", "infrastruktur", "devops"],
    sections: [
      {
        key: "summary",
        heading: "Summary",
        guidance:
          "2-4 sentences: what technology/concept this is, what it is used for, and why it matters.",
        required: true,
      },
      {
        key: "concepts",
        heading: "Concepts & Architecture",
        guidance:
          "Core concepts, how it works, important terminology, and (if relevant) an architecture/component overview.",
        required: true,
      },
      {
        key: "syntax_api",
        heading: "Syntax / API / Configuration",
        guidance:
          "Important syntax, API signatures, configuration options, and default values. Put code in code blocks.",
        required: true,
      },
      {
        key: "examples",
        heading: "Code Examples",
        guidance:
          "Minimal copy-paste-ready code examples, with a short explanation for each.",
        required: true,
      },
      {
        key: "pitfalls",
        heading: "Pitfalls / Gotchas",
        guidance:
          "Common traps, frequent errors, limitations, and how to work around them.",
        required: false,
      },
      {
        key: "references",
        heading: "Further References",
        guidance: "Official docs, articles, or repos worth exploring further.",
        required: false,
      },
    ],
  },
  {
    id: "business",
    name: "Business / Analysis",
    description: "Business analysis, market, strategy, data.",
    match: ["business", "analyst", "bisnis", "startup", "marketing", "strategy", "manajemen"],
    sections: [
      {
        key: "summary",
        heading: "Summary",
        guidance:
          "2-4 concise sentences: context, key insight, and a short recommendation.",
        required: true,
      },
      {
        key: "context",
        heading: "Context & Background",
        guidance:
          "Background of the topic: current situation, why it matters, relevant trends.",
        required: true,
      },
      {
        key: "key_points",
        heading: "Key Points",
        guidance:
          "Main facts & findings from the sources, as dense, specific bullet points (include numbers when available).",
        required: true,
      },
      {
        key: "data",
        heading: "Data & Facts",
        guidance:
          "Figures, statistics, quotas, or supporting data that can be cited. Mention the source.",
        required: false,
      },
      {
        key: "implications",
        heading: "Implications / Recommendations",
        guidance:
          "What this means for decision-making, plus reasonable recommended actions.",
        required: false,
      },
      {
        key: "risks",
        heading: "Risks & Considerations",
        guidance: "Risks, assumptions, and things to consider before acting.",
        required: false,
      },
    ],
  },
  {
    id: "ui_design",
    name: "UI / Design",
    description: "Web UI design analysis: tokens, typography, layout, components, interactions.",
    match: [
      "ui specialist",
      "ui/ux",
      "ui design",
      "ui designer",
      "ux",
      "designer",
      "design system",
      "interface",
      "figma",
      "landing page",
      "web design",
      "visual design",
    ],
    sections: [
      {
        key: "summary",
        heading: "Summary",
        guidance:
          "2-4 concise sentences: what this site/design system is, its overall visual character, and why it stands out.",
        required: true,
      },
      {
        key: "design_tokens",
        heading: "Design Tokens & Color Palette",
        guidance:
          "Concrete palette details: exact hex codes when available, primary/secondary/accent colors, background & surface colors, text colors, border radius, shadow, spacing rhythm. Be specific — this is what makes the analysis reusable.",
        required: true,
      },
      {
        key: "typography",
        heading: "Typography",
        guidance:
          "Font stack (family names), type scale (sizes/weights), heading vs body treatment, letter-spacing / line-height character, any distinctive type choices.",
        required: true,
      },
      {
        key: "layout",
        heading: "Layout & Section Structure",
        guidance:
          "Page flow: hero, features, product/dashboard preview, integrations, pricing, testimonials, footer. Note grid patterns, asymmetry, whitespace usage, sticky elements.",
        required: true,
      },
      {
        key: "components",
        heading: "Component Patterns",
        guidance:
          "Navigation style, CTA treatment (shape, color, hover), cards, buttons, forms, dropdowns/menus. Describe style & behavior, not generic fluff.",
        required: false,
      },
      {
        key: "interactions",
        heading: "Interaction & Motion",
        guidance:
          "Hover states, transitions, micro-interactions, scroll behavior, loading states, animation feel (fast/snappy vs slow/soft).",
        required: false,
      },
      {
        key: "imagery",
        heading: "Imagery & Illustration",
        guidance:
          "Photo vs illustration vs abstract gradients, product screenshots, avatar/logo style, consistency of visual assets.",
        required: false,
      },
      {
        key: "takeaways",
        heading: "Key Takeaways / Patterns to Borrow",
        guidance:
          "3-6 actionable design patterns worth replicating in another product, with a one-line 'why it works' for each.",
        required: false,
      },
    ],
  },
  {
    id: "solution_arch",
    name: "Solution Architecture",
    description: "Solution architecture analysis: components, data flow, integration, trade-offs.",
    match: [
      "solution architect",
      "architect",
      "architecture",
      "arsitektur",
      "solution",
      "cqrs",
      "microservice",
      "event-driven",
      "event driven",
      "modular monolith",
      "clean architecture",
      "onion",
    ],
    sections: [
      {
        key: "summary",
        heading: "Summary",
        guidance:
          "2-4 concise sentences: the system/problem, the architectural approach chosen, and the main trade-off accepted.",
        required: true,
      },
      {
        key: "context",
        heading: "Context & Requirements",
        guidance:
          "Problem being solved, constraints (scale, budget, team, timeline), functional & non-functional requirements that drive the architecture.",
        required: true,
      },
      {
        key: "architecture",
        heading: "Architecture Overview",
        guidance:
          "The chosen style (monolith, modular monolith, microservices, event-driven, serverless...), main building blocks, and dependency direction between them.",
        required: true,
      },
      {
        key: "components",
        heading: "Components & Responsibilities",
        guidance:
          "Each component/module/service: its responsibility, its owner, and how it stays decoupled from the others.",
        required: true,
      },
      {
        key: "data_flow",
        heading: "Data Flow & Communication",
        guidance:
          "Request/event flows: sync vs async, protocols (HTTP, gRPC, message queue), contract versioning, error propagation.",
        required: false,
      },
      {
        key: "data_model",
        heading: "Data Model & Storage",
        guidance:
          "Key entities, storage choice (SQL/NoSQL/cache/queue), indexing & consistency strategy, data ownership per service.",
        required: false,
      },
      {
        key: "integrations",
        heading: "Integration Points",
        guidance:
          "External systems & third-party services, API contracts, auth boundaries, and failure handling.",
        required: false,
      },
      {
        key: "nfr",
        heading: "Non-Functional Requirements",
        guidance:
          "Performance, scalability, availability, security, observability, and cost considerations implied by the design.",
        required: false,
      },
      {
        key: "tradeoffs",
        heading: "Trade-offs & Decisions",
        guidance:
          "Key architectural decisions: what was chosen, what was given up, and when the trade-off would be worth revisiting.",
        required: false,
      },
      {
        key: "pitfalls",
        heading: "Pitfalls / Anti-patterns",
        guidance:
          "Common traps when applying this approach (over-engineering, distributed monolith, sync coupling, data consistency...) and how to avoid them.",
        required: false,
      },
    ],
  },
  {
    id: "generic",
    name: "Generic",
    description: "General topic — fallback when no domain is detected.",
    match: [],
    sections: [
      {
        key: "summary",
        heading: "Summary",
        guidance: "2-4 concise sentences: the topic and the most important points.",
        required: true,
      },
      {
        key: "key_points",
        heading: "Key Points",
        guidance: "Key facts & points from the sources, as dense bullet points.",
        required: true,
      },
      {
        key: "details",
        heading: "Details & Explanation",
        guidance: "Deeper explanation: processes, mechanisms, provisions, or context.",
        required: true,
      },
      {
        key: "examples",
        heading: "Examples",
        guidance: "Concrete examples or case studies that clarify the topic.",
        required: false,
      },
      {
        key: "references",
        heading: "References",
        guidance: "List of relevant sources to explore further.",
        required: false,
      },
    ],
  },
];

/** Auto-detect template dari nama specialist (keyword match). Fallback generic. */
export function detectTemplate(specialistName: string): KnowledgeTemplate {
  const name = specialistName.toLowerCase();
  for (const t of TEMPLATES) {
    if (t.match.some((kw) => name.includes(kw))) return t;
  }
  return TEMPLATES.find((t) => t.id === "generic")!;
}

export function getTemplate(id: string): KnowledgeTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
