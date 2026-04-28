# spec-driven development

> Converted from PDF to Markdown with OCR.

## Page 1

@ Gauntlet

Enterprise Spec-Driven Development

Powered by GitHub’s Speckit

## Page 2

@ Gauntlet

The Promise (and Problem) of AI Coding Agents

What AI Agents Promise What Actually Happens at Scale

¢ "Just describe what you want" Monday: Alice ships feature X using Claude

¢ "Ship in minutes, not days" Tuesday: Bob ships feature Y using Copilot (conflicts with X)
e "10x developer productivity" Wednesday: QA finds neither follows the auth pattern from Q3

Thursday: Code review reveals Alice hallucinated an API that doesn't exist

Friday: Production incident

@ Gauntlet
Let's Address the Elephant in the Room

"I can ship a feature in one prompt. Why do I need 11 commands?"

"This is bureaucracy disguised as tooling."

## Page 3

"I'm a staff engineer. I know what I'm doing. Don't treat me like a junior."

These are valid concerns. We'll address each one directly.

@ Gauntlet

The Core Insight

Individual Speed # Team Velocity

Metric Raw Agent Structured Agent
Time to first commit 4 Faster Slightly slower
Rework cycles More Less

Merge conflicts High Low

Onboarding cost Per-developer Per-repo
Institutional knowledge Lost Captured

OD The fastest individual contributor creates drag if others can't understand, review, or extend their work.

## Page 4

@ Gauntlet
Where Spec Engineering Fits in the AI Stack

Your Task Coding Agent (The Engine)
"Build a donor dashboard with real-time updates" e Natural language understanding
© Code generation

e Context synthesis

1 2 5 4
Spec Engineering (The Rails) Your Codebase
* Workflow structure (request — specify — plan) Consistent. Reviewable. Traceable.

* Quality gates (coverage, scope, architecture)
e Shared context (constitution, personas, specs)

e Traceability (spec > task — code — PR)

ISpec Engineering provides the rails. Al agents provide the engine.

@ Gauntlet

Grounding Spec Engineering in AI Primitives

## Page 5

RAG (Retrieval-Augmented Generation)

Constitution, architecture docs, and prior specs are loaded into every command

Tool Use / Function Calling

Shell scripts invoked via {SCRIPT} placeholders in command templates

Memory / Context Management

.gobuildme/specs/<feature>/ persists artifacts across the workflow

Guardrails / Evals

Quality gates at every phase: 85% coverage default, scope validation, PR size limits

Chain-of-Thought

Explicit workflow phases force the agent to reason in stages

Human-in-the-Loop

Running the next command = imp!

approval of the previous step

## Page 6

@ Gauntlet

The Spec-Driven Development Philosophy

Traditional Development Spec-Driven Development

Task Kickoff Task Initiation]

T
Manual Iteration Loop
Implementation Code

‘Spee-Driven Development

Manual. Documentation

7

Manual Testing

ty

Task Conplete?
Verified

Deployment:
Code — Documentation — Review — Hope it works Specification — Plan — Code — Validation
The specification is executable. It drives:
1. __~ What files can be touched (scope.json) 2 What tests must pass (coverage gates)

3. What architecture constraints apply (constitution) 4 ~~ What the PR should contain (task breakdown)

## Page 7

@ Gauntlet

Why This Matters for Enterprises

Your Unique Challenges

Scale

Hundreds of engineers across multiple teams

e pressure to ship faster

What Spec Engineering Gives You

Challenge

"How do we know the agent followed our patterns?"
“How do we review Al-generated PRs?"

“How do we prevent scope creep?"

"How do we onboard new engineers?"

Compliance

Financial regulations, donor privacy, audit trails

Quality

Customer trust depends on reliability

Spec Engineering Solution

Constitution enforcement
Spec — Task — Code traceability

scope.json and PR s|

ing gates

Workflow is the documentation

## Page 8

"How do we audit decisions?"

Objection — "This Slows Me Down"
"I Can Ship in One Prompt. Why 11 Commands?"

Metadata extraction and artifact registry

@ Gauntlet

You're right—for you, right now, on a feature you fully understand, one prompt might work. But ask yourself:

Question

Can your teammate review without asking
10 questions?

Can someone resume if you go on vacation
mid-feature?

Can QA understand scope without reading
all code?

Can you prove to audit why this decision
was made?

Will the next engineer understand intent?

One Prompt

x

Maybe

Spec Engineering

@ Spec exists

@ Artifacts persist

@ scope.json

@ plan.md

@ request.md

## Page 9

@ Gauntlet

Objection — "The AI Is Smart Enough"
"200K Context Window. Why Scaffolding?"

4
5
2 "Build auth" +
1 "Build auth" + constitution +
"Build auth" + constitution + architecture + spec
"Buil " ituti ‘
uild auth’ constitution architecture Auth that matches
Generic auth (maybe JWT, Auth that follows your Auth that integrates with stakeholder expectations
maybe sessions, maybe patterns existing services
OAuth)
On Hallucinations
Spec Engineering doesn't prevent hallucinations—but it makes them catchable.
Without Spec Engineering: Agent hallucinates an API — You discover With Spec Engineering: Agent hallucinates in spec.md — You catch it

in code review (or production) at /gbm.specify before any code

## Page 10

Objection — "This Is Too Rigid"

"Not Everything Fits This Workflow"

You're Right. That's Why We Have Tiers.

Scenario Workflow
Typo fix, config tweak Quickfix
Bug fix, small feature (<100 LoC) Lite

New feature (>100 LoC) Full
Prototype / spike None

From the Actual Templates:

# Quickfix limits
Files changed: 1-2
Lines of code: <5@

# Lite limits
Files: 3-5
Lines of code: <10@

Commands

1

Just code it

@ Gauntlet

## Page 11

UW Gauntlet

Objection — "Artifacts Will Rot"

Traditional Docs: You're Right

Code changes — Docs don't > Docs become lies + Nobody trusts docs

Spec Engineering Artifacts: Different Model

Artifacts are per-feature, not per-repo.

- gobuildme/specs/donor-dashboard/

kK request.md < Frozen at feature start
kK spec.md « Frozen at specify phase
[E plan.md « Frozen at plan phase

_ tasks.md « Updated during implement

These aren't living docs. They're decision records

Artifact Question It Answers Lifecycle
request.md "What did we want?" Frozen
spec.md "What did we agree to build?” Frozen

plan.md "How did we decide to build it?" Frozen

## Page 12

@ Gauntlet

What Gets Created (Artifact Trail)

. specengineering/specs/donor-dashboard/
request.md « Goals, non-goals, assumptions
spec.md « Detailed specification

plan.md « Technical approach

tasks.md « Hierarchical task breakdown
scope.json « Allowed files and patterns
persona.yaml « Who's driving this feature
mode.yaml « Workflow tier (lite/full)

PTTT TTT

@ Gauntlet

The Bottom Line

What Spec Engineering Is NOT What Spec Engineering IS

## Page 13

> A replacement for your judgment

& A rigid process that can't be changed

> Bureaucracy for its own sake

A tool for juniors that slows down seniors

@ A shared workflow that creates team coherence
© Context injection that makes your agent smarter
© Quality gates that catch errors before production
@ An artifact trail that makes reviews meaningful

© Your framework to shape and improve

@ Gauntlet

The Constitution (Your Team's Shared Brain)

From the Actual Template:

# [PROJECT_NAME] Constitution

## Core Principles

<!-- PRINCIPLE: test-first -->

#HHt Test-First (NON-NEGOTIABLE)

TDD mandatory: Tests written + User approved
>» Tests fail + Then implement

## Organizational Rules (Fixed)

## Page 14

<!-- PRINCIPLE: spec-engineering-rules
#i### Spec Engineering Rules

No hardcoding of values in source code
No mock data in production code

Never commit directly to protected branches
Security review is non-negotiable

## PR Slicing Rules

- Target 400-500 lines of code per PR maximum
= One concern per PR

- Tests included in same PR

@ Gauntlet

Create the Specification
Run Specify

/specify

What Happens

e Loads Context: request.md, constitution, architecture

e@ Applies Persona Requirements: UX Flows, API Contracts, Accessi

## Page 15

e Generates Specification: Detailed technical spec

Output: spec.md

## API Contracts
#H#Ht GET /api/leaderboard
**Query Parameters: **

- ~period’: enum ["weekly", “monthly”, “all_time"]

- ‘limit’: integer (default: 10, max: 100)

## Acceptance Criteria

- AC-1: Given leaderboard page, when loaded,
then show top 10 all-time

- AC-

Given period filter, when changed,
then update within 50ems

Create the Plan

Run Plan

/plan

@ Gauntlet

Output Files

plan.md:

## Page 16

## Technical Approach
### Backend (FastAPI)
- New endpoin:
- Query service:

~src/api/leaderboard. py”

*~src/services/leaderboard_service.py”
- Caching: Redis with 5-minute TTL

### Frontend (React)
- Component: ~src/components/Leaderboard.tsx*

- Hook: ~src/hooks/useLeaderboard.ts”

## Constitution Alignment
- <!-- PRINCIPLE: test-first -->
TDD: Tests first for service layer

"allowed_files": [

src/api/leaderboard.py",

“src/services/leaderboard_service.py",
“src/components/Leaderboard.tsx"

@ Gauntlet

Break Down Tasks

## Page 17

Run Tasks

/tasks
Output: tasks.md
## Phase 2: Setup & Scaffolding

- 2.1 Create ~src/api/leaderboard.py’ with route stub
= 2.2 Create ~src/services/leaderboard_service.py” skeleton
## Phase 3: Core Implementation
= 3.1 Implement ~LeaderboardService.get_top_donors()~
= 3.2 Add Redis caching layer
- 3.3 Wire service to API endpoint
## Phase 4: Frontend
= 4.1 Create ~Leaderboard.tsx component
= 4.2 Implement period filter UI
## Phase 8: Testing Validation
- T1 Unit tests pass (285% coverage)
- T2 Integration tests pass
°
Implementation
Run Implement

@ Gauntlet

## Page 18

/implement

What Happens
Loads Tasks Loads Scope
Uses tasks.md as checklist Only touches files in scope.json
TDD Enforced Progress Tracking
Writes tests first (per constitution) Marks tasks complete

After Implementation

## Phase 3: Core Implementation

- [x] 3.1 Implement

~ LeaderboardService.get_top_donors()*
- [x] 3.2 Add Redis caching layer

- [x] 3.3 Wire service to API endpoint

## Page 19

@ Gauntlet

Test, Review, Push

4 Run Tests
/tests

Validates: 85% coverage, all tests pass, no lint errors

Q Run Review
/review

Self-review: tasks complete? scope respected? constitution aligned?

® Push

/push

