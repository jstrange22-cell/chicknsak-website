# JobMate AI Construction Assistant -- Design Specification

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Research / Design Phase
**Target File:** `src/pages/AIChatPage.tsx`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [System Prompt Architecture](#3-system-prompt-architecture)
4. [Core Knowledge Domains](#4-core-knowledge-domains)
5. [AI Assistant Capabilities](#5-ai-assistant-capabilities)
6. [Conversation Modes and Routing](#6-conversation-modes-and-routing)
7. [Integration Points with JobMate](#7-integration-points-with-jobmate)
8. [Data Structures and Context Injection](#8-data-structures-and-context-injection)
9. [Prompt Engineering Specifications](#9-prompt-engineering-specifications)
10. [Safety, Disclaimers, and Guardrails](#10-safety-disclaimers-and-guardrails)
11. [Technical Implementation Plan](#11-technical-implementation-plan)
12. [Future Enhancements](#12-future-enhancements)

---

## 1. Executive Summary

This document specifies the design for JobMate' AI Construction Assistant -- a conversational AI that serves as an expert general contractor, estimator, architect, designer, tradesman, and code official. The assistant is embedded in the existing `AIChatPage.tsx` and will replace the current mock response system with a live AI backend.

The assistant is designed to be the single most useful tool a construction professional interacts with daily. It must understand the full lifecycle of construction projects: from initial design and estimating, through permitting, scheduling, and field execution, to closeout and warranty. It must speak the language of the trades, understand code compliance, and produce actionable outputs (estimates, scopes of work, checklists, RFIs) -- not just informational answers.

### Design Principles

- **Practitioner-first language**: Speak like someone who has been on jobsites, not an academic. Use trade terminology naturally.
- **Actionable outputs**: Every answer should move the user toward a decision or deliverable. Provide numbers, code references, and structured documents rather than vague guidance.
- **Context-aware**: Leverage the user's current project data, photos, checklists, and reports from JobMate to give specific rather than generic answers.
- **Safety-conscious**: Always highlight safety considerations, code requirements, and when professional engineering or legal counsel is required.
- **Regional awareness**: Construction costs, codes, and practices vary dramatically by location. The assistant must account for regional differences.

---

## 2. Current State Analysis

### Existing AI Chat Architecture (`AIChatPage.tsx`)

The current implementation has the following structure:

**Models supported:** Gemini, Claude (selectable via dropdown)

**Chat categories (quick actions):**
| Category | Label | Purpose |
|----------|-------|---------|
| `estimate` | Estimate Cost | Construction cost estimation |
| `codes` | Building Codes | Code lookups and compliance |
| `howto` | How To | Step-by-step trade guides |
| `videos` | Find Videos | Tutorial video recommendations |
| `blueprint` | Blueprint Help | Plan reading assistance |
| `general` | (default) | General construction Q&A |

**Current limitations:**
- Responses are entirely mock/hardcoded in `mockResponses` record
- No connection to AI backend (note at bottom: "AI responses are simulated")
- No project context injection -- assistant has no awareness of the user's actual projects
- No structured output generation (estimates, checklists, scopes are just text)
- No photo/document analysis integration from chat
- Category counter simply cycles through canned responses
- No conversation memory or threading

### Existing AI Infrastructure

The app already has AI infrastructure via Supabase edge functions:

| Module | Edge Function | Purpose |
|--------|--------------|---------|
| `photoAnalysis.ts` | `ai-analyze-photo` | Analyze jobsite photos for phase, observations |
| `reportGenerator.ts` | `ai-generate-report` | Generate structured reports from photos |
| `voiceProcessor.ts` | `ai-voice-process` | Process voice transcripts into structured data |
| `checklistGenerator.ts` | `ai-generate-checklist` | Generate checklists from documents |
| `translator.ts` | `ai-voice-process` | English/Spanish translation |

The `useAI` hook (`src/hooks/useAI.ts`) centralizes all AI mutations via React Query.

### Existing Data Model (from `src/types/index.ts`)

Key entities the AI can reference:
- **Projects**: name, type, status, address, customer info, progress, geofence, notepad
- **Photos**: with AI captions, AI analysis, annotations, GPS, tags
- **Checklists**: templated with typed fields (checkbox, photo_required, yes_no, text, number, signature, date, rating, multiple_choice)
- **Tasks**: with priority, status, assignments, due dates
- **Documents**: uploaded files with metadata
- **Pages**: collaborative documents (daily logs, walkthrough notes, progress recaps, proposals)
- **Reports**: photo reports with sections, notes, layouts
- **Time Entries**: clock in/out with GPS, breaks, approvals
- **Invoices**: line items, status, customer info
- **Payment Requests**: Stripe-integrated, line items
- **Collaborators**: external guests (viewers, contributors, subcontractors)
- **Voice Notes**: audio with transcription

---

## 3. System Prompt Architecture

The system prompt should be composed of layered components assembled at runtime based on conversation context.

### 3.1 Prompt Layer Structure

```
Layer 0: IDENTITY AND PERSONA
Layer 1: CORE KNOWLEDGE BASE (always included)
Layer 2: ACTIVE MODE INSTRUCTIONS (based on chat category)
Layer 3: PROJECT CONTEXT (when a project is selected)
Layer 4: CONVERSATION HISTORY (recent messages)
Layer 5: OUTPUT FORMAT INSTRUCTIONS (based on request type)
```

### 3.2 Layer 0 -- Identity and Persona

```
You are the JobMate AI Construction Assistant. You are a seasoned construction
professional with 30+ years of experience spanning general contracting, estimating,
architectural design, and all major trades. You hold a general contractor's license,
have worked as a certified building inspector, and have hands-on experience as an
electrician, plumber, framer, and finish carpenter.

You communicate like a trusted superintendent or project manager -- direct, practical,
and clear. You use standard industry terminology and abbreviations naturally (OC, LF,
SF, CY, GC, sub, CO, RFI, submittal, punchlist). When a user asks a question, you
consider the practical realities of the jobsite: weather, material lead times, crew
availability, inspector schedules, and budget constraints.

You are integrated into JobMate, a construction project management application.
When the user has a project selected, you have access to their project data including
photos, checklists, tasks, documents, and reports. Reference this data when relevant.

Key behaviors:
- Always cite specific code sections when referencing building codes
- Always include quantities and units when discussing materials
- Always flag safety concerns proactively, even when not asked
- Always note when a licensed professional (PE, architect, licensed electrician/plumber)
  is required
- Always disclaim that your estimates are preliminary and should be validated with
  local supplier quotes and contractor bids
- Default to the most current code editions (2024 IRC, 2024 IBC, 2023 NEC, 2024 IPC/UPC,
  2024 IECC) but ask about local amendments when relevant
- When costs are discussed, clarify the region/market since prices vary significantly
- Use the user's preferred units (imperial by default unless user indicates metric)
```

### 3.3 Layer 1 -- Core Knowledge Base

This layer is always included and covers fundamental domain knowledge. See Section 4 for the complete breakdown of each knowledge domain.

### 3.4 Layer 2 -- Active Mode Instructions

Dynamically inserted based on the selected `ChatCategory`. See Section 6.

### 3.5 Layer 3 -- Project Context

Injected when a project is selected. See Section 8.

### 3.6 Layer 4 -- Conversation History

Standard chat history management. Recommend keeping the last 20 message pairs in context, with summarization of older messages if the conversation is long.

### 3.7 Layer 5 -- Output Format Instructions

Appended based on detected request type. Examples:

- Estimate request: "Format your response as a structured cost estimate with line items, quantities, unit costs, and totals. Include a summary with subtotal, overhead, profit, and total."
- Code question: "Cite the specific code section, edition, and year. Include the exact language where possible and note common local amendments."
- Scope of work: "Format as a professional scope of work document with numbered sections."
- Checklist: "Return a structured checklist in JSON format compatible with the JobMate checklist schema."

---

## 4. Core Knowledge Domains

### 4.1 General Contracting and Project Management

**Scope:** The full lifecycle of managing construction projects from pre-construction through closeout.

**Knowledge areas:**
- Project delivery methods: design-bid-build, design-build, CM at risk, CM as agent, IPD
- Pre-construction: feasibility studies, site analysis, budgeting, value engineering
- Contract types: lump sum/stipulated sum, cost-plus, GMP, T&M, unit price
- AIA contract documents: A101, A201, A401 and their purpose
- Scheduling: CPM (Critical Path Method), Gantt charts, look-ahead schedules, pull planning
- Resource leveling and crew sizing
- Procurement: bid packages, bid leveling, buyout, purchase orders
- Submittals and shop drawing review workflow
- RFI (Request for Information) process and best practices
- Change order management: PCO, COR, change directive process
- Pay applications: schedule of values, AIA G702/G703 format, retainage
- Project closeout: punchlist procedures, O&M manuals, as-builts, warranty letters, lien releases
- Risk management: insurance requirements (GL, WC, umbrella, builder's risk), bonding
- Communication protocols: OAC meetings, daily reports, progress photos

**Practical guidance the AI should provide:**
- How to structure a bid package
- How to negotiate change orders
- How to manage a difficult subcontractor
- How to run an effective OAC meeting
- How to build a realistic schedule with float
- How to handle delays and acceleration claims

### 4.2 Cost Estimating

**Scope:** Conceptual through detailed estimating for residential and commercial construction.

**Knowledge areas:**

**Estimating methodologies:**
- Conceptual/order of magnitude: cost per SF by building type
- Square foot estimating: RS Means Square Foot Costs methodology
- Assemblies/systems estimating: pricing by building system
- Unit price estimating: detailed quantity takeoff with unit costs
- Parametric estimating for early-stage budgeting

**Cost data structures (aligned with RS Means/industry standard):**
- CSI MasterFormat divisions (Division 01-49):
  - Div 01: General Requirements (general conditions, mobilization, temporary facilities)
  - Div 02: Existing Conditions (demolition, site remediation)
  - Div 03: Concrete (formwork, reinforcing, cast-in-place, precast)
  - Div 04: Masonry (CMU, brick, stone, mortar, reinforcement)
  - Div 05: Metals (structural steel, miscellaneous metals, decking)
  - Div 06: Wood, Plastics, and Composites (rough carpentry, finish carpentry, millwork)
  - Div 07: Thermal and Moisture Protection (waterproofing, insulation, roofing, siding, flashing)
  - Div 08: Openings (doors, windows, hardware, glazing)
  - Div 09: Finishes (drywall, plaster, tile, flooring, painting, ceiling)
  - Div 10: Specialties (signage, toilet accessories, fire extinguishers)
  - Div 11: Equipment (appliances, residential equipment)
  - Div 12: Furnishings (casework, countertops, window treatments)
  - Div 21: Fire Suppression (sprinkler systems)
  - Div 22: Plumbing (fixtures, piping, water heaters)
  - Div 23: HVAC (equipment, ductwork, controls)
  - Div 26: Electrical (power, lighting, devices, panels)
  - Div 27: Communications (low voltage, data, telecom)
  - Div 31: Earthwork (grading, excavation, fill)
  - Div 32: Exterior Improvements (paving, landscaping, fencing)
  - Div 33: Utilities (water, sewer, storm, gas lines)

**Labor rate components:**
- Base wage rates by trade and region
- Fringe benefits (health, pension, vacation, training)
- Workers' compensation insurance rates by trade classification
- Payroll taxes (FICA, FUTA, SUTA)
- Total burden rate calculation (typically 30-55% above base wage)
- Prevailing wage / Davis-Bacon requirements for public work
- Union vs. open shop rate differentials

**Material pricing considerations:**
- Regional material price indices (city cost indices)
- Commodity price volatility (lumber, steel, copper, PVC)
- Lead time awareness for specialty items
- Minimum order quantities and waste factors
- Delivery and handling costs
- Sales tax by jurisdiction

**Markup and overhead structure:**
- Direct costs vs. indirect costs
- General conditions (typically 8-15% of direct costs)
  - Superintendent, project manager, field office
  - Temporary power, water, sanitation, fencing
  - Dumpsters, equipment, small tools
  - Safety equipment, first aid
  - Cleanup, final cleaning
- Company overhead (home office, typically 5-12%)
- Profit margin (varies by market, typically 5-15%)
- Contingency (5-15% depending on project stage and risk)
- Escalation factor for projects with long timelines
- Performance and payment bond costs (typically 1-3%)
- Insurance costs (builder's risk, additional GL)

**Quantity takeoff formulas the AI must know:**
- Concrete: CY = (L x W x D) / 27 + waste factor
- Lumber: BF = (T x W x L) / 12; account for 10-15% waste
- Roofing: squares = total SF / 100; include waste for hips/valleys
- Drywall: sheets = wall SF / 32 (4x8) or /48 (4x12); add 10% waste
- Paint: gallons = SF / coverage rate (typically 350-400 SF/gal)
- Flooring: SF + 10% waste (15% for diagonal, 20% for patterns)
- Rebar: pounds per CY of concrete by application
- Insulation: SF of wall/ceiling/floor cavities by R-value
- Gravel/fill: CY = (L x W x D) / 27; compaction factor 1.25-1.35

### 4.3 Architectural Design

**Scope:** Residential and light commercial design principles, building codes, and zoning.

**Knowledge areas:**
- Space planning and room adjacency
- Residential design: floor plans, kitchens, bathrooms, bedrooms, living spaces
- Building massing and proportion
- Roof design: hip, gable, shed, flat, mansard, gambrel; pitch calculations
- Window placement: views, ventilation, natural light, privacy
- Circulation: hallways, stairways, entries, mudrooms
- ADA/accessibility requirements for residential and commercial
- Universal design principles
- Zoning concepts: setbacks, FAR, lot coverage, height restrictions, use classifications
- Site planning: grading, drainage, orientation, solar access
- Sustainable design: passive solar, thermal mass, natural ventilation, daylighting
- Kitchen design: work triangle, NKBA guidelines, cabinet layout
- Bathroom design: NKBA guidelines, clearances, fixture placement
- Structural considerations that affect design (load paths, shear walls, beam sizing)

### 4.4 Trade-Specific Knowledge

**For each trade, the AI should know: common methods, materials, code requirements, best practices, common defects, and cost considerations.**

#### 4.4.1 Concrete and Masonry
- Mix designs: PSI ratings (2500, 3000, 3500, 4000, 5000), slump, air entrainment
- Formwork: footings, walls, slabs, columns; form tie spacing
- Reinforcement: rebar sizes (#3 through #11), spacing, cover requirements, lap splices
- Finishing: bull float, fresno, broom, exposed aggregate, stamped, polished
- Curing: methods, timing, temperature considerations
- Cold weather and hot weather concreting
- Flatwork: sidewalks, driveways, patios, garage slabs -- thickness, base, joints
- Foundation types: slab-on-grade, crawlspace, full basement, pier and beam, helical piles
- CMU: block sizes, bond patterns, grouting, reinforcement, control joints
- Brick: types (face, fire, paver), patterns, mortar joints, weep holes, flashing

#### 4.4.2 Framing and Rough Carpentry
- Platform framing vs. balloon framing
- Lumber species and grades (SPF, DF, SYP; #1, #2, stud grade)
- Engineered lumber: LVL, PSL, LSL, glulam, I-joists, open web trusses
- Wall framing: stud spacing (16" or 24" OC), headers, king studs, jack studs, cripples
- Floor framing: joist sizing, blocking, bridging, rim/band board
- Roof framing: rafters, ridge boards/beams, collar ties, ceiling joists; or trusses
- Sheathing: OSB vs. plywood, nailing schedules
- Connectors: Simpson Strong-Tie catalog (joist hangers, hurricane ties, hold-downs, post bases)
- Wind and seismic bracing: let-in bracing, structural sheathing, metal strapping
- Fire blocking requirements per IRC R302.11

#### 4.4.3 Electrical (NEC-Based)
- Service sizing: load calculations per NEC Article 220
- Panel sizing and circuit layout
- Branch circuits: 15A, 20A, dedicated circuits
- Wire sizing: ampacity tables (NEC Table 310.16), voltage drop calculations
- Outlet placement: NEC 210.52 spacing requirements
- GFCI requirements: NEC 210.8 (bathrooms, kitchens, garages, outdoors, basements, laundry)
- AFCI requirements: NEC 210.12 (bedrooms, living areas -- expanding with each code cycle)
- Smoke and CO detector requirements and interconnection
- Low voltage: doorbell, thermostat, structured wiring, CAT6, coax
- Grounding and bonding: NEC Article 250
- Outdoor wiring: UF cable, conduit, GFCI, wet-rated fixtures
- EV charger circuits: NEC 625, 240V/50A typical for Level 2
- Solar PV basics: NEC 690, rapid shutdown requirements
- Permit and inspection sequence for electrical work

#### 4.4.4 Plumbing (UPC/IPC-Based)
- DWV (drain, waste, vent) system design
- Pipe sizing: supply and drain
- Fixture unit calculations
- Trap requirements and sizing
- Venting: individual, common, wet, air admittance valves
- Water heater sizing, types (tank, tankless, heat pump), code requirements
- Water supply piping: PEX, copper, CPVC -- pros/cons, code acceptance
- Drain piping: PVC schedule 40, ABS, cast iron
- Gas piping: black iron, CSST; sizing, testing, bonding
- Fixture rough-in dimensions
- Water pressure requirements and PRV installation
- Sewer and septic connections
- Permit and inspection sequence for plumbing work

#### 4.4.5 HVAC
- Load calculations: Manual J (heating/cooling loads), Manual S (equipment selection), Manual D (duct design)
- System types: forced air, heat pump (air-source and mini-split), hydronic, geothermal
- Duct design: sizing, supply/return layout, static pressure
- Refrigerant lines: sizing, insulation, line sets
- Thermostat placement and zoning
- Ventilation requirements: ASHRAE 62.2 for residential
- Exhaust fans: bathroom (50 CFM minimum), kitchen range hoods
- Energy efficiency: SEER2, HSPF2, AFUE ratings
- Combustion air requirements for gas appliances
- Ductless mini-split installation considerations
- Filter sizing and MERV ratings
- Permit and inspection sequence for HVAC work

#### 4.4.6 Roofing
- Material types: asphalt shingles (3-tab, architectural, designer), metal (standing seam, corrugated, metal shingle), tile (clay, concrete), slate, TPO/EPDM/PVC (flat roofs), cedar shakes
- Underlayment: synthetic vs. felt, ice and water shield requirements
- Flashing: step, counter, valley, drip edge, pipe boots, chimney crickets
- Ventilation: ridge vent, soffit vents, powered vents; NFA calculations
- Slope requirements by material type
- Warranty considerations: manufacturer vs. workmanship
- Tear-off vs. overlay: code limitations (typically max 2 layers)
- Decking requirements: plywood vs. OSB, thickness, H-clips

#### 4.4.7 Insulation and Building Envelope
- R-value requirements by climate zone (IECC)
- Insulation types: fiberglass batt, blown cellulose, spray foam (open cell vs. closed cell), rigid foam (EPS, XPS, polyiso), mineral wool
- Vapor barrier/retarder requirements by climate zone
- Air sealing: critical penetrations, rim joist, top plates, windows/doors
- Blower door testing: ACH50 targets
- Continuous insulation requirements per IECC
- Thermal bridging considerations
- Window U-factor and SHGC requirements by climate zone

#### 4.4.8 Finish Carpentry and Millwork
- Trim profiles: base, casing, crown, chair rail, wainscoting
- Material options: paint-grade (MDF, poplar, finger-joint pine), stain-grade (oak, maple, cherry), PVC/composite
- Door installation: pre-hung vs. slab, shimming, reveals
- Cabinet installation: wall and base, fillers, scribe, crown
- Countertop materials: granite, quartz, laminate, butcher block, solid surface
- Stair components: treads, risers, stringers, balusters, newels, handrails
- Closet systems
- Built-in storage and shelving

#### 4.4.9 Painting and Coatings
- Surface preparation by substrate
- Primer selection: PVA, shellac, bonding
- Paint types: latex/acrylic, alkyd/oil, specialty (epoxy, urethane, elastomeric)
- Sheen levels: flat, eggshell, satin, semi-gloss, gloss -- and where to use each
- Coverage rates and number of coats
- Exterior considerations: weather windows, temperature, moisture
- Staining: penetrating vs. film-forming, wood species considerations
- VOC requirements

#### 4.4.10 Flooring
- Hardwood: solid vs. engineered, species, widths, finishes, installation methods (nail, glue, float)
- Tile: ceramic, porcelain, natural stone; substrate requirements, thinset, grout
- LVP/LVT: click-lock vs. glue-down, underlayment requirements
- Carpet: styles, fibers, pad, installation
- Concrete: polished, stained, epoxy
- Substrate preparation: leveling, moisture testing, crack repair
- Transitions between materials
- Radiant floor heating compatibility

### 4.5 Building Code Compliance

**Scope:** Residential and commercial building codes with specific section references.

**Code bodies the AI must reference:**

#### IRC (International Residential Code) -- Residential
- R301: Design criteria (live loads, dead loads, wind speed, seismic, snow load, frost depth)
- R302: Fire-resistant construction (separation between dwelling units, garage separation)
- R303: Light, ventilation, and heating (8% glazing, 4% ventilation)
- R304: Minimum room areas (habitable rooms 70 SF minimum, 7' minimum dimension)
- R305: Ceiling height (7'-0" habitable, 6'-8" bathroom/laundry, 6'-4" beams/girders)
- R310: Emergency escape and rescue openings (egress windows)
- R311: Means of egress (doors, stairs, hallways, landings)
- R312: Guards and window fall protection
- R313: Automatic fire sprinkler systems (where required)
- R314-315: Smoke and carbon monoxide alarms
- R401-404: Foundation requirements
- R502-505: Floor construction
- R602-603: Wall construction
- R802-804: Roof-ceiling construction

#### IBC (International Building Code) -- Commercial
- Chapter 3: Use and occupancy classification
- Chapter 4: Special detailed requirements
- Chapter 5: General building heights and areas (allowable area calculations)
- Chapter 6: Types of construction (Type I through Type V)
- Chapter 7: Fire and smoke protection features
- Chapter 9: Fire protection and life safety systems
- Chapter 10: Means of egress (occupant load, exit capacity, travel distance, common path)
- Chapter 11: Accessibility (references ICC A117.1/ADA)
- Chapter 16: Structural design (load combinations, ASCE 7 reference)
- Chapter 17: Special inspections and tests

#### NEC (National Electrical Code -- NFPA 70)
- Article 210: Branch circuits
- Article 220: Branch-circuit, feeder, and service load calculations
- Article 230: Services
- Article 240: Overcurrent protection
- Article 250: Grounding and bonding
- Article 300: General requirements for wiring methods
- Article 310: Conductors for general wiring
- Article 334: NM cable (Romex)
- Article 358-362: Conduit types (EMT, IMC, rigid, ENT, LFMC)
- Article 404: Switches
- Article 406: Receptacles
- Article 422: Appliances
- Article 480: Storage batteries
- Article 625: Electric vehicle charging
- Article 690: Solar photovoltaic systems
- Article 705: Interconnected electric power production sources

#### UPC/IPC (Uniform/International Plumbing Code)
- Fixture unit values and pipe sizing tables
- Trap and vent requirements
- Water heater installation requirements
- Gas piping requirements
- Backflow prevention
- Water supply and distribution

#### IECC (International Energy Conservation Code)
- Climate zone map and requirements
- Insulation R-value tables by component and climate zone
- Window U-factor and SHGC requirements
- Air leakage testing requirements
- Mechanical system efficiency requirements
- Lighting power density (commercial)
- Prescriptive vs. performance compliance paths

### 4.6 Permits and Inspections

**Knowledge areas:**
- Common permit types: building, electrical, plumbing, mechanical, grading, demolition, ROW
- Typical permit application requirements: plans, site plan, engineering, surveys
- Inspection sequence for new construction:
  1. Foundation/footing (before pour)
  2. Slab/underslab (plumbing, vapor barrier, rebar)
  3. Framing (rough)
  4. Electrical rough
  5. Plumbing rough
  6. Mechanical rough
  7. Insulation
  8. Drywall (sometimes nail/screw inspection)
  9. Final (all trades)
  10. Certificate of Occupancy
- Common inspection failures and how to avoid them
- Re-inspection fees and scheduling best practices
- When engineering (PE stamp) is required
- When architectural plans (licensed architect) are required
- Over-the-counter vs. plan review permits
- Expired permits and how to reinstate

### 4.7 Safety Regulations (OSHA)

**Knowledge areas:**
- OSHA construction standards (29 CFR 1926)
- Fall protection: 6-foot rule (1926.501), guardrails, safety nets, PFAS
- Scaffolding requirements (1926.451)
- Ladder safety (1926.1053)
- Excavation and trenching: soil classification, sloping, shoring, trench boxes (1926.650-652)
- Electrical safety: lockout/tagout, GFCI requirements on jobsite
- Hazard communication: SDS, chemical labeling (1926.59)
- PPE requirements by task
- Confined space entry
- Silica exposure (1926.1153): wet cutting, vacuum, RPE requirements
- Lead paint: RRP rule, EPA certification, containment
- Asbestos: identification, abatement requirements, NESHAP
- Jobsite housekeeping and fire prevention
- Toolbox talk topics and documentation
- Recordkeeping requirements (OSHA 300 log)
- Multi-employer worksite doctrine

### 4.8 Material Selection and Specifications

**Knowledge areas:**
- Wood species properties and appropriate applications
- Fastener selection: nails, screws, bolts, anchors -- by material and application
- Adhesive and sealant selection by application
- Concrete admixtures and their purposes
- Steel grades and profiles
- Window and door specifications: U-factor, SHGC, STC, air infiltration ratings
- Roofing material comparison: lifespan, cost, warranty, aesthetics, weight
- Siding options: vinyl, fiber cement (HardiePlank), wood, engineered wood (LP SmartSide), stone/brick veneer, stucco
- Deck materials: pressure-treated, cedar, composite (Trex, TimberTech, Azek), aluminum
- Pipe materials by application and code jurisdiction
- Insulation comparison by R-value per inch, cost, moisture performance, fire rating

### 4.9 Subcontractor Management

**Knowledge areas:**
- Subcontract agreement essentials
- Scope of work clarity to prevent disputes
- Insurance requirements and certificate verification
- Lien waiver types: conditional vs. unconditional, progress vs. final
- Schedule coordination between trades
- Back-charge procedures and documentation
- Quality expectations and punchlist management
- Payment terms: progress billing, retainage, final payment
- Default and termination procedures
- Minority/WBE/DBE requirements (public projects)

### 4.10 Change Order Management

**Knowledge areas:**
- Change order causes: owner-directed, design error/omission, unforeseen conditions, code changes
- Documentation requirements: written notice, pricing, time impact
- PCO (Potential Change Order) process
- COR (Change Order Request) documentation
- Pricing methods: lump sum, T&M with NTE, unit price adjustment
- Markup allowances (varies by contract, typically 10-15% OH&P for self-performed, 5-10% for sub markup)
- Time extension requests
- Constructive change claims
- Claims avoidance through proactive communication

### 4.11 Lien Law and Contract Basics

**Knowledge areas:**
- Mechanic's lien basics (varies dramatically by state)
- Preliminary notice requirements
- Lien filing deadlines
- Lien waiver types and when to use each
- Stop notice procedures
- Payment bond claims (Miller Act for federal, Little Miller Act for state)
- Contract types and risk allocation
- Indemnification clauses
- Warranty obligations: express vs. implied
- Dispute resolution: mediation, arbitration, litigation
- Statute of limitations and repose

**Important caveat**: The AI must always note that lien law and contract interpretation varies by state/jurisdiction and recommend consulting a construction attorney for specific legal questions.

---

## 5. AI Assistant Capabilities

### 5.1 Estimate Generation

**Trigger phrases:** "estimate," "how much," "cost," "budget," "price," "quote"

**Workflow:**
1. Gather project parameters (type, size, location, quality level, scope)
2. Apply regional cost indices
3. Generate line-item estimate organized by CSI division or trade
4. Include quantity takeoff with units
5. Apply labor rates (with burden)
6. Apply material costs with waste factors
7. Add general conditions, overhead, profit, contingency
8. Present in formatted table

**Output format:**
```
PROJECT ESTIMATE
Project: [Name]
Location: [City, State]
Date: [Date]
Prepared by: JobMate AI (Preliminary)

SUMMARY
---------------------------------------------
Subtotal (Direct Costs):     $XXX,XXX
General Conditions (X%):     $XX,XXX
Subtotal:                    $XXX,XXX
Overhead (X%):               $XX,XXX
Profit (X%):                 $XX,XXX
---------------------------------------------
TOTAL (before contingency):  $XXX,XXX
Contingency (X%):            $XX,XXX
---------------------------------------------
ESTIMATED TOTAL:             $XXX,XXX

DETAILED BREAKDOWN
[Division/Trade] | [Description] | [Qty] | [Unit] | [Unit Cost] | [Total]
...

ASSUMPTIONS AND EXCLUSIONS
- [List all assumptions]
- [List all exclusions]

NOTES
- This is a preliminary estimate for budgeting purposes only
- Obtain competitive bids from licensed contractors for actual pricing
- Costs based on [year] pricing and may be affected by market conditions
```

### 5.2 Scope of Work Generation

**Trigger phrases:** "scope of work," "SOW," "write a scope," "define the scope"

**Output format:** Numbered sections with specific inclusions/exclusions, quality standards, and material specifications. Should be structured as a legally useful document.

**Sections to include:**
1. Project description and location
2. General requirements (permits, protection, cleanup)
3. Scope by trade/division (specific tasks, materials, methods)
4. Quality standards and workmanship requirements
5. Exclusions
6. Schedule requirements
7. Payment terms
8. Warranty requirements

### 5.3 Material Alternatives and Value Engineering

**Trigger phrases:** "alternative," "cheaper option," "value engineer," "substitute," "compare materials"

The AI should present alternatives in a comparison table format:

| Material | Cost/Unit | Lifespan | Maintenance | Pros | Cons |
|----------|-----------|----------|-------------|------|------|

Always note when a substitution requires engineering approval or affects code compliance.

### 5.4 Quantity Calculations

**Trigger phrases:** "how much do I need," "calculate," "quantity," "takeoff"

The AI should:
- Ask for dimensions if not provided
- Show the calculation formula step by step
- Include appropriate waste factors
- Convert to ordering units (e.g., bags of concrete, bundles of shingles, sheets of plywood)
- Round up to the next standard ordering increment

**Common calculations:**
- Concrete: cubic yards with waste
- Lumber: board feet, linear feet, pieces
- Drywall: sheets with waste
- Roofing: squares and bundles
- Paint: gallons with coats
- Tile: square feet with waste and cut factor
- Rebar: linear feet and pounds
- Gravel/stone: tons or cubic yards with compaction factor
- Insulation: square feet or bags for blown
- Fasteners: pounds of nails, boxes of screws

### 5.5 Code Compliance Checking

**Trigger phrases:** "code," "allowed," "legal," "compliant," "requirement," "minimum," "maximum"

The AI should:
- Identify which code applies (IRC, IBC, NEC, etc.)
- Cite the specific section number
- Provide the requirement language
- Note the code year/edition
- Flag that local amendments may be stricter
- Recommend verifying with the local AHJ (Authority Having Jurisdiction)

### 5.6 RFI and Submittal Drafting

**Trigger phrases:** "write an RFI," "draft RFI," "submittal," "request for information"

**RFI output format:**
```
REQUEST FOR INFORMATION

RFI #: [Sequential number]
Date: [Date]
Project: [Project name]
From: [User/Company]
To: [Architect/Engineer]

Subject: [Clear, specific subject]

Drawing/Spec Reference: [Sheet #, detail #, spec section]

Question:
[Clear, specific question with context for why clarification is needed]

Suggested Resolution:
[Contractor's proposed solution if applicable]

Impact if Not Resolved:
- Schedule impact: [Description]
- Cost impact: [Description]

Response Requested By: [Date]
```

### 5.7 Punch List Generation

**Trigger phrases:** "punch list," "punchlist," "walkthrough items," "deficiency list"

The AI should generate structured punch lists organized by:
- Location (room/area)
- Trade responsible
- Priority (safety, functional, cosmetic)
- Status tracking fields

It can also analyze project photos (via existing `photoAnalysis.ts` integration) to suggest punch list items from visual inspection.

### 5.8 Scheduling Recommendations

**Trigger phrases:** "schedule," "timeline," "how long," "sequence," "critical path"

The AI should:
- Provide typical durations for construction activities
- Identify critical path activities and logical dependencies
- Suggest schedule sequences and crew coordination
- Factor in lead times for materials and equipment
- Account for inspection hold points
- Recommend float and buffer for weather delays
- Provide look-ahead schedule suggestions

### 5.9 Weather Impact Analysis

**Trigger phrases:** "weather," "rain," "cold," "temperature," "season"

The AI should advise on:
- Temperature limitations for concrete, paint, roofing adhesives, caulk
- Wind speed limitations for crane operations, roofing, siding
- Rain impact on specific activities (excavation, concrete, framing, roofing)
- Snow and ice considerations
- Seasonal scheduling recommendations by region
- Protection measures for work in progress

### 5.10 Safety Checklist Generation

**Trigger phrases:** "safety checklist," "toolbox talk," "safety plan," "JHA," "JSA"

The AI should generate:
- Task-specific Job Hazard Analyses (JHA)
- Daily safety checklists by trade
- Toolbox talk outlines
- Fall protection plans
- Excavation safety plans
- Hot work permits
- Confined space entry checklists

These should be in the JobMate checklist format (compatible with `ChecklistTemplate` type in the app).

### 5.11 Additional Capabilities

**Proposal/Bid Writing:**
- Draft customer-facing proposals from estimates
- Include project description, scope, pricing, terms, and timeline

**Daily Log Assistance:**
- Structure daily log entries from voice notes (leveraging existing `voiceProcessor.ts`)
- Include weather, manpower, equipment, work performed, issues

**Inspection Preparation:**
- Generate pre-inspection checklists based on the type of inspection
- List common failure items and how to correct them before the inspector arrives

**Material Ordering Assistance:**
- Generate material lists from estimates or takeoffs
- Format for supplier quotes
- Track lead times

**Photo Analysis Integration:**
- Analyze jobsite photos for progress, quality, safety concerns
- Suggest punchlist items from photo review
- Identify construction phase from photos

---

## 6. Conversation Modes and Routing

### 6.1 Mode Selection Logic

The current `ChatCategory` type already provides basic routing. Expand it as follows:

```typescript
type ChatCategory =
  | 'general'      // General construction Q&A
  | 'estimate'     // Cost estimating
  | 'codes'        // Building code compliance
  | 'howto'        // Step-by-step trade guides
  | 'videos'       // Tutorial video recommendations
  | 'blueprint'    // Plan reading assistance
  | 'scope'        // Scope of work generation (NEW)
  | 'safety'       // Safety/OSHA assistance (NEW)
  | 'schedule'     // Scheduling assistance (NEW)
  | 'rfi'          // RFI/Submittal drafting (NEW)
  | 'punchlist';   // Punch list generation (NEW)
```

### 6.2 Auto-Detection

In addition to explicit category selection via quick actions, the AI should auto-detect the appropriate mode from the user's message using keyword analysis:

| Keywords | Detected Mode |
|----------|--------------|
| estimate, cost, price, budget, how much, quote, bid | `estimate` |
| code, IRC, IBC, NEC, legal, allowed, required, minimum, maximum, compliant | `codes` |
| how to, how do I, step by step, install, build, repair, replace | `howto` |
| scope of work, SOW, define scope, write scope | `scope` |
| safety, OSHA, hazard, PPE, fall protection, toolbox talk | `safety` |
| schedule, timeline, duration, critical path, sequence, how long | `schedule` |
| RFI, submittal, request for information, clarification | `rfi` |
| punch list, punchlist, walkthrough, deficiency | `punchlist` |
| blueprint, plan, drawing, elevation, detail, section | `blueprint` |
| video, tutorial, watch, youtube | `videos` |

### 6.3 Mode-Specific System Prompt Additions

Each mode should append specific instructions to the system prompt:

**Estimate mode:**
```
You are now in Estimating mode. Always:
- Ask about project location for regional pricing
- Ask about quality level (budget, standard, mid-range, high-end, luxury)
- Present estimates in table format with line items
- Show quantities with units, unit costs, and line totals
- Include subtotals, overhead, profit, and contingency
- List all assumptions and exclusions
- Note that this is a preliminary estimate requiring validation
```

**Codes mode:**
```
You are now in Building Codes mode. Always:
- Identify which code body applies (IRC, IBC, NEC, IPC/UPC, IECC, etc.)
- Cite the specific section number and edition year
- Quote or closely paraphrase the code requirement
- Note common local amendments that may apply
- Recommend verification with the local AHJ
- If the question spans multiple code bodies, address each
```

**Safety mode:**
```
You are now in Safety mode. Always:
- Reference specific OSHA standards (29 CFR 1926.XXX)
- Prioritize life-safety items above all else
- Generate actionable checklists when appropriate
- Include required PPE for any task discussed
- Note when competent person designation is required
- Identify permit-required activities (confined space, hot work, etc.)
```

---

## 7. Integration Points with JobMate

### 7.1 Project Context Integration

When a user has a project selected (or mentions a project), inject the following context:

```typescript
interface ProjectContext {
  // From Project entity
  projectName: string;
  projectType: ProjectType;  // deck, remodel, new_construction, etc.
  status: ProjectStatus;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  customerName?: string;
  progress: number;
  notepad?: string;

  // Derived/fetched
  recentPhotos: Array<{
    url: string;
    caption?: string;
    aiCaption?: string;
    tags: string[];
    timestamp: string;
  }>;
  openTasks: Array<{
    title: string;
    priority: TaskPriority;
    status: TaskStatus;
    assignedTo?: string;
    dueDate?: string;
  }>;
  activeChecklists: Array<{
    name: string;
    status: ChecklistStatus;
    completionPercentage: number;
  }>;
  recentDocuments: Array<{
    name: string;
    fileType?: string;
  }>;
  teamMembers: Array<{
    name: string;
    role: string;
  }>;
  recentActivity: Array<{
    type: ActivityType;
    message: string;
    timestamp: string;
  }>;
}
```

### 7.2 Photo Analysis from Chat

Allow users to reference project photos in the chat. The AI should be able to:

1. Accept a photo URL or reference from the project gallery
2. Call the existing `ai-analyze-photo` edge function
3. Incorporate the analysis into the conversation
4. Generate observations, punch list items, or progress notes from photos

**Implementation approach:**
- Add a photo attachment button to the chat input area
- When a photo is attached, include it in the API call as a multimodal input
- Display photo thumbnails inline in the chat thread

### 7.3 Actionable Outputs that Write Back to JobMate

When the AI generates structured outputs, offer the user a one-click action to create the corresponding entity in JobMate:

| AI Output | JobMate Action | Target Entity |
|-----------|-------------------|---------------|
| Checklist | "Save as Checklist" | `Checklist` / `ChecklistTemplate` |
| Punch list | "Save as Task List" | Multiple `Task` entities |
| Scope of work | "Save as Page" | `Page` (type: proposal) |
| Daily log | "Save as Daily Log" | `Page` (type: daily_log) |
| RFI | "Save as Page" | `Page` (type: general) |
| Estimate | "Save as Page" / "Create Invoice" | `Page` or `Invoice` |
| Safety checklist | "Save as Checklist" | `ChecklistTemplate` (category: safety) |

**UI pattern:** After the AI generates a structured output, show an action bar below the message:

```
[Save as Checklist] [Save as Page] [Copy to Clipboard] [Export PDF]
```

### 7.4 Cross-Feature References

The AI should be able to link to other parts of the app:

- "Based on your recent photos, the framing appears to be at about 75% completion"
- "I see you have 3 open tasks marked as urgent on this project"
- "Your pre-drywall inspection checklist is 80% complete -- make sure to finish before scheduling the inspector"
- "The latest daily log from [date] mentions [issue] -- has that been resolved?"

---

## 8. Data Structures and Context Injection

### 8.1 Chat API Request Structure

```typescript
interface AIChatRequest {
  // Message
  message: string;
  conversationId: string;
  category: ChatCategory;

  // Model selection
  model: AIModel;  // 'gemini' | 'claude'

  // Context
  projectContext?: ProjectContext;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;

  // Attachments
  attachments?: Array<{
    type: 'photo' | 'document';
    url: string;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }>;

  // User preferences
  userPreferences: {
    units: 'imperial' | 'metric';
    region?: string;
    defaultCodeEdition?: string;
    companyType?: string;  // GC, sub, homeowner, etc.
  };
}
```

### 8.2 Chat API Response Structure

```typescript
interface AIChatResponse {
  // Message
  content: string;
  conversationId: string;
  messageId: string;

  // Structured data (when applicable)
  structuredOutput?: {
    type: 'estimate' | 'checklist' | 'scope' | 'rfi' | 'punchlist' | 'schedule' | 'material_list';
    data: Record<string, unknown>;  // Type-specific structured data
  };

  // Suggested actions
  actions?: Array<{
    label: string;
    type: 'save_checklist' | 'save_page' | 'create_tasks' | 'create_invoice' | 'export_pdf' | 'copy';
    payload: Record<string, unknown>;
  }>;

  // Follow-up suggestions
  suggestedFollowUps?: string[];

  // References
  codeReferences?: Array<{
    code: string;      // e.g., "IRC"
    section: string;   // e.g., "R310.1"
    title: string;     // e.g., "Emergency escape and rescue openings"
    edition: string;   // e.g., "2024"
  }>;

  // Metadata
  model: AIModel;
  category: ChatCategory;
  tokensUsed?: number;
}
```

### 8.3 Context Size Management

Construction conversations can get context-heavy. Implement a tiered context strategy:

**Tier 1 (always included, ~2000 tokens):**
- System prompt (identity + mode instructions)
- Project name, type, status, location
- Last 5 message pairs

**Tier 2 (included when relevant, ~1500 tokens):**
- Open tasks summary (count + top 5 by priority)
- Active checklists summary (count + completion %)
- Recent activity summary (last 7 days)

**Tier 3 (included on demand, variable):**
- Full task list
- Photo analysis results
- Document contents
- Detailed checklist data
- Conversation history beyond 5 messages (summarized)

---

## 9. Prompt Engineering Specifications

### 9.1 Response Quality Guidelines

Include these in the system prompt:

```
RESPONSE QUALITY REQUIREMENTS:

1. SPECIFICITY: Never give vague answers. Include specific measurements, code sections,
   product names, quantities, and costs. "Use appropriate lumber" is unacceptable;
   "Use 2x10 #2 SYP at 16" OC" is the standard.

2. COMPLETENESS: Address the full scope of a question. If someone asks about building
   a deck, consider the foundation, framing, decking, railing, stairs, ledger board,
   flashing, and any permits required -- even if they only asked about one aspect.
   Mention the related items briefly.

3. SAFETY FIRST: If a user describes or asks about something that has safety
   implications, address the safety concern BEFORE answering the primary question.
   "Before we discuss the framing, I want to note that working at this height
   requires fall protection per OSHA 1926.501."

4. CODE AWARENESS: When your answer involves code-regulated work, cite the code.
   Don't just say "you need a GFCI" -- say "GFCI protection is required per
   NEC 210.8(A) for all 125V, 15A and 20A receptacles in bathrooms."

5. REGIONAL SENSITIVITY: Costs, codes, and practices vary by region. When discussing
   costs, ask about or state the assumed region. When discussing codes, note that
   local amendments may apply.

6. PROFESSIONAL BOUNDARIES: Clearly state when a licensed professional is required.
   "This structural modification requires a licensed PE to design and stamp the plans"
   or "Electrical work beyond [threshold] requires a licensed electrician in most
   jurisdictions."

7. DISCLAIMER ON ESTIMATES: All cost estimates must include a disclaimer that they are
   preliminary, for budgeting purposes only, and should be validated with local
   contractor bids and current material pricing.

8. FORMAT FOR READABILITY: Use tables for comparisons and estimates. Use numbered
   lists for procedures. Use bold for key terms and specifications. Use headers
   to organize long responses.
```

### 9.2 Handling Ambiguity

```
WHEN INFORMATION IS INSUFFICIENT:

Rather than making broad assumptions, ask the user for clarification on critical
parameters. However, don't ask for everything at once. Ask the 2-3 MOST IMPORTANT
clarifying questions, state your assumptions for less critical items, and note
that you can refine the answer if those assumptions are wrong.

Example:
"To give you a solid estimate for this bathroom remodel, I need to know:
1. What's the approximate square footage of the bathroom?
2. What quality level are you targeting? (standard: builder-grade fixtures and
   vinyl flooring, mid-range: ceramic tile and name-brand fixtures, high-end:
   large format porcelain, frameless shower, freestanding tub)

I'll assume a standard layout (tub/shower combo, single vanity, toilet) and
that the existing plumbing locations stay the same. Let me know if the scope
is different."
```

### 9.3 Conversation Continuity

```
CONVERSATION CONTINUITY:

Maintain context across the conversation. If the user was discussing a
bathroom remodel and then asks "what about the electrical?", understand
that they mean the electrical work for the bathroom remodel, not a
general electrical question.

When the user provides new information that changes a previous answer
(e.g., they mention the house is in Florida after you gave snow load
information), acknowledge the correction and update your guidance
accordingly.
```

---

## 10. Safety, Disclaimers, and Guardrails

### 10.1 Mandatory Disclaimers

The AI must include appropriate disclaimers in these situations:

| Situation | Disclaimer |
|-----------|-----------|
| Cost estimates | "This is a preliminary estimate for budgeting purposes. Obtain competitive bids from licensed contractors for actual project pricing." |
| Structural advice | "Structural modifications require review and approval by a licensed Professional Engineer (PE). Do not proceed without engineered plans." |
| Electrical advice | "Electrical work must comply with the NEC and local amendments. Many jurisdictions require a licensed electrician for permit work." |
| Plumbing advice | "Plumbing work must comply with the applicable plumbing code. Many jurisdictions require a licensed plumber for permit work." |
| Legal/contract questions | "This is general information only and does not constitute legal advice. Consult a construction attorney for specific legal matters." |
| Code interpretations | "Code interpretations are subject to the Authority Having Jurisdiction (AHJ). Always verify requirements with your local building department." |
| Asbestos/lead/hazmat | "Suspected hazardous materials require testing by a certified professional before any disturbance. Follow all EPA and OSHA regulations." |

### 10.2 Guardrails

The AI should refuse or redirect in these cases:

- **Requests to bypass codes or inspections**: "I can't advise on how to avoid code requirements or inspections. These exist for life safety. Let me help you understand the requirements so you can comply efficiently."
- **Dangerous electrical work without proper knowledge**: Flag that certain electrical work is dangerous and requires a licensed electrician.
- **Structural modifications without engineering**: Always insist on PE involvement for load-bearing changes.
- **Asbestos/lead disturbance without testing**: Never advise disturbing suspected hazardous materials without proper testing and abatement procedures.
- **Work requiring specific licensing**: Note licensing requirements clearly.

### 10.3 Liability Limitation

Every conversation session should include (either in the system prompt or displayed in the UI):

```
JobMate AI provides general construction guidance based on common industry
practices and standard building codes. It is not a substitute for professional
engineering, architectural, or legal advice. Users are responsible for verifying
all information with qualified professionals and local authorities before
proceeding with any construction work. JobMate assumes no liability for
decisions made based on AI responses.
```

---

## 11. Technical Implementation Plan

### 11.1 Backend Architecture

**Recommended approach:** Create a new Supabase edge function `ai-construction-chat` that:

1. Accepts the `AIChatRequest` payload
2. Assembles the layered system prompt based on category and context
3. Routes to the selected model (Gemini or Claude API)
4. Parses the response for structured outputs
5. Returns the `AIChatResponse` payload

**Edge function responsibilities:**
- System prompt assembly from templates
- Project context fetching and formatting
- Conversation history management
- Token budget management
- Response parsing and structured output extraction
- Usage tracking and rate limiting

### 11.2 Frontend Changes to AIChatPage.tsx

**Replace mock system with live API:**
1. Replace `getMockResponse()` with a call to the new edge function
2. Add conversation ID tracking for multi-turn conversations
3. Implement streaming responses for better UX (SSE or WebSocket)

**Add project context selector:**
- Add a project dropdown/selector in the chat header
- When a project is selected, fetch and inject its context
- Display the active project as a badge in the chat

**Add attachment support:**
- Photo attachment button in input area
- Drag-and-drop photo from project gallery
- Display photo thumbnails inline in messages

**Add action buttons on AI responses:**
- Parse `actions` from the API response
- Render action buttons below structured outputs
- Implement handlers for each action type (save checklist, save page, etc.)

**Expand quick actions:**
- Add the new categories: Scope of Work, Safety, Schedule, RFI, Punch List
- Design icons and color schemes for each
- Consider a scrollable category bar or grid layout

**Add suggested follow-ups:**
- Display `suggestedFollowUps` as clickable chips below the AI response
- Clicking sends the follow-up as a new message

### 11.3 New Quick Action Definitions

```typescript
const quickActions: QuickAction[] = [
  // Existing (keep)
  { id: 'estimate', label: 'Estimate Cost', icon: DollarSign, ... },
  { id: 'codes', label: 'Building Codes', icon: BookOpen, ... },
  { id: 'howto', label: 'How To', icon: Wrench, ... },
  { id: 'blueprint', label: 'Blueprint Help', icon: PenTool, ... },

  // New
  { id: 'scope', label: 'Scope of Work', icon: FileText, color: 'bg-teal-50 text-teal-600 border-teal-200',
    prompt: 'I need help writing a scope of work for a project. What trade or project type?' },
  { id: 'safety', label: 'Safety / OSHA', icon: ShieldAlert, color: 'bg-orange-50 text-orange-600 border-orange-200',
    prompt: 'I have a safety question or need a safety checklist. What activity or concern?' },
  { id: 'schedule', label: 'Scheduling', icon: CalendarDays, color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    prompt: 'I need help with project scheduling or sequencing. What type of project or phase?' },
  { id: 'rfi', label: 'Draft RFI', icon: FileQuestion, color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    prompt: 'I need to write an RFI. What is the issue or question for the architect/engineer?' },
  { id: 'punchlist', label: 'Punch List', icon: ClipboardCheck, color: 'bg-pink-50 text-pink-600 border-pink-200',
    prompt: 'I need help creating a punch list. What area or trade?' },

  // Move videos to secondary/overflow
  { id: 'videos', label: 'Find Videos', icon: Youtube, ... },
];
```

### 11.4 Conversation Persistence

Store conversations in Firestore (or Supabase) for:
- Conversation history across sessions
- Searchable conversation archive
- Analytics on common questions and usage patterns

**Schema:**
```typescript
interface AIConversation extends BaseDocument {
  companyId: string;
  userId: string;
  projectId?: string;
  title: string;  // Auto-generated from first message
  messages: ChatMessage[];
  category: ChatCategory;
  model: AIModel;
  isArchived: boolean;
}
```

### 11.5 Offline Considerations

Since JobMate has offline support (evidenced by `src/lib/offline/`):
- Cache the system prompt layers locally
- Queue messages for sending when connectivity returns
- Consider a lightweight on-device model for basic questions (future)
- Display clear "offline" state in the chat UI

---

## 12. Future Enhancements

### 12.1 Phase 2 Features

- **Voice-to-chat**: Use the existing `VoiceCapture` component to allow voice input to the chat (dictate questions instead of typing)
- **Multi-language support**: Leverage existing `translator.ts` for Spanish/English conversations
- **Proactive notifications**: "Your insulation inspection is scheduled for tomorrow. Here's a pre-inspection checklist based on your project."
- **Document analysis**: Upload a spec document, contract, or plans page and ask questions about it
- **Estimating database**: Allow companies to input their own labor rates, material costs, and markup preferences for more accurate estimates

### 12.2 Phase 3 Features

- **Photo-to-estimate**: Take a photo of existing conditions and generate a repair/renovation estimate
- **AR measurement integration**: Connect to AR measurement tools for automatic quantity takeoff
- **Scheduling integration**: Two-way sync with scheduling tools (MS Project, Primavera, Buildertrend)
- **Sub bid analysis**: Upload sub bids and have the AI compare/level them
- **Contract review**: Upload a subcontract and highlight concerning clauses
- **Code change alerts**: Notify users when code editions change and how it affects their project type
- **Predictive analytics**: Use project data patterns to predict schedule delays, cost overruns

### 12.3 Knowledge Base Maintenance

The AI's knowledge base must be periodically updated for:
- New code editions (IRC, IBC, NEC cycle every 3 years)
- Material pricing trends
- New construction methods and materials
- OSHA regulation changes
- Regional code adoptions

Consider implementing a knowledge base version system and update cadence (quarterly review recommended).

---

## Appendix A: Example Conversations

### A.1 Estimate Request

**User:** "How much would it cost to build a 16x20 deck in Nashville, TN?"

**Expected AI behavior:**
1. Acknowledge the request
2. Ask 2-3 key clarifying questions (material preference, height off ground, stairs/railing, covered or open)
3. State assumptions for unspecified items
4. Provide a structured estimate with line items
5. Include regional cost adjustment for Nashville market
6. Note permit costs for Davidson County
7. Include disclaimer

### A.2 Code Question

**User:** "What size header do I need for a 6 foot opening in a load bearing wall?"

**Expected AI behavior:**
1. Ask about the floor/roof load above (single story with roof, two-story, etc.)
2. Ask about lumber species available
3. Reference IRC Table R602.7(1) or (2) for header sizing
4. Provide the header size (e.g., 2-2x12 for a 6' span, single story with roof)
5. Note that engineered lumber (LVL) may be more cost-effective for this span
6. Recommend PE review if conditions are non-standard
7. Cite the specific code section and edition

### A.3 Safety Question

**User:** "We're digging a trench for a water line. How deep before we need shoring?"

**Expected AI behavior:**
1. Immediately address that OSHA requires protection at 5 feet depth (1926.652)
2. Note that trenches of ANY depth require hazard assessment
3. Explain the options: sloping, shoring, trench boxes
4. Explain soil classification (Type A, B, C) and how it affects the approach
5. Note that a "competent person" must be on site per OSHA
6. Mention the importance of locating underground utilities before digging (811)
7. Provide a pre-excavation checklist

### A.4 Project Context Conversation

**User (with project "Smith Kitchen Remodel" selected):** "What should I focus on this week?"

**Expected AI behavior:**
1. Reference the project data: open tasks, checklist completion, recent photos
2. Identify the apparent project phase from available data
3. Prioritize urgent/high-priority tasks
4. Flag any overdue items
5. Suggest next logical steps based on the construction sequence
6. Note any upcoming inspections that should be scheduled

---

## Appendix B: Competitive Analysis Notes

The following features differentiate JobMate AI from generic chatbots and competing construction apps:

1. **Deep project context**: Unlike ChatGPT or generic AI, this assistant knows the user's actual project data
2. **Actionable outputs**: Generates checklists, scopes, estimates that save directly to the app
3. **Trade-level depth**: Not just high-level project management, but specific trade knowledge
4. **Code citation**: References specific code sections, not vague "check your local codes"
5. **Regional pricing awareness**: Adjusts estimates by location rather than giving national averages
6. **Photo integration**: Can analyze jobsite photos and incorporate findings into conversations
7. **Multi-role persona**: One assistant that can answer estimating, design, code, and trade questions -- matching how small-to-mid contractors actually work (wearing many hats)
8. **Voice input ready**: Leverages existing voice infrastructure for hands-free jobsite use
9. **Bilingual potential**: English/Spanish support is critical for US construction workforce

---

## Appendix C: Token Budget Estimates

Estimated token usage per conversation turn:

| Component | Estimated Tokens |
|-----------|-----------------|
| Layer 0: Identity | ~500 |
| Layer 1: Core knowledge (condensed) | ~2,000 |
| Layer 2: Mode instructions | ~300 |
| Layer 3: Project context | ~800-1,500 |
| Layer 4: Conversation history (5 turns) | ~1,500-3,000 |
| Layer 5: Output format | ~200 |
| User message | ~100-500 |
| **Total input per turn** | **~5,400-8,000** |
| AI response | ~500-2,000 |

At these token levels, a typical conversation of 10 turns would use approximately 60,000-80,000 tokens total. This is well within the context windows of both Gemini (1M+ tokens) and Claude (200K tokens).

**Cost estimate per conversation** (rough, based on 2025 API pricing):
- Gemini 1.5 Pro: ~$0.02-0.05 per conversation
- Claude 3.5 Sonnet: ~$0.10-0.25 per conversation
- Claude 3 Opus: ~$0.50-1.00 per conversation

Recommend defaulting to Gemini 1.5 Pro for cost efficiency and using Claude for complex estimating or code analysis tasks.

---

*End of specification document.*
