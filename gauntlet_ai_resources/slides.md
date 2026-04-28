# slides

> Converted from PDF to Markdown with OCR.

## Page 1

Evals &
Reinforcement Learning

A five-stage eval framework—and how human feedback and reward signals close the loop

## Page 2

"How do you know your Al is good?"

If your answer is "we tested it manually" or "it looked fine in review" — you don't have an eval strategy.

## Page 3

What we'll cover

Reinforcement learning ties the deck together: your evals and rubrics define the reward (what counts as better), and human feedback powers the loops that

update models or prompts—RLHF, DPO, automatic prompt optimization, and similar.

Why evals "We tried it manually" is not a strategy—you need repeatable gates to ship and improve without guessing.

Five stages Golden sets = labeled coverage — replay + ML metrics — rubrics ~ experiments; each step answers a sharper question about quality.

LLM judges Grounding claims, calibrating against humans, and writing criteria concrete enough for consistent scores.

Supervised vs reward signals, the core loop, RL beyond chatbots, GANs + distillation as related “learn-from-a-signal"” ideas, and how products turn corrections into

Gibinekin training data and harness-driven prompt changes.

Experiments Same suite, different variants—make cost, latency, and quality trade-offs explicit.

Pitfalls & habits Anti-patterns that make evals misleading, plus cadence and practices that keep the stack cheap and trustworthy.
Examples & summary Hypothetical policy and code-review agents with the stack applied; short recap and closing,

navigate 03/41

## Page 4

navigate

THE PROBLEM

Without evals, you're flying blind

Without

« Guess if changes helped
« Ship regressions you notice later

« Argue about quality ad hoc

With
« Measure impact on a fixed suite
« Catch breaks before users do

« Compare options with numbers

04/41

## Page 5

THE FRAMEWORK

Five stages, each building on the last

Golden Sets Labeled Scenarios Replay Harnesses Rubrics Experiments

Walk them in order; start at Stage 1 and add depth as the system matures.

avigate

## Page 6

STAGE 01

Golden Sets

## Page 7

GOLDEN SETS

Golden sets define what "correct" looks like
10-20 tight cases, fast to run—failures mean something fundamental broke.

GOLDEN_DATA.YAML
- id: "gs-001"
query: "What is our remote work policy?"

expected_tools:
- vector_search

expected_sources:
- remote_work_policy.md

must_contain:
- "remote"
- "core hours"

must_not_contain:

- "I don't know"

- "no information"

avigate 07/41

## Page 8

GOLDEN SETS

Four check types—express them as code evals

CHECK WHAT IT CATCHES

Tool selection Wrong tool

Source citation Wrong document

Content validation Missing key facts

Negative validation Hallucination or give-up phrases

EVALUATOR.PY

assert "vector_search" in actual_tools

assert "refund_policy.md" in response_text

assert "30-day" in response_text and "$500" in response_text
assert "I don't know" not in response_text

Deterministic, no LLM judge—run after every commit.

navigate 08/41

## Page 9

GOLDEN SETS

Four rules for golden sets that stay useful

Start small 10-20 quality cases beats 100 sloppy ones

Run on every commit These are your regression tests

Add from production bugs Every bug becomes a test case

Never Change expected output just to make tests pass

navigate

09/41

## Page 10

STAGE 02

Labeled Scenarios

## Page 11

Labeled scenarios are golden set cases with tags

SCENARIOS.YAML
- id: "sc-m-001"
query: "What's our refund policy and how many refunds last quarter?"
expected_tools: ["vector_search", "sql_query"]
category: multi_tool
subcategory: vector_and_sql
difficulty: straightforward

The tags don't change how the test runs — they change what the results tell you.

avigate 11/41

## Page 12

— LABELED SCENARIOS

Coverage matrix vs golden sets

Empty cells in the matrix show where to add scenarios; golden sets stay the small correctness bar.

| vector
o-oo eee ee === ------ |--------
straightforward | 3/3
ambiguous | 4/2
edge_case | 4/2
Question
Size / bar
Cadence

navigate

sql | jira

1/2 | 0/1

|
|

2/3 | 2/2 | 2/2
|

1/1 | 1/1 |

GOLDEN SETS
Does it work?
10-20, all must pass

Every commit

LABELED SCENARIOS

Does it work everywhere?

30-100+, coverage map

Every release

12/41

## Page 13

STAGE 03

Replay Harnesses

## Page 14

REPLAY HARNESSES

Record once. Score anytime.

Save a real session as JSON; replay and score the same trace anytime (before/after human labels, model changes, etc.).

RECORDER.PY / PLAYER.PY

# Record once (costs tokens)

session = record_session(
query="What's our refund policy and how many refunds in Q4?",
session_id="refund-001"

)

# + saves to fixtures/refund-001. json
# Replay forever (costs nothing)

replayed = replay_session("refund-901")
scores = evaluate_session(replayed)

Record production examples. Real queries make the best test cases.

navigate 14/41

## Page 15

navigate

REPLAY HARNESSES

Stage 3 introduces ML-grade metrics

METRIC WHAT IT MEASURES

Precision / recall Retrieval quality (relevant vs retrieved)
Groundedness / faithfulness Claims supported by sources; no drift
Tool accuracy Correct tool use

Groundedness and faithfulness usually need an LLM judge—next section.

15/41

## Page 16

Use it right,
or don't use it

## Page 17

LLM AS A JUDGE

The judge checks claims against sources

# Is this claim supported by the source?

claim: "We offer 30-day refunds"
source: refund_policy.md = "...30-day refund window..."
result: vy grounded

claim: "We offer 60-day refunds"

source: pefund_policy.md . "...30-day refund window..."
result: x not grounded (hallucination)

Per-claim binary calls aggregate into groundedness.

navigate 17/41

## Page 18

Calibrate before you ship the judge

CALIBRATION.PY

# Step 1: Score 20 examples by hand
human_scores = [4, 3, 5, 2, 5, 4, 3, ...]

# Step 2: Run the LLM judge on the same examples
lUlmscores = [4, 4, 5, 3, 5, 3, 3, ..-]

# Step 3: Check correlation

correlation(human_scores, 1lm_scores)
# If < 0.8, your rubric is broken — fix it before trusting the judge

A judge with a bad rubric produces confident, wrong scores.

navigate 18/41

## Page 19

LLM AS A JUDGE

LLM judges fail when criteria are vague

x VAGUE v SPECIFIC

“Response is helpful" “User could act on this without follow-up"
"Demonstrates strategic thinking" "Identifies 22 trade-offs with concrete examples"
"Good quality" "All facts verifiable from cited sources"

If you cannot write what 5/5 means, neither can a judge—or a human grader.

navigate

19/41

## Page 20

navigate

STAGE 04

Rubrics

/41

## Page 21

RUBRICS

Rubrics score across four weighted dimensions

DIMENSION WEIGHT
Relevance 30%
Accuracy 40%
Completeness 20%
Clarity 10%

Weighted average — one trendline; watch accuracy especially.

navigate

QUESTION

Does it address the question?

Are the facts correct?

Does it fully answer?

Is it easy to understand?

21/41

## Page 22

Anchors first—then map scores to action

RUBRICS.YAML

accuracy:
weight: 0.4
scores:
5: "ALL facts correct and verifiable from cited sources"
"Mostly correct with one minor inaccuracy"

3
1: "Contains significant errors or misleading information
@: "Completely incorrect or fabricated"

BAND ACTION

4.5-5.0 Ship

3.5-4.4 Minor tweaks

2.5-3.4 Review

<25 Block—fix before release

No written anchors — no consistent "3"—human or LLM.

navigate 22/41

## Page 23

BEYOND STATIC LABELS

Reinforcement
learning

When

## Page 24

REINFORCEMENT LEARNING

Supervised learning vs reinforcement learning

PARADIGM WHAT YOU HAVE
Supervised Input + correct output (labels)
Reinforcement Actions + a reward (number or preference)

RL fits when there is no single right transcript — only better or worse outcomes.

navigate

WHAT THE MODEL LEARNS

"For this prompt, say exactly this."

"Behaviors that earn higher reward.”

24/41

## Page 25

— REINFORCEMENT LEARNING

The RL loop (high level)

Agent picks an action

v

Environment responds (state changes)

v
Reward: +1 helpful, -1 harmful, 0 neutral

v
Update the policy ~ repeat

The agent is not told the correct move — only whether the last move was good. Over many rounds, it shifts toward actions that collect more reward.

navigate

25/41

## Page 26

REINFORCEMENT LEARNING

Same loop outside chat

Games Move = score / win-loss
Robotics Commands -— success or penalty
Recsys Show item = click or dwell time

Same pattern: actions — outcomes — reward signal — update behavior.

navigate 26/41

## Page 27

Related “learn-from-a-signal” ideas

GANs Not RL: generator vs discriminator (critic). Still “learn from a scorer" when you lack a perfect target output.

Distillation Not RL: a smaller student learns to imitate a larger teacher (or an ensemble). It's another way industry turns expensive quality into cheap behavior.

Thread: critic, preference, or teacher instead of labeling every “correct” output by hand.

navigate 27/41

## Page 28

REINFORCEMENT LEARNING

What this looks like for LLM products today

Humans give feedback
Correct the answer, thumbs up/down, or rank two replies (A vs B).

Turn it into training data
Pairs and preferences become a dataset: "this output is better than that one for this input.”

Close the loop
Fine-tune from those preferences (e.g. RLHF, DPO), or run an outer loop that rewrites prompts / system instructions and keeps versions that raise scores on your harness — automatic prompt

optimization is the same idea

Your rubrics and replay harness are the reward side; the harness that edits prompts or retrains the model is the learning side.

navigate 28/41

## Page 29

STAGE 05

Experiments

## Page 30

navigate

EXPERIMENTS

Experiments replace intuition with evidence

i T T T T 1
| Variant | Pass % | Rubric | Latency | Cost |
L i i + i i
i T T T 1
| baseline | 37% | 4.1/5 | 1.2s | $0.003 |
| gpt-4o | 93% | 4.5/5 | 2.1s | $0.015 |
| new_prompt | 91% | 4.3/5 | 1.3s | $0.003 |
L 1 1 i 1 J

new_prompt gets 91% of gpt-40 quality at 20% of the cost. That's a data-driven decision.

30/41

## Page 31

navigate

EXPERIMENTS

One variable at a time

One change per experiment lsolate variables to understand impact

Same test set every time Apples to apples

Track cost 6% quality gain at 5x cost may not be worth it
Version your prompts Store them as files; commit to git

31/41

## Page 32

WHAT NOT TO DO

The three eval
anti-patterns

## Page 33

ANTI-PATTERNS

Rubrics that fool humans—and LLM judges

These traps show up in subjective human eval and in LLM-as-judge setups. A mushy rubric confuses two people the same way it confuses a model; the judge just

automates inconsistency unless the criteria are concrete.

TRAP

Unanchored scale

Vague trait

Form instead of substance

navigate

EXAMPLE CRITERION

1-5 “overall quality"

“Demonstrates strategic thinking”

“300-500 tokens,” “three paragraphs,”

“includes a summary section"

WHAT GOES WRONG

No shared meaning per number—graders disagree; an LLM anchor-drifts run to run.

Everyone invents their own definition; the model fills in blanks unpredictably.

A form proxy. you score something easy to count (length, structure, boilerplate) instead of whether
the answer is correct, grounded, or useful—so polished garbage can beat a short correct reply.

BETTER DIRECTION

Define every score in plain language (what 3 vs 4
looks like).

Replace with falsifiable checks—e.g. “names 22
trade-offs with examples.”

Score outcomes: e.g. answers every part of the
question, cites sources, no unrequested filler.

33/41

## Page 34

ANTI-PATTERNS

They all describe form, not quality

Length, scale labels, and vague terms are proxies for quality — not quality itself.

Rule: you can point to one example that clearly passes and one that clearly fails—otherwise the criterion is not done.

navigate 34/41

## Page 35

GOOD PRACTICES

The opinionated version

## Page 36

navigate

GOOD PRACTICES

Binary checks first; anchor rubrics before you scale judges

EVALUATOR.PY

assert "vector_search" in actual_tools
assert "refund_policy.md" in response
assert "I don't know" not in response

No API spend, no calibration—use asserts wherever the spec is crisp.

STEP
1. Write anchors (at least 0, 3, 5)
2. Hand-score ~20 examples

3. Run judge on same set; fix rubric until r > 0.8

Reserve LLM judges for what you cannot assert.

WHY
Define quality before you measure
Ground truth

Trust, then scale

36/41

## Page 37

navigate

GOOD PRACTICES

Cadence—and a practical bootstrap order

Every commit + Golden sets
Every release + Labeled scenarios
Weekly ~ Replay harnesses
Before ship + Rubric runs
Any change ~ Experiment

Bootstrap: golden cases = tags = record prod fixtures = rubric YAML = calibrate judge + A/B meaningful changes.

Earlier catches are cheaper fixes.

(regressions)
(coverage)
(deep dive)
(multi-axis)
(one variable)

37/41

## Page 38

— EXAMPLES

HR policy copilot (RAG)

Setup (hypothetical): Employees ask, “How many PTO days roll over?” The agent should call vector_search , cite the real policy doc, and quote the correct number—
not guess or cite onboarding instead of the PTO page.

LAYER WHAT YOU MIGHT ACTUALLY BUILD

Golden sets ~15 cases: assert tool, expected doc (e.g. pto_policy.md ), must_contain the right figure, must_not_contain hedge phrases or wrong numbers.

Labeled scenarios Tags: PTO vs benefits vs leave-of-absence; straightforward vs ambiguous; single-tool vs multi-tool—drive a coverage matrix so you see blind spots.

Replay harness Record a bad prod thread (wrong doc, confident wrong number) as JSON; replay after every change—same inputs, comparable scores, no re-spend on the live failure.
ML metrics + judge —_Recall/precision on retrieved chunks; LLM judge for claim-level groundedness vs the cited source—calibrated against HR reviewers on a fixed slice.

Rubrics. Weighted accuracy + completeness + clarity with anchors ("5 = every stat matches source sentences") so trend lines mean something.

Experiments. Same 80-case suite: baseline vs new system prompt vs smaller model; table pass %, rubric mean, latency, $—pick a Pareto point, not a vibe.

RL/ feedback loop _—_ Experts correct answers or rank A/B; log (prompt, chosen response); fine-tune with DPO/RLHF or run prompt search that maximizes mean rubric score on the harness—your eval is the reward

navigate 38/41

## Page 39

— EXAMPLES

Code-review assistant

Setup: Suggests patches on pull requests; failure mode is plausible-looking API calls that do not exist or break tests.

Golden Assert suggested diff applies cleanly, required tool ran (e.g. run_tests ), output contains passing test summary, no banned imports.

Labeled + replay Tag by language, monorepo package, “security-sensitive”; freeze nasty PR threads as fixtures.

Judge + rubric Ground claims in repo + docs; rubric for correctness vs style—anchors so “correct” means something engineers agree on

Experiments + RL A/B model and prompt on the same PR suite; thumbs-down on bad suggestions — preference pairs — same outer loop (train or auto-prompt against the harness).

The pattern ports anywhere you combine tools, retrieval, and subjective quality—support bots, sales drafts, internal search agents.

navigate 39/41

## Page 40

— SUMMARY

Summary

Golden sets through experiments give you gates and comparable scores. The same numbers pick A/B winners and support RL-style updates—preferences, reward
models, prompt search—because the harness is what “better” means.

Ahead (where the field is going):

¢ Always-on learning loops: post-deployment feedback continuously updates behavior, not just periodic RLHF refreshes.
More verifiable rewards: training signals come from tool execution, tests, and external checks, not only LLM judges.

True multi-objective optimization: systems jointly optimize quality, latency, cost, and safety with explicit trade-offs.

Before: "The new prompt feels more accurate."
After: "Same suite: rubric 4.3 vs 4.1, +4% golden passes, flat Latency—
thumbs-down feeds the next preference batch."

navigate 40/41

## Page 41

Build the harness.
Close the loop.

Start with a small golden set and run it every commit. Layer coverage, replay, and rubrics until “better” is measurable—then use that signal
for experiments and for RL, feedback, and prompt optimization.

