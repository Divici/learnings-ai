# AI_Agents_Lecture


## Page 1


Production AI Agents
From ReAct Loops to AgentForge Deployment
A pragmatic guide for production systems




## Page 2


Precise Terminology
Don’t call everything an "AI Agent"
LLM Call
Single request-response
No tools, no iteration
Example: ChatGPT
LLM + Tools
LLM can call functions
Still single-turn (no
reasoning)
Example: Claude with
calculator
Agentic System
Multi-turn loop
Reasoning → Action →
Observation
Example: AgentForge
🎯 AgentForge Connection
You're building an Agentic System - not just an LLM wrapper. Your agent must iterate through tool calls
to solve complex tasks.
Production AI Agents | Slide 2




## Page 3


The ReAct Loop
How agents work: Reasoning + Acting in cycles
THOUGHT
"What do I need?"
ACTION
Call tool
OBSERVATION
Process result
REPEAT (or
Answer)
Example: "Analyze portfolio" → Get holdings → Calculate allocation → Synthesize
Production AI Agents | Slide 3




## Page 4


The Complexity Spectrum
Match pattern complexity to problem uncertainty
Single LLM
1x | <1s
LLM + Tools
2-3x | 1-3s
ReAct Agent
5-10x | 5-15s
Planning
10-20x | 15-30s
Multi-Agent
20-50x |
30s+
Industry Examples:
• Shopify: ReAct agent for product research across multiple sources
• Stripe: LLM + Tools for support ticket classification with knowledge base
• Anthropic: ReAct with Claude function calling for complex analysis
💡 Key Insight
Start simple. Most "AI agent" use cases work fine with LLM + Tools. Only use ReAct when the problem
path is truly unknown.
Production AI Agents | Slide 4




## Page 5


When NOT to Use Agentic Patterns
Most "AI agent" projects are overengineered
✗
Deterministic Workflows
If you can write if/else, do that.
Example: Form validation, ETL
✗
Batch Processing
Same operation 1000x doesn't need
reasoning. Example: Classify 1M emails
✗
Speed Critical (<1s)
Multi-turn adds 5-10s minimum.
Example: Real-time bidding
✗
Simple Classification
Single LLM call works. Example:
Sentiment, content moderation
⚠ Agent Reality Check
Your agent SHOULD use agentic patterns (unknown info needs). But always ask: "Could this be a
single LLM call?" - or even better, just regular code? If yes, do that.
Production AI Agents | Slide 5




## Page 6


When Agents Are Actually Valuable
These problems justify the complexity overhead
✓
Unknown Info Needs
Can't predict data sources needed.
Example: Medical diagnosis requiring
OpenEMR + drug DB + insurance
✓
Multi-System Integration
Must query multiple APIs dynamically.
Example: Healthcare workflow across
3+ systems
✓
Complex Analysis
Iterative reasoning with dependencies.
Example: Investment portfolio risk
analysis
✓
Dynamic Decision Trees
Branching depends on retrieved data.
Example: Compliance checking
workflows
🎯 AgentForge: All 4 Apply
You’ll be working in either healthcare or financial domains that hit all criteria. Your agent WILL need
multi-step reasoning for drug interactions, portfolio analysis, compliance. Complexity justified.
Production AI Agents | Slide 6




## Page 7


Tool Design: AgentForge Requirement
You need 5+ tools. Make them excellent.
Principles ✓
• Atomic: One clear
purpose
• Idempotent: Safe to retry
• Well-documented: LLM
reads description
• Error-handled: Return
structured errors
• Verified: Check results
before returning
Anti-patterns ✗
• Too broad:
"manage_patient"
• Missing states: No error
codes
• Undocumented: "Helper
function"
• Side effects: Logs to
console
• Unverified: Returns raw
API data
class DrugInteractionTool:
  """CRITICAL SAFETY CHECK"""
  def execute(medications):
    interactions = check_db()
    if has_severe:
      return Error("SEVERE")
    return Success(data)
📊 AgentForge: 5+ Tools Required
Pick ones that clearly solve important subtasks within your problem space.
Production AI Agents | Slide 7




## Page 8


Production Guardrails: Non-Negotiable
Agents fail creatively. Defend against all modes.
MAX_ITERATIONS
10-15
Prevents infinite loops
Stops runaway costs
TIMEOUT
30-45s
User experience limit
API gateway timeout
COST_LIMIT
$1/query
Prevent bill explosions
Alert on anomalies
CIRCUIT_BREAKER
Avoid repetition
Same action 3x → abort
Log for debugging
⚠ Without These: Production Disasters
Real failures: $10K bills from loops, 5min timeouts killing sessions, hammering downstream services.
IMPLEMENT ALL FOUR.
Production AI Agents | Slide 8




## Page 9


Verification Layer: AgentForge Requirement
High-stakes domains require checks before responses
AgentForge Requires 3+ Verification Types:
1
Fact Checking
Cross-reference against authoritative sources (FDA,
IRS)
→
Healthcare: Check drug dosages vs guidelines
2
Hallucination Detection
Flag unsupported claims, require source attribution
→
Finance: Require citation for market data
3
Confidence Scoring
Quantify certainty (0-1), surface low-confidence
→
Both: Return confidence with every result
4
Domain Constraints
Enforce business rules (max dosage, trade limits)
→
Healthcare: SEVERE interactions fail verification
5
Human-in-the-Loop
Escalation for high-risk decisions
→
Both: Flag low confidence + high stakes
Implementation Pattern
ToolResult(status, data, verification: VerificationResult(passed, confidence, warnings, errors, sources))
Production AI Agents | Slide 9




## Page 10


Evaluation: 50+ Test Cases Required
You can't improve what you don't measure
What to Measure:
• Correctness: Accurate vs ground truth
• Tool Selection: Right tools chosen
• Tool Execution: Parameters correct
• Safety: Refuses harmful requests
• Latency: Response time <5s
• Cost: Tokens and $ per query
• Pass Rate: Target >80%
🎯 AgentForge Grading
Pass rate affects grade. >80% = good, >90% = excellent. Failed tests show exactly where to improve.
Run evals DAILY - and ensure they cover the range of expected system behavior.
Production AI Agents | Slide 10




## Page 11


Key Takeaways
Remember when building production agents
1
Match complexity to uncertainty - most problems don't need agents
2
Tools are your abstraction - atomic, documented, error-handled
3
Guardrails are non-negotiable - max iterations, timeout, cost, circuit breaker
4
Evaluation drives quality - 50+ tests minimum, run daily
5
Multi-agent is usually cargo cult - fix your tools instead
6
Measure everything - observability isn't optional
Build systems that solve real problems.
Production AI Agents | Slide 16




## Page 12


Resources & Next Steps
📚 Further Reading
• Yao et al. "ReAct" (2022)
• Anthropic: Tool Use Docs
• OpenAI: Function Calling
• LangChain: Agent Architecture
• AgentForge: Full requirements
🚀 Your Action Items
1. Run the Jupyter notebook
2. Choose domain (Healthcare/Finance)
3. Build 5+ tools minimum
4. Create 50+ test cases
5. Deploy with observability
6. Ship in 7 days
Questions? Ask now, or later in Slack!
