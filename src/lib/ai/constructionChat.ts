import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatCategory =
  | 'general'
  | 'estimate'
  | 'codes'
  | 'howto'
  | 'videos'
  | 'blueprint'
  | 'scope'
  | 'safety'
  | 'schedule'
  | 'rfi'
  | 'punchlist';

export type AIModel = 'gemini' | 'claude';

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProjectContext {
  projectName?: string;
  projectType?: string;
  status?: string;
  address?: { city?: string; state?: string };
  progress?: number;
}

export interface ConstructionChatRequest {
  message: string;
  category: ChatCategory;
  model: AIModel;
  conversationHistory: ChatMessagePayload[];
  projectContext?: ProjectContext;
}

export interface ConstructionChatResponse {
  content: string;
  category: ChatCategory;
  model: AIModel;
}

// ---------------------------------------------------------------------------
// Mock fallback responses (used when Cloud Functions are unavailable)
// ---------------------------------------------------------------------------

const MOCK_RESPONSES: Record<ChatCategory, string[]> = {
  general: [
    "I'm your AI construction assistant powered by 30+ years of field experience. I can help with cost estimates, building code lookups, step-by-step how-to guides, scope of work drafting, safety/OSHA compliance, scheduling, RFIs, and punch lists.\n\nWhat would you like help with today? Use the quick action buttons or just ask me anything construction-related.",
    "Great question! Based on standard construction practices, here's what I'd recommend:\n\n1. **Assess the scope** -- Determine the full extent of work needed\n2. **Check local requirements** -- Verify permits and inspections needed\n3. **Get material quotes** -- Contact at least 3 suppliers for pricing\n4. **Plan the timeline** -- Account for weather and material lead times\n\nWould you like me to dive deeper into any of these areas?",
  ],
  estimate: [
    "I'd be happy to help with a cost estimate! To give you accurate numbers, I need a few details:\n\n**Project Basics:**\n- Type of project (new build, remodel, addition, repair)\n- Square footage or dimensions\n- Location (costs vary significantly by region)\n\n**Scope Details:**\n- Materials preference (budget, standard, mid-range, high-end)\n- Any specialty work (electrical, plumbing, HVAC)\n- Timeline requirements\n\nWhat type of project are you estimating?",
    "Based on current 2025 market rates, here's a rough breakdown:\n\n| Category | Cost Range (per SF) |\n|----------|--------------------|\n| Foundation | $8 - $25 |\n| Framing | $7 - $16 |\n| Roofing | $5 - $12 |\n| Electrical | $4 - $10 |\n| Plumbing | $4 - $12 |\n| HVAC | $3 - $8 |\n| Drywall & Paint | $3 - $8 |\n| Flooring | $3 - $15 |\n\n**Note:** These are preliminary estimates for budgeting purposes. Obtain competitive bids from licensed contractors for actual project pricing. Costs vary by region, material choices, and current market conditions.\n\nWould you like me to estimate a specific part of the project?",
  ],
  codes: [
    "I can help you navigate building codes. Here are the major code bodies I reference:\n\n**Residential (IRC):**\n- Room dimensions, egress, stairs, railings\n- Foundation, floor, wall, and roof construction\n- Fire separation and smoke/CO alarms\n\n**Commercial (IBC):**\n- Occupancy classifications and allowable areas\n- Fire-resistance ratings and means of egress\n- Accessibility (ADA/ICC A117.1)\n\n**Specialty Codes:**\n- **NEC** (Electrical): Branch circuits, GFCI/AFCI, service sizing\n- **IPC/UPC** (Plumbing): DWV, fixture units, water supply\n- **IECC** (Energy): R-values, air sealing, equipment efficiency\n\n**Important:** Code interpretations are subject to your local Authority Having Jurisdiction (AHJ). Always verify with your local building department.\n\nWhich code area do you need help with?",
    "Great question about deck railing requirements. Per the **IRC (International Residential Code) 2024 edition**:\n\n**Guard Height (R312.1.1):**\n- Minimum **36 inches** for residential decks and porches\n- Minimum **42 inches** for commercial applications (IBC)\n\n**Baluster Spacing (R312.1.3):**\n- Maximum **4 inches** between balusters (4-inch sphere rule)\n- This prevents small children from passing through\n\n**Structural Requirements (R301.5):**\n- Must withstand **200 lbs concentrated load** at any point along the top\n- Must withstand **50 lbs/linear foot** distributed load along the top\n- Guards required when deck surface is **30+ inches** above grade\n\n**Note:** Always verify with your local building department, as jurisdictions may have stricter requirements than the model code.\n\nWould you like to know about any other code requirements?",
  ],
  howto: [
    "I'd be happy to provide a step-by-step guide! Here are some common topics:\n\n**Framing & Structure:**\n- Framing interior/exterior walls\n- Installing floor joists and subfloor\n- Building deck substructure\n\n**Finishing:**\n- Hanging and finishing drywall\n- Tile installation (floor, shower)\n- Trim and molding installation\n\n**Exterior:**\n- Siding installation\n- Window and door flashing\n- Pouring concrete flatwork\n\n**Safety Note:** Always wear appropriate PPE for any task, and verify that work requiring permits has been properly permitted before beginning.\n\nWhat task would you like step-by-step instructions for?",
  ],
  videos: [
    "I'll help you find construction tutorial videos! Here are top-rated channels:\n\n**Recommended Creators:**\n- **Essential Craftsman** -- Foundations, framing, general construction\n- **Matt Risinger** -- Building science and best practices\n- **This Old House** -- Renovations and proven techniques\n- **Home RenoVision DIY** -- Practical how-to tutorials\n- **The Honest Carpenter** -- Trim, framing, and finish work\n- **Sal DiBlasi** -- Professional tile installation\n- **StarrTile** -- Tile tips and tricks\n\nTell me what you're working on, and I'll suggest specific video searches tailored to your needs.\n\nWhat construction topic would you like video tutorials for?",
  ],
  blueprint: [
    "I can help you understand blueprints and construction plans!\n\n**Plan Types:**\n- **A-sheets** = Architectural (floor plans, elevations, sections)\n- **S-sheets** = Structural (foundations, framing plans)\n- **M-sheets** = Mechanical (HVAC layout and details)\n- **E-sheets** = Electrical (power, lighting, panel schedules)\n- **P-sheets** = Plumbing (supply, drain, fixture locations)\n\n**Common Symbols:**\n- **Dashed lines** = Items above (cabinets, beams, overhangs)\n- **Center lines** (long-short-long) = Symmetry axis\n- **Section cut lines** = Where cross-sections are taken\n- **Detail bubbles** = Reference to larger-scale detail drawings\n\n**Reading Tips:**\n- Always check the scale noted on each sheet\n- Cross-reference structural plans with architectural\n- Look at the drawing index for a complete sheet list\n\nWhat part of your plans do you need help understanding?",
  ],
  scope: [
    "I'll help you write a professional scope of work! To get started, I need:\n\n1. **Trade or project type** -- What work is being scoped? (e.g., framing, electrical, kitchen remodel, full build)\n2. **Intended use** -- Is this for a subcontractor bid, customer proposal, or internal planning?\n3. **Key details** -- Approximate size, quality level, any special requirements\n\nA good scope of work includes:\n- Project description and location\n- Detailed scope inclusions (specific work items)\n- Scope exclusions (what's NOT included)\n- Materials and specifications\n- Workmanship standards\n- Schedule expectations\n- Payment terms\n- Warranty provisions\n- Cleanup and protection responsibilities\n\nWhat trade or project type would you like me to scope?",
  ],
  safety: [
    "Safety is priority one on every jobsite. I can help with:\n\n**OSHA Compliance (29 CFR 1926):**\n- Fall protection (1926.501-503)\n- Scaffolding (1926.450-454)\n- Excavation/trenching (1926.650-652)\n- Electrical safety (1926.400-449)\n- PPE requirements (1926.95-106)\n\n**Common Safety Resources:**\n- Toolbox talk topics and scripts\n- Job Hazard Analysis (JHA) templates\n- Pre-task planning checklists\n- Competent Person requirements\n- Permit-required activities (confined space, hot work)\n\n**Remember:** OSHA requires a competent person on every jobsite who can identify hazards and has authority to correct them.\n\nWhat safety concern or checklist do you need help with?",
  ],
  schedule: [
    "I'll help with project scheduling! To create an effective schedule, I need:\n\n1. **Project type and scope** -- What are you building/renovating?\n2. **Key milestones** -- Permits, inspections, substantial completion, move-in\n3. **Crew availability** -- How many crews/trades available?\n\n**Scheduling Fundamentals:**\n- Identify critical path activities (longest sequence)\n- Build in float for weather delays and material lead times\n- Coordinate trade stacking (multiple trades working simultaneously)\n- Plan inspection hold points\n- Account for curing times (concrete, paint, adhesives)\n\n**Typical Residential Schedule Benchmarks:**\n- Foundation: 1-2 weeks\n- Framing: 2-4 weeks\n- Rough MEP: 1-2 weeks each\n- Insulation/drywall: 2-3 weeks\n- Finishes: 3-6 weeks\n- Punchlist/closeout: 1-2 weeks\n\nWhat type of project are you scheduling?",
  ],
  rfi: [
    "I'll help you draft a professional RFI. A well-written RFI should include:\n\n**RFI Structure:**\n1. **Project name and number**\n2. **RFI number** (sequential tracking)\n3. **Date submitted**\n4. **Subject line** (clear, specific)\n5. **Description of issue** -- What exactly is unclear, conflicting, or missing?\n6. **Drawing/spec references** -- Which sheets and sections are affected?\n7. **Suggested resolution** -- Your recommended approach (shows initiative)\n8. **Impact statement** -- Schedule and/or cost impact if not resolved promptly\n9. **Required response date**\n\n**Tips for Effective RFIs:**\n- Be specific -- reference exact drawing numbers and details\n- Include photos or markups when possible\n- One issue per RFI (don't bundle)\n- Propose a solution when you can\n- Document the schedule impact of delayed responses\n\nWhat issue or question needs to be documented as an RFI?",
  ],
  punchlist: [
    "I'll help you create a thorough punch list! For the best results, tell me:\n\n1. **Project type** -- New construction, remodel, or specific scope?\n2. **Areas/rooms to inspect** -- Which spaces need punchlist?\n3. **Trades involved** -- All trades, or specific ones?\n\n**Punch List Best Practices:**\n- Walk each room systematically (ceiling to floor, left to right)\n- Categorize by severity:\n  - **Critical** -- Life-safety, code violations, functional failures\n  - **Major** -- Functional issues, visible defects, incomplete work\n  - **Minor** -- Cosmetic, touch-up, adjustments\n- Include specific location for each item\n- Note the responsible trade for each deficiency\n- Take photos of each item for documentation\n- Set completion deadlines\n\n**Common Punchlist Categories:**\n- Paint touch-ups and wall damage\n- Door/hardware adjustments\n- Trim gaps and caulking\n- MEP fixture issues\n- Flooring defects\n- Cleaning items\n- Exterior/landscape items\n\nWhat area or trade should we create a punch list for?",
  ],
};

// ---------------------------------------------------------------------------
// API Call
// ---------------------------------------------------------------------------

let mockCounter: Record<ChatCategory, number> = {
  general: 0, estimate: 0, codes: 0, howto: 0, videos: 0, blueprint: 0,
  scope: 0, safety: 0, schedule: 0, rfi: 0, punchlist: 0,
};

export function resetMockCounters() {
  mockCounter = {
    general: 0, estimate: 0, codes: 0, howto: 0, videos: 0, blueprint: 0,
    scope: 0, safety: 0, schedule: 0, rfi: 0, punchlist: 0,
  };
}

/**
 * Send a message to the AI construction chat.
 * Falls back to high-quality mock responses when Cloud Functions are unavailable.
 */
export async function sendConstructionChatMessage(
  request: ConstructionChatRequest
): Promise<ConstructionChatResponse> {
  // Try live API first via Firebase Cloud Functions
  try {
    const aiConstructionChat = httpsCallable<Record<string, unknown>, Record<string, unknown>>(functions, 'aiConstructionChat');
    const result = await aiConstructionChat({
      message: request.message,
      category: request.category,
      model: request.model,
      conversationHistory: request.conversationHistory,
      projectContext: request.projectContext,
    });

    const data = result.data;
    if (data?.content) {
      return {
        content: data.content as string,
        category: (data.category as ChatCategory) || request.category,
        model: (data.model as AIModel) || 'claude',
      };
    }

    // Fall through to mock if cloud function returns no content
    console.warn('[AI Chat] Cloud function returned no content, falling back to mock');
  } catch (err) {
    console.warn('[AI Chat] Cloud function call failed, falling back to mock:', err);
  }

  // Mock fallback with realistic delay
  const delay = 600 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const cat = request.category || 'general';
  const responses = MOCK_RESPONSES[cat] || MOCK_RESPONSES.general;
  const idx = mockCounter[cat] % responses.length;
  mockCounter[cat] = idx + 1;

  return {
    content: responses[idx],
    category: cat,
    model: request.model,
  };
}
