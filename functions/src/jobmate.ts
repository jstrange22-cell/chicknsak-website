/**
 * JobMate AI Cloud Function
 *
 * Provides the `jobmateChat` callable Cloud Function that connects to
 * both Claude (Anthropic) and Google Gemini for construction-specific
 * AI assistance inside ProjectWorks.
 *
 * Strategy:
 *   1. Try Claude (Anthropic) first — best for detailed construction reasoning
 *   2. Fall back to Gemini if Claude fails or is unavailable
 *   3. Return structured data for estimates when requested
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// Secrets
// ============================================================================

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: "user" | "assistant";
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

interface JobMateRequest {
  message: string;
  mode: string;
  conversationHistory: ChatMessage[];
  projectContext?: ProjectContext;
  generateEstimate?: boolean;
}

// ============================================================================
// System Prompts
// ============================================================================

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

  general: "",
};

function buildSystemPrompt(mode: string, projectContext?: ProjectContext): string {
  let prompt = BASE_SYSTEM_PROMPT;

  const modePrompt = MODE_PROMPTS[mode] || "";
  if (modePrompt) {
    prompt += "\n\n" + modePrompt;
  }

  if (projectContext) {
    prompt += "\n\nCurrent Project Context:";
    if (projectContext.projectName) prompt += `\n- Project: ${projectContext.projectName}`;
    if (projectContext.projectType) prompt += `\n- Type: ${projectContext.projectType}`;
    if (projectContext.status) prompt += `\n- Status: ${projectContext.status}`;
    if (projectContext.customerName) prompt += `\n- Customer: ${projectContext.customerName}`;
    if (projectContext.address) {
      const addr = projectContext.address;
      const parts = [addr.city, addr.state, addr.zip].filter(Boolean);
      if (parts.length > 0) prompt += `\n- Location: ${parts.join(", ")}`;
    }
    if (projectContext.progress != null) prompt += `\n- Progress: ${projectContext.progress}%`;
  }

  return prompt;
}

// ============================================================================
// AI Providers
// ============================================================================

async function callClaude(
  systemPrompt: string,
  conversationHistory: ChatMessage[],
  userMessage: string,
  apiKey: string
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Add conversation history
  for (const msg of conversationHistory.slice(-20)) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current message
  messages.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  // Extract text from response
  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  return textBlocks.map((b) => b.text).join("\n") || "I apologize, I could not generate a response.";
}

async function callGemini(
  systemPrompt: string,
  conversationHistory: ChatMessage[],
  userMessage: string,
  apiKey: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  // Build chat history for Gemini
  const history = conversationHistory.slice(-20).map((msg) => ({
    role: msg.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(userMessage);
  const response = result.response;

  return response.text() || "I apologize, I could not generate a response.";
}

// ============================================================================
// Cloud Function
// ============================================================================

export const jobmateChat = onCall(
  {
    region: "us-central1",
    secrets: [anthropicApiKey, geminiApiKey],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in to use JobMate.");
    }

    const data = request.data as JobMateRequest;

    if (!data.message || typeof data.message !== "string") {
      throw new HttpsError("invalid-argument", "Message is required.");
    }

    const mode = data.mode || "general";
    const conversationHistory = data.conversationHistory || [];
    const systemPrompt = buildSystemPrompt(mode, data.projectContext);

    let content: string | null = null;
    let provider = "none";

    // Strategy: Try Claude first, fall back to Gemini
    const claudeKey = anthropicApiKey.value();
    const gemKey = geminiApiKey.value();

    if (claudeKey) {
      try {
        content = await callClaude(systemPrompt, conversationHistory, data.message, claudeKey);
        provider = "claude";
      } catch (err) {
        console.error("[JobMate] Claude failed:", err instanceof Error ? err.message : err);
      }
    }

    if (!content && gemKey) {
      try {
        content = await callGemini(systemPrompt, conversationHistory, data.message, gemKey);
        provider = "gemini";
      } catch (err) {
        console.error("[JobMate] Gemini failed:", err instanceof Error ? err.message : err);
      }
    }

    if (!content) {
      throw new HttpsError(
        "unavailable",
        "AI service is temporarily unavailable. Please try again in a moment."
      );
    }

    console.log(`[JobMate] Response generated via ${provider} (mode: ${mode})`);

    return {
      content,
      mode,
      provider,
    };
  }
);
