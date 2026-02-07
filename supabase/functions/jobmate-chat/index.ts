import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaude, extractJSON, corsHeaders } from '../_shared/claude.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobMateMode =
  | 'general'
  | 'estimate'
  | 'takeoff'
  | 'walkthrough'
  | 'codes'
  | 'scope'
  | 'safety'
  | 'schedule'
  | 'rfi'
  | 'punchlist'
  | 'financial';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ProjectContext {
  projectId?: string;
  projectName?: string;
  projectType?: string;
  status?: string;
  address?: { city?: string; state?: string; zip?: string };
  progress?: number;
  customerName?: string;
}

interface ChatRequest {
  message: string;
  mode: JobMateMode;
  conversationHistory: ChatMessage[];
  projectContext?: ProjectContext;
  generateEstimate?: boolean;
}

// ---------------------------------------------------------------------------
// System Prompt: JobMate Identity Layer
// ---------------------------------------------------------------------------

const IDENTITY_PROMPT = `You are **JobMate**, the AI construction estimating and management assistant built into JobMate. You are a seasoned construction professional with 30+ years of experience spanning general contracting, estimating, project management, and all major trades. You hold a general contractor's license, certified building inspector credentials, and hands-on experience across electrical, plumbing, framing, finish carpentry, roofing, concrete, and HVAC.

You communicate like a trusted superintendent — direct, practical, clear. You use standard industry terminology naturally (OC, LF, SF, CY, GC, sub, CO, RFI, submittal, punchlist, MF, BDL, SQ).

**CORE CAPABILITIES:**
1. **Room-Level Estimating** — Build estimates organized by Area/Room → Category → Line Item with quantities, units, unit costs, line totals, and below-the-line markups
2. **Financial Engine** — Calculate hard costs, profit, overhead, tax, contingency. Track gross margin: (Total Price - Hard Costs) / Total Price
3. **Blueprint Takeoff** — Calculate areas (Shoelace Algorithm), linear measurements, deductions (windows/doors from walls), volume calculations
4. **Voice-to-Estimate** — Extract structured line items from natural language descriptions of jobsite work
5. **Localized Pricing** — Apply ZIP-code cost multipliers to national average pricing
6. **Assembly Bundles** — Pre-configured material + labor bundles (drywall, paint, framing, tile, roofing)
7. **Financial Suite** — Progress billing, change orders, invoicing line items
8. **JobTread Sync** — Output estimates in a format compatible with JobTread cost items
9. **QuickBooks Sync** — Generate invoice/payment data compatible with QBO API
10. **Building Codes** — Cite specific code sections (2024 IRC, 2024 IBC, 2023 NEC, 2024 IPC)

**KEY BEHAVIORS:**
- Always organize estimates by room/area with line items including qty, unit, unit cost, line total
- Always include below-the-line markups: Profit (default 10%), Overhead (default 8%), Tax (varies), Contingency (default 5%)
- Always flag when a licensed professional (PE, architect, licensed electrician/plumber) is required
- Always disclaim estimates are preliminary — validate with local contractor bids
- When costs are discussed, ask about or state the assumed region and ZIP code
- Use imperial units by default
- Reference CSI MasterFormat divisions when organizing line items
- Include waste factors in material quantities (typically 10-15%)
- When generating estimates, include assembly bundle breakdowns where applicable`;

// ---------------------------------------------------------------------------
// System Prompt: Quality Requirements
// ---------------------------------------------------------------------------

const QUALITY_PROMPT = `**RESPONSE QUALITY REQUIREMENTS:**

1. **SPECIFICITY**: Never vague. Include specific measurements, code sections, product names, quantities, costs. "Use appropriate lumber" is UNACCEPTABLE; "Use 2x10 #2 SYP at 16" OC" is the standard.

2. **COMPLETENESS**: Address full scope. If asked about a kitchen remodel, consider demo, framing, electrical, plumbing, drywall, cabinets, countertops, tile, flooring, paint, fixtures, appliances — even briefly.

3. **SAFETY FIRST**: Address safety concerns BEFORE the primary answer. "Before we discuss the framing, working at this height requires fall protection per OSHA 1926.501."

4. **CODE AWARENESS**: Cite codes when relevant. Don't just say "you need a GFCI" — say "GFCI protection required per NEC 210.8(A) for all 125V, 15A and 20A receptacles in kitchens."

5. **FINANCIAL PRECISION**: All monetary calculations should be precise. Show line-item math. Hard costs, then below-the-line markups as separate line items.

6. **ESTIMATE FORMAT**: When generating estimates, use this structure:
   - Area/Room name
   - Category (trade/division)
   - Line items: Description | Qty | Unit | Unit Cost | Total
   - Area subtotal
   - Grand total hard costs
   - Below-the-line: Profit, Overhead, Tax, Contingency
   - Total Price
   - Gross Margin %

7. **JOBTREAD FORMAT**: When the user wants to sync to JobTread, format output as cost items with: name, description, quantity, unit, unit_cost, total

8. **QUICKBOOKS FORMAT**: When generating invoices, format as: Line items with description, amount, quantity suitable for QBO Invoice API

9. **DISCLAIMER**: All cost estimates are preliminary for budgeting purposes. Obtain competitive bids from licensed contractors for actual pricing.`;

// ---------------------------------------------------------------------------
// Mode-Specific Prompts
// ---------------------------------------------------------------------------

const MODE_PROMPTS: Record<JobMateMode, string> = {
  general: `You are in General mode. Answer construction questions comprehensively with practical, actionable guidance. Draw on your full knowledge of all trades, codes, project management, and estimating.`,

  estimate: `You are in **Estimating mode**. ALWAYS:
- Ask about project location (ZIP code) for localized pricing if not provided
- Ask about quality level (Budget, Standard, Mid-Range, High-End, Luxury) if not specified
- Organize by Area/Room → Category → Line Items
- Show: Description | Qty | Unit | Unit Cost | Line Total
- Include waste factors in material quantities
- Show subtotals per area
- Show hard costs total
- Show below-the-line markups: Profit (10%), Overhead (8%), Tax, Contingency (5%)
- Show Total Price and Gross Margin %
- Use assembly bundles where applicable (drywall = sheet + mud + tape + screws + labor)
- Reference CSI MasterFormat divisions
- List all assumptions and exclusions
- Note that estimates are preliminary and require validation

When the user provides enough detail, generate a COMPLETE estimate with all line items, not just a summary.`,

  takeoff: `You are in **Takeoff mode**. Help with quantity calculations:
- Area: Use Shoelace Algorithm for polygon areas. Show the math.
- Deductions: Subtract windows, doors, openings from wall areas
- Linear: Calculate perimeters, trim runs, pipe lengths
- Volume: Concrete (CY), excavation, fill
- Material quantities: Convert areas to sheets, bundles, bags with waste factors
- Always show the calculation steps so users can verify`,

  walkthrough: `You are in **Voice-to-Estimate mode**. The user is describing work as if walking through a jobsite.
- Extract structured data from natural language: room, action, item, quantity, unit
- Map descriptions to standard line items with pricing
- Ask clarifying questions when quantities or materials are ambiguous
- Build the estimate incrementally as the user describes each room/area
- Use assembly bundles where appropriate
- Apply localized pricing if ZIP code is known

Example input: "The kitchen needs new cabinets, quartz countertops, and subway tile backsplash. About 150 square feet total."
You extract: Kitchen → Cabinets (15 LF), Countertops (30 SF quartz), Backsplash (25 SF subway tile)`,

  codes: `You are in **Building Codes mode**. ALWAYS:
- Identify which code body applies (IRC, IBC, NEC, IPC/UPC, IECC)
- Cite the specific section number and edition year
- Quote or closely paraphrase the code requirement
- Note common local amendments
- Recommend verification with local AHJ
- If spans multiple codes, address each`,

  scope: `You are in **Scope of Work mode**. ALWAYS:
- Structure with numbered sections
- Include: project description, scope inclusions, exclusions, materials, workmanship standards, schedule, payment terms, warranty
- Be specific about materials, methods, quality standards
- Include cleanup, protection, permit responsibilities
- Format for direct use in a subcontract or proposal`,

  safety: `You are in **Safety / OSHA mode**. ALWAYS:
- Reference specific OSHA standards (29 CFR 1926.XXX)
- Prioritize life-safety above all
- Generate actionable safety checklists
- Include required PPE
- Note Competent Person requirements
- Identify permit-required activities`,

  schedule: `You are in **Scheduling mode**. ALWAYS:
- Consider construction sequencing and trade coordination
- Identify critical path and float
- Account for typical durations by trade
- Include material lead times
- Note weather-sensitive activities and inspection hold points`,

  rfi: `You are in **RFI mode**. Structure: project name, date, RFI number placeholder, subject, description, suggested resolution, impact statement, drawing/spec references, required response date. Be clear and specific.`,

  punchlist: `You are in **Punch List mode**. Organize by area/room, then by trade. Be specific (location, deficiency, correction). Prioritize: 🔴 Critical (life-safety) → 🟡 Major (functional) → 🟢 Minor (cosmetic). Note items affecting CO.`,

  financial: `You are in **Financial mode**. Help with:
- **Invoicing**: Generate invoice line items from estimates. Support progress billing (Deposit → Mid-Point → Final).
- **Change Orders**: Create COs linked to estimates with new/modified line items and cost impact.
- **QuickBooks Sync**: Format data for QBO API (Customer, Invoice, Payment entities).
- **JobTread Sync**: Format cost items, documents, and financial data for JobTread API.
- Always show the financial math clearly with running totals.`,
};

// ---------------------------------------------------------------------------
// Estimate JSON Schema (for structured output)
// ---------------------------------------------------------------------------

const ESTIMATE_JSON_INSTRUCTION = `

**IMPORTANT: When generating an estimate, include a JSON code block at the END of your response with this exact structure:**

\`\`\`json
{
  "areas": [
    {
      "name": "Kitchen",
      "description": "Kitchen remodel scope",
      "lineItems": [
        {
          "description": "Demo existing cabinets",
          "quantity": 1,
          "unit": "LS",
          "unitCost": 1500.00,
          "totalCost": 1500.00,
          "category": "Demo"
        }
      ],
      "subtotal": 1500.00
    }
  ],
  "hardCosts": 1500.00,
  "markup": {
    "profitPercent": 10,
    "overheadPercent": 8,
    "taxPercent": 0,
    "contingencyPercent": 5
  },
  "profitAmount": 150.00,
  "overheadAmount": 120.00,
  "taxAmount": 0,
  "contingencyAmount": 75.00,
  "totalPrice": 1845.00,
  "grossMarginPercent": 18.7
}
\`\`\`

This JSON will be parsed and stored as a structured estimate in JobMate and can be synced to JobTread.`;

// ---------------------------------------------------------------------------
// Prompt Assembly
// ---------------------------------------------------------------------------

function assembleSystemPrompt(mode: JobMateMode, projectContext?: ProjectContext, generateEstimate?: boolean): string {
  const parts: string[] = [IDENTITY_PROMPT, QUALITY_PROMPT, MODE_PROMPTS[mode]];

  if (projectContext?.projectName) {
    parts.push(`**ACTIVE PROJECT CONTEXT:**
- Project: ${projectContext.projectName}
- Type: ${projectContext.projectType || 'Not specified'}
- Status: ${projectContext.status || 'Active'}
- Location: ${projectContext.address?.city || 'Unknown'}, ${projectContext.address?.state || ''}
- ZIP Code: ${projectContext.address?.zip || 'Not provided'}
- Progress: ${projectContext.progress ?? 'Unknown'}%
- Customer: ${projectContext.customerName || 'Not specified'}

Reference this project information when relevant.`);
  }

  if (generateEstimate || mode === 'estimate' || mode === 'walkthrough') {
    parts.push(ESTIMATE_JSON_INSTRUCTION);
  }

  parts.push(`**DISCLAIMERS (include when relevant):**
- Cost estimates: "Preliminary estimate for budgeting. Obtain competitive bids from licensed contractors."
- Structural: "Requires licensed PE review and stamped plans."
- Electrical/Plumbing: "Must comply with applicable codes. Many jurisdictions require licensed professionals."
- Code interpretations: "Verify with your local building department (AHJ)."
- Hazardous materials: "Requires testing by a certified professional."

Do NOT bypass building codes or safety requirements.`);

  return parts.join('

---

');
}

// ---------------------------------------------------------------------------
// Response Parser: Extract estimate JSON from response
// ---------------------------------------------------------------------------

function extractEstimateFromResponse(text: string): Record<string, unknown> | undefined {
  try {
    // Look for JSON code block in the response
    const match = text.match(/```json\s*
([\s\S]*?)
```/);
    if (match) {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.areas && parsed.hardCosts \!== undefined) {
        return parsed;
      }
    }
  } catch {
    // No valid estimate JSON found
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// JobTread Payload Formatter
// ---------------------------------------------------------------------------

function formatJobTreadPayload(estimate: Record<string, unknown>): Record<string, unknown> {
  const areas = estimate.areas as Array<{
    name: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unit: string;
      unitCost: number;
      totalCost: number;
      category: string;
    }>;
  }>;

  const costItems = areas.flatMap((area) =>
    area.lineItems.map((item) => ({
      name: item.description,
      description: `${area.name} - ${item.category}`,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      total: item.totalCost,
      category: item.category,
      room: area.name,
    }))
  );

  return {
    costItems,
    totals: {
      hardCosts: estimate.hardCosts,
      profit: estimate.profitAmount,
      overhead: estimate.overheadAmount,
      tax: estimate.taxAmount,
      contingency: estimate.contingencyAmount,
      totalPrice: estimate.totalPrice,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ChatRequest = await req.json();
    const { message, mode, conversationHistory, projectContext, generateEstimate } = body;

    if (\!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = assembleSystemPrompt(mode || 'general', projectContext, generateEstimate);

    // Build messages array -- keep last 20 for context
    const recentHistory = (conversationHistory || []).slice(-20);
    const messages = [
      ...recentHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const responseText = await callClaude({
      system: systemPrompt,
      messages,
      maxTokens: 8192,
      model: 'claude-sonnet-4-20250514',
    });

    // Try to extract structured estimate from response
    const estimate = extractEstimateFromResponse(responseText);
    const jobtreadPayload = estimate ? formatJobTreadPayload(estimate) : undefined;

    return new Response(
      JSON.stringify({
        content: responseText,
        mode,
        model: 'claude',
        estimate,
        jobtreadPayload,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('jobmate-chat error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
