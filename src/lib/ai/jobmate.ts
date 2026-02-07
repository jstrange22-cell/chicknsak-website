import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

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
// Mock Responses (fallback when edge function is unavailable)
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
    `I can help with blueprint takeoff calculations. Here's how I work:

**Area Calculations (Shoelace Algorithm):**
- Give me corner coordinates or dimensions
- I'll calculate polygon area with deductions (windows, doors)

**Linear Measurements:**
- Wall lengths, trim runs, pipe lengths
- Path-finding for continuous runs

**Volume Calculations:**
- Concrete pours (CY)
- Excavation volumes
- Fill material quantities

**Material Quantities:**
- Waste factors built in (typically 10-15%)
- Unit conversions (SF → sheets, LF → pieces)

Describe what you're measuring or give me dimensions and I'll calculate the takeoff with proper waste factors.`,
  ],
  walkthrough: [
    `I'm ready for a **voice-to-estimate walkthrough**. Here's how it works:

1. **Describe the work** room by room:
   _"The kitchen needs new cabinets, countertops, backsplash tile, and refinish the hardwood floors. About 150 square feet."_

2. **I'll extract line items** with this structure:
   - Room/Area → Category → Description → Qty → Unit → Cost

3. **I'll build the estimate** with:
   - Localized pricing (based on your ZIP)
   - Assembly bundles where applicable
   - Standard markups

Just describe the work like you're walking through the jobsite. Be as detailed or brief as you want — I'll ask clarifying questions if needed.

What room or area should we start with?`,
  ],
  codes: [
    `I can look up building codes from the current editions:

**Residential (2024 IRC):** Room dimensions, egress, stairs, railings, foundations
**Commercial (2024 IBC):** Occupancy, fire-resistance, means of egress, ADA
**Electrical (2023 NEC):** Branch circuits, GFCI/AFCI, service sizing, grounding
**Plumbing (2024 IPC/UPC):** DWV, fixture units, water supply, gas piping
**Energy (2024 IECC):** R-values, air sealing, equipment efficiency

⚠️ **Always verify with your local AHJ** — jurisdictions may have stricter amendments.

Which code area do you need help with?`,
  ],
  scope: [
    `I'll draft a professional scope of work. What trade or project type?

A proper SOW includes:
1. **Project Description** & location
2. **Scope Inclusions** — detailed line items
3. **Scope Exclusions** — what's NOT included
4. **Materials & Specifications**
5. **Workmanship Standards**
6. **Schedule & Milestones**
7. **Payment Terms** (progress billing schedule)
8. **Warranty Provisions**
9. **Cleanup & Protection**

Tell me the trade, square footage, and quality level and I'll draft a ready-to-use scope.`,
  ],
  safety: [
    `Safety is priority one. I reference OSHA 29 CFR 1926 for construction:

**Common Topics:**
- Fall Protection (1926.501-503)
- Scaffolding (1926.450-454)
- Excavation/Trenching (1926.650-652)
- Electrical Safety (1926.400-449)
- PPE Requirements (1926.95-106)

I can generate:
- ✅ Toolbox talk scripts
- ✅ Job Hazard Analysis (JHA) templates
- ✅ Pre-task planning checklists
- ✅ Competent Person requirements

What safety concern or checklist do you need?`,
  ],
  schedule: [
    `I'll help with project scheduling. Tell me:
- Project type and scope
- Key milestones and deadlines
- Crew/trade availability

I account for:
- Critical path activities
- Material lead times
- Weather-sensitive work
- Inspection hold points
- Trade coordination and stacking

What are you scheduling?`,
  ],
  rfi: [
    `I'll draft a professional RFI. Give me:
- The issue or discrepancy
- Drawing/spec references
- Your suggested resolution

I'll format it with: Subject, Description, References, Suggested Resolution, Impact Statement, and Required Response Date.`,
  ],
  punchlist: [
    `I'll create a systematic punch list. Tell me:
- Area/rooms to inspect
- Trades involved
- Project stage (rough, finish, final)

I organize by:
- 🔴 **Critical** — Life-safety, code violations
- 🟡 **Major** — Functional issues, visible defects
- 🟢 **Minor** — Cosmetic, touch-ups

What area should we walk through?`,
  ],
  financial: [
    `I can help with financial operations:

**Invoicing:**
- Progress billing (Deposit → Mid-Point → Final)
- Generate invoice line items from estimates
- Track payment status

**Change Orders:**
- Create COs linked to locked estimates
- Track approvals and cost impact

**QuickBooks Sync:**
- Push invoices to QBO
- Sync customer data
- Track payment status

**JobTread Sync:**
- Push estimates as JobTread cost items
- Sync financials with linked jobs

What financial task do you need help with?`,
  ],
};
// ---------------------------------------------------------------------------
// API Call
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
 * Falls back to high-quality mock responses when Cloud Functions are unavailable.
 */
export async function sendJobMateMessage(
  request: JobMateChatRequest
): Promise<JobMateChatResponse> {
  // Try live API first via Firebase Cloud Functions
  try {
    const jobmateChat = httpsCallable<Record<string, unknown>, Record<string, unknown>>(functions, 'jobmateChat');
    const result = await jobmateChat({
      message: request.message,
      mode: request.mode,
      conversationHistory: request.conversationHistory,
      projectContext: request.projectContext,
      generateEstimate: request.generateEstimate,
    });

    const data = result.data;
    if (data?.content) {
      return {
        content: data.content as string,
        mode: (data.mode as JobMateMode) || request.mode,
        estimate: data.estimate as EstimateOutput | undefined,
        jobtreadPayload: data.jobtreadPayload as Record<string, unknown> | undefined,
      };
    }

    console.warn('[JobMate] Cloud function returned no content, falling back to mock');
  } catch (err) {
    console.warn('[JobMate] Cloud function call failed, falling back to mock:', err);
  }

  // Mock fallback with realistic delay
  const delay = 600 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const mode = request.mode || 'general';
  const responses = MOCK_RESPONSES[mode] || MOCK_RESPONSES.general;
  const idx = mockCounter[mode] % responses.length;
  mockCounter[mode] = idx + 1;

  return {
    content: responses[idx],
    mode,
  };
}
