import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobMateMode =
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

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProjectContext {
  projectId?: string;
  projectName?: string;
  projectType?: string;
  status?: string;
  address?: { city?: string; state?: string; zip?: string };
  progress?: number;
  customerName?: string;
}

export interface EstimateLineItem {
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category: string;
  notes?: string;
}

export interface EstimateArea {
  name: string;
  description?: string;
  lineItems: EstimateLineItem[];
  subtotal: number;
}

export interface EstimateOutput {
  areas: EstimateArea[];
  hardCosts: number;
  markup: {
    profitPercent: number;
    overheadPercent: number;
    taxPercent: number;
    contingencyPercent: number;
  };
  profitAmount: number;
  overheadAmount: number;
  taxAmount: number;
  contingencyAmount: number;
  totalPrice: number;
  grossMarginPercent: number;
  zipCode?: string;
  costMultiplier?: number;
}

export interface JobMateChatRequest {
  message: string;
  mode: JobMateMode;
  conversationHistory: ChatMessagePayload[];
  projectContext?: ProjectContext;
  /** When true, the AI returns a structured JSON estimate */
  generateEstimate?: boolean;
}

export interface JobMateChatResponse {
  content: string;
  mode: JobMateMode;
  /** Structured estimate output (when generateEstimate was true) */
  estimate?: EstimateOutput;
  /** JobTread-compatible format for syncing */
  jobtreadPayload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ZIP Code Cost Multipliers (Localized Pricing)
// ---------------------------------------------------------------------------

const ZIP_COST_MULTIPLIERS: Record<string, { multiplier: number; region: string }> = {
  // Tennessee
  '37': { multiplier: 0.92, region: 'Knoxville, TN' },
  '38': { multiplier: 0.90, region: 'Memphis, TN' },
  '372': { multiplier: 0.93, region: 'Nashville, TN' },
  // Texas
  '75': { multiplier: 0.95, region: 'Dallas, TX' },
  '77': { multiplier: 0.97, region: 'Houston, TX' },
  '78': { multiplier: 0.93, region: 'San Antonio, TX' },
  // Florida
  '33': { multiplier: 1.02, region: 'Miami, FL' },
  '32': { multiplier: 0.94, region: 'Orlando, FL' },
  // New York
  '10': { multiplier: 1.45, region: 'New York City, NY' },
  '11': { multiplier: 1.35, region: 'Long Island, NY' },
  '12': { multiplier: 1.10, region: 'Upstate NY' },
  // California
  '90': { multiplier: 1.30, region: 'Los Angeles, CA' },
  '94': { multiplier: 1.40, region: 'San Francisco, CA' },
  '92': { multiplier: 1.20, region: 'San Diego, CA' },
  // Illinois
  '60': { multiplier: 1.25, region: 'Chicago, IL' },
  // Colorado
  '80': { multiplier: 1.05, region: 'Denver, CO' },
  // Georgia
  '30': { multiplier: 0.96, region: 'Atlanta, GA' },
  // Washington
  '98': { multiplier: 1.15, region: 'Seattle, WA' },
  // National average
  'default': { multiplier: 1.00, region: 'National Average' },
};

export function getCostMultiplier(zipCode?: string): { multiplier: number; region: string } {
  if (!zipCode) return ZIP_COST_MULTIPLIERS['default'];

  // Try 3-digit prefix first, then 2-digit
  const prefix3 = zipCode.substring(0, 3);
  const prefix2 = zipCode.substring(0, 2);

  return ZIP_COST_MULTIPLIERS[prefix3]
    || ZIP_COST_MULTIPLIERS[prefix2]
    || ZIP_COST_MULTIPLIERS['default'];
}

// ---------------------------------------------------------------------------
// Assembly Bundles (Material + Labor grouped items)
// ---------------------------------------------------------------------------

export interface AssemblyBundle {
  name: string;
  description: string;
  unit: string;
  items: Array<{ description: string; quantity: number; unit: string; unitCost: number }>;
  totalPerUnit: number;
}

export const ASSEMBLY_BUNDLES: Record<string, AssemblyBundle> = {
  drywall_assembly: {
    name: 'Drywall Assembly',
    description: 'Complete drywall installation per SF (1/2" standard)',
    unit: 'SF',
    items: [
      { description: '1/2" Drywall Sheet', quantity: 1.1, unit: 'SF', unitCost: 0.45 },
      { description: 'Joint Compound', quantity: 0.05, unit: 'GAL', unitCost: 12.00 },
      { description: 'Drywall Tape', quantity: 0.15, unit: 'LF', unitCost: 0.03 },
      { description: 'Drywall Screws', quantity: 4, unit: 'EA', unitCost: 0.02 },
      { description: 'Installation Labor', quantity: 0.018, unit: 'HR', unitCost: 55.00 },
      { description: 'Finishing Labor (3 coats)', quantity: 0.025, unit: 'HR', unitCost: 55.00 },
    ],
    totalPerUnit: 3.48,
  },
  interior_paint: {
    name: 'Interior Paint Assembly',
    description: 'Complete interior paint per SF (2 coats, walls)',
    unit: 'SF',
    items: [
      { description: 'Primer', quantity: 0.004, unit: 'GAL', unitCost: 28.00 },
      { description: 'Finish Paint (2 coats)', quantity: 0.008, unit: 'GAL', unitCost: 42.00 },
      { description: 'Supplies (tape, drop cloths)', quantity: 1, unit: 'SF', unitCost: 0.05 },
      { description: 'Paint Labor', quantity: 0.012, unit: 'HR', unitCost: 50.00 },
    ],
    totalPerUnit: 1.10,
  },
  framing_wall: {
    name: 'Interior Wall Framing Assembly',
    description: 'Complete interior wall framing per LF (8ft ceiling, 16" OC)',
    unit: 'LF',
    items: [
      { description: '2x4 Studs (16" OC)', quantity: 1.0, unit: 'EA', unitCost: 4.50 },
      { description: '2x4 Plates (top + bottom)', quantity: 2, unit: 'LF', unitCost: 0.65 },
      { description: 'Nails/Fasteners', quantity: 1, unit: 'LF', unitCost: 0.25 },
      { description: 'Framing Labor', quantity: 0.04, unit: 'HR', unitCost: 55.00 },
    ],
    totalPerUnit: 8.60,
  },
  tile_floor: {
    name: 'Floor Tile Assembly',
    description: 'Complete floor tile installation per SF (12x12 porcelain)',
    unit: 'SF',
    items: [
      { description: '12x12 Porcelain Tile', quantity: 1.1, unit: 'SF', unitCost: 3.50 },
      { description: 'Thinset Mortar', quantity: 0.02, unit: 'BAG', unitCost: 18.00 },
      { description: 'Grout', quantity: 0.01, unit: 'BAG', unitCost: 15.00 },
      { description: 'Tile Spacers', quantity: 4, unit: 'EA', unitCost: 0.01 },
      { description: 'Tile Labor', quantity: 0.05, unit: 'HR', unitCost: 60.00 },
    ],
    totalPerUnit: 7.55,
  },
  roofing_shingle: {
    name: 'Asphalt Shingle Roofing Assembly',
    description: 'Complete asphalt shingle roofing per SQ (100 SF)',
    unit: 'SQ',
    items: [
      { description: '3-Tab Asphalt Shingles', quantity: 3.3, unit: 'BDL', unitCost: 32.00 },
      { description: '15# Felt Underlayment', quantity: 1, unit: 'ROLL', unitCost: 22.00 },
      { description: 'Roofing Nails', quantity: 2, unit: 'LB', unitCost: 3.50 },
      { description: 'Drip Edge', quantity: 10, unit: 'LF', unitCost: 1.25 },
      { description: 'Roofing Labor', quantity: 1.5, unit: 'HR', unitCost: 55.00 },
    ],
    totalPerUnit: 224.10,
  },
};

// ---------------------------------------------------------------------------
// System Prompts (ported from Cloud Function)
// ---------------------------------------------------------------------------

const BASE_SYSTEM_PROMPT = `You are JobMate, an expert AI construction estimating and project management assistant built into ProjectWorks — a field management app for contractors, builders, and remodelers.

You have deep expertise in:
- **Estimating**: Room-level cost breakdowns with labor, materials, and equipment. You know typical costs for residential and commercial construction across the US.
- **Blueprint Takeoff**: Area calculations, linear measurements, volume computations with proper waste factors.
- **Building Codes**: 2024 IRC, IBC, NEC, IPC/UPC, IECC references with specific section citations.
- **Scopes of Work**: Professional SOW drafting with inclusions, exclusions, specs, and payment terms.
- **Safety**: OSHA 29 CFR 1926 references, JHAs, toolbox talks, competent person requirements.
- **Scheduling**: Critical path activities, trade coordination, lead times, inspection holds.
- **RFIs**: Professional Request for Information drafting.
- **Punch Lists**: Systematic deficiency identification organized by severity.
- **Financial**: Invoice generation, change orders, progress billing, markup calculations.

Guidelines:
- Be specific with numbers, quantities, and costs. Contractors need real data.
- Use industry-standard units (SF, LF, SY, CY, EA, LS, HR, etc.).
- When estimating, organize by room/area with separate line items for labor and materials.
- Default markup structure: 10% profit, 8% overhead, 7.5% tax, 5% contingency (adjustable).
- Always mention that estimates should be verified against local pricing and conditions.
- Format responses with markdown: headers, bold, bullet points, tables when appropriate.
- Be concise but thorough — field workers are busy.
- When you don't know exact local pricing, give national average ranges and note it.`;

const MODE_PROMPTS: Record<string, string> = {
  estimate: `You are in ESTIMATING mode. Build detailed room-by-room cost estimates with line items.
For each area include: Description, Quantity, Unit, Unit Cost, Total Cost, Category (Labor/Material/Equipment).
Always show subtotals per area, then hard costs total, then markups (profit, overhead, tax, contingency), then final price.
If a ZIP code is provided, adjust costs for that region (e.g., NYC ~1.4x national avg, rural TN ~0.9x).`,

  takeoff: `You are in TAKEOFF mode. Help with blueprint takeoff calculations.
Calculate areas (use Shoelace formula for polygons), linear measurements, volumes.
Always include waste factors (typically 10-15% for most materials).
Show your math step by step so the contractor can verify.`,

  walkthrough: `You are in WALKTHROUGH mode. The user is describing work room-by-room as if walking the jobsite.
Extract line items from their descriptions, organize by room/area.
Ask clarifying questions about quantities, quality level, or scope when descriptions are vague.
Build a running estimate as they describe each area.`,

  codes: `You are in BUILDING CODES mode. Reference specific code sections:
- 2024 IRC for residential
- 2024 IBC for commercial
- 2023 NEC for electrical
- 2024 IPC/UPC for plumbing
- 2024 IECC for energy
Always cite specific section numbers (e.g., "IRC R311.7.5.1 requires...").
ALWAYS remind users to verify with their local Authority Having Jurisdiction (AHJ) as jurisdictions may adopt amendments.`,

  scope: `You are in SCOPE OF WORK mode. Draft professional scopes with:
1. Project Description, 2. Scope Inclusions (detailed), 3. Scope Exclusions,
4. Materials & Specifications, 5. Workmanship Standards, 6. Schedule & Milestones,
7. Payment Terms, 8. Warranty Provisions, 9. Cleanup & Protection.`,

  safety: `You are in SAFETY mode. Reference OSHA 29 CFR 1926 for construction safety.
Generate toolbox talks, JHAs, pre-task plans, or answer specific safety questions.
Always emphasize that safety requirements are minimums and cite specific OSHA standards.`,

  schedule: `You are in SCHEDULING mode. Help plan project schedules considering:
critical path, trade coordination, material lead times, weather, inspections.
Provide realistic durations based on crew sizes and productivity rates.`,

  rfi: `You are in RFI mode. Draft professional Requests for Information with:
Subject, Description of Issue/Discrepancy, Drawing/Spec References,
Suggested Resolution, Cost/Schedule Impact Statement, Required Response Date.`,

  punchlist: `You are in PUNCH LIST mode. Create systematic deficiency lists organized by:
- RED: Critical (life-safety, code violations)
- YELLOW: Major (functional issues, visible defects)
- GREEN: Minor (cosmetic, touch-ups)
Include specific location, description, responsible trade, and priority.`,

  financial: `You are in FINANCIAL mode. Help with:
- Progress billing schedules (Deposit → Milestones → Final)
- Invoice generation from estimates
- Change order creation with cost impact
- Markup calculations and margin analysis
Format financial data clearly with columns and totals.`,

  general: '',
};

function buildSystemPrompt(mode: string, projectContext?: ProjectContext): string {
  let prompt = BASE_SYSTEM_PROMPT;

  const modePrompt = MODE_PROMPTS[mode] || '';
  if (modePrompt) {
    prompt += '\n\n' + modePrompt;
  }

  if (projectContext) {
    prompt += '\n\nCurrent Project Context:';
    if (projectContext.projectName) prompt += `\n- Project: ${projectContext.projectName}`;
    if (projectContext.projectType) prompt += `\n- Type: ${projectContext.projectType}`;
    if (projectContext.status) prompt += `\n- Status: ${projectContext.status}`;
    if (projectContext.customerName) prompt += `\n- Customer: ${projectContext.customerName}`;
    if (projectContext.address) {
      const addr = projectContext.address;
      const parts = [addr.city, addr.state, addr.zip].filter(Boolean);
      if (parts.length > 0) prompt += `\n- Location: ${parts.join(', ')}`;
    }
    if (projectContext.progress != null) prompt += `\n- Progress: ${projectContext.progress}%`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Gemini Client (direct browser call — CORS supported)
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  if (!GEMINI_API_KEY) {
    console.warn('[JobMate] No Gemini API key found (VITE_GEMINI_API_KEY)');
    return null;
  }
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return _genAI;
}

async function callGemini(
  systemPrompt: string,
  conversationHistory: ChatMessagePayload[],
  userMessage: string,
): Promise<string> {
  const genAI = getGenAI();
  if (!genAI) throw new Error('Gemini API key not configured');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  // Build chat history (last 20 messages for context window)
  const history = conversationHistory.slice(-20).map((msg) => ({
    role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(userMessage);
  const response = result.response;

  return response.text() || 'I apologize, I could not generate a response.';
}

// ---------------------------------------------------------------------------
// Mock Responses (fallback when API key is not configured)
// ---------------------------------------------------------------------------

const MOCK_RESPONSES: Record<JobMateMode, string[]> = {
  general: [
    `I'm **JobMate**, your AI construction estimating and management assistant. I'm built into JobMate and can help with:

🏗️ **Estimating** — Room-level estimates with line items, markups, and localized pricing
📐 **Blueprint Takeoff** — Area/linear measurements from plans
🎙️ **Voice-to-Estimate** — Describe work verbally and I'll create line items
📋 **Scopes, RFIs, Punch Lists** — Professional document drafting
⚖️ **Building Codes** — IRC, IBC, NEC lookups with specific citations
💰 **Financial** — Invoices, change orders, QuickBooks sync
📊 **JobTread Sync** — Push estimates and financials to JobTread

What would you like help with today?`,
  ],
  estimate: [
    `I'll build a detailed estimate for you. To give you accurate numbers, I need:

**1. Project Basics:**
- Type of work (remodel, new construction, addition, repair)
- Location (ZIP code for localized pricing)
- Square footage or dimensions

**2. Room/Area Breakdown:**
I organize estimates by room or area:
- Kitchen, bathrooms, bedrooms, exterior, etc.
- Each area gets its own line items

**3. Quality Level:**
- Budget / Standard / Mid-Range / High-End / Luxury

**4. Markups:**
- Default: 10% profit, 8% overhead, contingency 5%
- I can adjust these to match your standard rates

What project are you estimating? Give me the details and I'll build a complete room-by-room breakdown with labor, materials, and your markups.`,
  ],
  takeoff: [
    `I can help with blueprint takeoff calculations. Describe what you're measuring or give me dimensions and I'll calculate the takeoff with proper waste factors.`,
  ],
  walkthrough: [
    `I'm ready for a **voice-to-estimate walkthrough**. Describe the work room by room and I'll extract line items and build the estimate. What room should we start with?`,
  ],
  codes: [
    `I can look up building codes from current editions (2024 IRC, IBC, 2023 NEC, 2024 IPC/UPC, IECC). Which code area do you need help with?`,
  ],
  scope: [
    `I'll draft a professional scope of work. Tell me the trade, square footage, and quality level and I'll draft a ready-to-use scope.`,
  ],
  safety: [
    `Safety is priority one. I reference OSHA 29 CFR 1926 for construction. What safety concern or checklist do you need?`,
  ],
  schedule: [
    `I'll help with project scheduling. Tell me the project type, scope, milestones, and crew availability.`,
  ],
  rfi: [
    `I'll draft a professional RFI. Give me the issue, drawing/spec references, and your suggested resolution.`,
  ],
  punchlist: [
    `I'll create a systematic punch list. Tell me the area/rooms, trades involved, and project stage.`,
  ],
  financial: [
    `I can help with invoicing, change orders, progress billing, and markup calculations. What financial task do you need?`,
  ],
};

// ---------------------------------------------------------------------------
// API Call — Direct Gemini (primary) with mock fallback
// ---------------------------------------------------------------------------

let mockCounter: Record<JobMateMode, number> = {
  general: 0, estimate: 0, takeoff: 0, walkthrough: 0, codes: 0,
  scope: 0, safety: 0, schedule: 0, rfi: 0, punchlist: 0, financial: 0,
};

export function resetMockCounters() {
  mockCounter = {
    general: 0, estimate: 0, takeoff: 0, walkthrough: 0, codes: 0,
    scope: 0, safety: 0, schedule: 0, rfi: 0, punchlist: 0, financial: 0,
  };
}

/**
 * Send a message to the JobMate AI assistant.
 *
 * Calls Google Gemini directly from the browser (CORS supported).
 * Falls back to mock responses only when the API key is missing or
 * the service is completely unreachable.
 */
export async function sendJobMateMessage(
  request: JobMateChatRequest
): Promise<JobMateChatResponse> {
  const mode = request.mode || 'general';

  // Build the system prompt with mode and project context
  const systemPrompt = buildSystemPrompt(mode, request.projectContext);

  // --- Try Gemini direct call (browser → Gemini API) ---
  if (GEMINI_API_KEY) {
    try {
      console.log(`[JobMate] Calling Gemini directly (mode: ${mode})`);
      const content = await callGemini(
        systemPrompt,
        request.conversationHistory,
        request.message,
      );

      if (content) {
        console.log(`[JobMate] Gemini responded successfully`);
        return { content, mode };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[JobMate] Gemini direct call failed:', errMsg);

      // If it's a quota/rate limit error, tell the user
      if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
        return {
          content: '⚠️ AI rate limit reached. Please wait a moment and try again.',
          mode,
        };
      }

      // If it's an auth error (bad API key)
      if (errMsg.includes('403') || errMsg.includes('401') || errMsg.toLowerCase().includes('api key')) {
        return {
          content: '⚠️ AI service configuration error. Please contact your administrator.',
          mode,
        };
      }
    }
  } else {
    console.warn('[JobMate] No VITE_GEMINI_API_KEY set — using mock responses');
  }

  // --- Mock fallback — only reached when API key is missing or call failed ---
  const delay = 600 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const responses = MOCK_RESPONSES[mode] || MOCK_RESPONSES.general;
  const idx = mockCounter[mode] % responses.length;
  mockCounter[mode] = idx + 1;

  return {
    content: responses[idx],
    mode,
  };
}
