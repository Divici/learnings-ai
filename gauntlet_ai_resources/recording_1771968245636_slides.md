# recording_1771968245636_slides

> Converted from PDF to Markdown with OCR.

## Page 1

Evals That
Actually Work

A 5-Stage Framework for Production Al Quality

## Page 2

"How do you know your Al is good?"

If your answer is "we tested it manually" or "it looked fine in review" — you don't have an eval strategy.

## Page 3

e

3) navigate

THE PROBLEM

Without evals, you're flying blind

Without Evals

¢ Guess if changes helped
e Find regressions in production
e Debate quality subjectively

e Ship and hope

With Evals

« Measure if changes helped
¢ Catch regressions before shipping
« Compare quality with data

e Ship and know

03/39

## Page 4

THE FRAMEWORK

Five stages, each building on the last

Golden Sets Labeled Scenarios Replay Harnesses

Start at Stage 1. Add stages as your system matures.

Rubrics

Experiments

## Page 5

STAGE 01

Golden Sets

## Page 6

GOLDEN SETS

Golden sets define what "correct" looks like
Small (10-20 cases). Fast to run. If these fail, something is fundamentally broken.

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

- "no information

>) navigate 06/39

## Page 7

e

navigate

GOLDEN SETS

Golden sets use four types of checks

CHECK WHAT IT CATCHES

Tool selection Agent used the wrong tool
Source citation Agent cited the wrong document
Content validation Response is missing key facts
Negative validation Agent hallucinated or gave up

These are code evals — deterministic, binary, no LLM needed.

07/39

## Page 8

>) navigate

GOLDEN SETS

Deterministic checks beat probabilistic judges

EVALUATOR.PY

# Tool selection

assert "vector_search" in actual_tools #

# Source citation

assert "refund_policy.md" in response_text #

# Content validation

assert "30-day" in response_text #
assert "$500" in response_text #

# Negative validation

assert "I don't know" not in response_text #

Zero API cost. Zero ambiguity. Run after every commit.

or

or

or
or

or

08/39

## Page 9

>) navigate

GOLDEN SETS

Four rules for golden sets that stay useful

Start small 10-20 quality cases beats 100 sloppy ones
Run on every commit These are your regression tests
Add from production bugs Every bug becomes a test case

Never Change expected output just to make tests pass

## Page 10

STAGE 02

Labeled Scenarios

## Page 11

>) navigate

Labeled scenarios are golden set cases with tags

SCENARIOS.YAML
- id: "sc-m-001"
query: "What's our refund policy and how many refunds last quarter?"
expected_tools: ["vector_search", "sql_query"]
category: multi_tool
subcategory: vector_and_sql
difficulty: straightforward

The tags don't change how the test runs — they change what the results tell you.

11/39

39

## Page 12

LABELED SCENARIOS

Organize by category — empty cells show you where to write tests next

| vector | sql | jira | slack | multi |
eee [Jeseesses||ecoess|]ooescs||scecees||aeccass||
straightforward | 3/3 | 2/3 | 2/2 | 2/2 | 1/1 |
ambiguous | 4/2 | 1/2 | 6/1] 1/1 | 6/1 |
| | | |

edge_case 1/1 | 1/1 | --

## Page 13

3) navigate

LABELED SCENARIOS

Golden sets and labeled scenarios answer different questions

Golden Sets: "Does it work?" > correctness
Labeled Scenarios: "Does it work for all types?" + coverage

GOLDEN SETS LABELED SCENARIOS
Size 10-20 30-100+
All must pass? Yes No

When to run Every commit Every release

13/39

## Page 14

STAGE 03

Replay Harnesses

## Page 15

REPLAY HARNESSES

Record once. Score anytime.
Capture a real session to a JSON fixture. Evaluate that frozen snapshot whenever you want — immediately, next week, or after a human has annotated ground truth.

RECORDER.PY / PLAYER.PY

# Record once (costs tokens)

session = record_session(
query="What's our refund policy and how many refunds in Q4?",
session_id="refund-001"

)

# + saves to fixtures/refund-001.json

# Replay forever (costs nothing)
replayed = replay_session("refund-001")
scores = evaluate_session(replayed)

Record production examples. Real queries make the best test cases.

©) (3) navigate 15/39

## Page 16

REPLAY HARNESSES

Stage 3 introduces ML-grade metrics

METRIC WHAT IT MEASURES

Precision How many retrieved docs are relevant?

Recall How many relevant docs were retrieved?
Groundedness Is the response grounded in sources?
Faithfulness Does it stay true to sources (no hallucination)?
Tool Accuracy Did it use the correct tools?

Groundedness and faithfulness require an LLM judge — which we'll cover next.

=) (5) navigate

16/39

## Page 17

Use it right,
or don't use it

## Page 18

LLM AS A JUDGE

The judge checks claims against sources

# Is this claim supported by the source?

claim: "We offer 30-day refunds"

source: refund_policy.md + "...30-day refund window..."
result: ¥ grounded

claim: "We offer 60-day refunds"

source: refund_policy.md + "...30-day refund window..."
result: x not grounded (hallucination)

The judge makes a binary call per claim, then aggregates into a groundedness score.

©} |) navigate 18/39

## Page 19

e

navigate

Calibrate before you ship the judge

CALIBRATION.PY

# Step 1: Score 20 examples by hand
human_scores = [4, 3, 5, 2, 5, 4, 3, ...

# Step 2: Run the LLM judge on the same examples
llm_scores = [4, 4, 5, 3, 5, 3, 3, ...]

# Step 3: Check correlation

correlation(human_scores, 1lm_scores)
# If < 0.8, your rubric is broken — fix it before trusting the judge

A judge with a bad rubric produces confident, wrong scores.

19/3

## Page 20

e

3) navigate

— LLM AS A JUDGE

LLM judges fail when criteria are vague

> VAGUE v SPECIFIC

"Response is helpful" "User could act on this without follow-up"
"Demonstrates strategic thinking" "Identifies =2 trade-offs with concrete examples"
"Good quality" "All facts verifiable from cited sources"

If you can't describe what 5/5 looks like in concrete terms,
the judge can't score it — and neither can a human.

20/39

## Page 21

e

na

vigate

STAGE 04

Rubrics

How good, not

t whether

ssed

39

## Page 22

e

navigate

RUBRICS

Rubrics score across four weighted dimensions

DIMENSION WEIGHT
Relevance 30%
Accuracy 40%
Completeness 20%
Clarity 10%

QUESTION

Does it address the question?
Are the facts correct?

Does it fully answer?

Is it easy to understand?

Weighted average > single quality score. Track trends. A 5% drop in accuracy is a red flag.

22/39

## Page 23

e

navigate

RUBRICS

Every score needs an explicit anchor

RUBRICS.YAML

accuracy:
weight: 0.4
scores:

Bg

No anchor = no consistency. A judge that interprets "3" differently each run is useless.

"ALL facts correct and verifiable from cited sources"

3: "Mostly correct with one minor inaccuracy"
alg
0: "Completely incorrect or fabricated"

"Contains significant errors or misleading information"

23/39

## Page 24

>) navigate

RUBRICS

Score thresholds tell you what action to take

SCORE QUALITY ACTION

4.5-5.0 Excellent Ship it

3.5-4.4 Good Minor tweaks

2.5-3.4 Acceptable Review and improve
1.5-2.4 Poor Significant work needed
0-1.4 Critical Stop. Fix now.

24/39

## Page 25

STAGE 05

Experiments

## Page 26

EXPERIMENTS

Experiments replace intuition with evidence

[ T T

| Variant | Pass % | Rubric | Latency | Cost |
I t t t t
| baseline | 87% | 4.1/5 | 1.2s | $0.003 |
| gpt-4o0 | 93% | 4.5/5 | 2.1s | $0.015 |
| new_prompt | 91% | 4.3/5 | 1.3s | $0.003 |
l 1 |

new_prompt gets 91% of gpt-4o quality at 20% of the cost. That's a data-driven decision.

©} |) navigate 26/39

## Page 27

e

3) navigate

EXPERIMENTS

One variable at a time

One change per experiment lsolate variables to understand impact

Same test set every time Apples to apples

Track cost 6% quality gain at 5x cost may not be worth it
Version your prompts Store them as files; commit to git

27/39

## Page 28

WHAT NOT TO DO

The three eval
anti-patterns

## Page 29

— ANTI-PATTERN 1

The Likert trap

"Rate the quality of this response: 1 (poor) to 5 (excellent)"

What happens Human A gives "3" for adequate answers. Human B gives "4". Aggregated scores are noise, not signal.

Fix Define every point on the scale. If you can't write the anchor, you haven't done the work.

©) (3) navigate 29/39

## Page 30

— ANTI-PATTERN 2

Vague criteria

"The response demonstrates strategic thinking"

Problems "Strategic thinking" is undefined. Two evaluators will score differently. An LLM judge will hallucinate a definition. You can't tell
what improvement looks like

Fix Make it falsifiable: "Response identifies =2 explicit trade-offs with concrete examples"

©) (3) navigate 30/39

## Page 31

— ANTI-PATTERN 3

Ambiguous ranges

"The response length should be between 300 and 500 tokens"

Problem A 450-token response that misses the question passes. A 250-token response that perfectly answers it fails. This criterion
measures form, not quality.

Fix Describe what good looks like: "Answers all parts of the question; does not include unrequested information"

©) (3) navigate 31/39

## Page 32

ANTI-PATTERNS

They all describe form, not quality

Length, scale labels, and vague terms are proxies for quality — not quality itself.

The rule: A criterion is done when you can write a concrete example that unambiguously passes and one that unambiguously fails.

If you can't do that, keep writing.

©) (3) navigate 32/39

## Page 33

GOOD PRACTICES

The opinionated version

## Page 34

Use binary checks where you can

EVALUATOR.PY

# Specific. Deterministic. Fast.

assert "vector_search" in actual_tools
assert "refund_policy.md" in response
assert "I don't know" not in response
assert "$500 annual stipend" in response

Binary checks have zero calibration cost, zero API cost, and produce the same result every run.

Reserve LLM judges for what can't be checked programmatically.

34/39

©) () navigate

## Page 35

e

3) navigate

GOOD PRACTICES

Write rubric anchors before you run any evals

STEP

1. Write score anchors (0, 3, 5 minimum)
2. Score 20 examples by hand

3. Run LLM judge on same examples

4. Adjust until correlation = 0.8

5. Then run at scale

WHY

Forces you to define quality

Creates ground truth

Measures calibration

Validates the judge

Now you can trust it

35/39

## Page 36

GOOD PRACTICES

Match the eval to the moment

Every commit ~ Golden sets (5 min, catch regressions)
Every release + Labeled scenarios (coverage check)

Weekly + Replay harnesses (deep quality analysis)
Before shipping - Rubric evals (multi-dimensional scoring)
On any change > Experiment (validate the hypothesis)

The earlier you catch a regression, the cheaper it is to fix.

©) (3) navigate 36/39

## Page 37

GOOD PRACTICES

Build your eval stack in six steps

Write 10-15 golden cases today
Tools, sources, content checks, negative validation

Label them by query type and difficulty

2
Category, subcategory, complexity
3 Record real production sessions as fixtures
Real queries make the best test cases
A Define rubrics with explicit anchors
Every score point needs a concrete description
5 Calibrate your LLM judge against human scores
Target correlation = 0.8 before running at scale
6 A/B test every meaningful change

One variable at a time

©) {5) navigate

## Page 38

THE GOAL

Make "is this better?" a question you answer with data

Before: "I think the new prompt is better, it felt more accurate"

After: "The new prompt scored 4.3/5 vs 4.1/5 on accuracy,
passed 91% of golden cases vs 87%,
with no change in latency or cost"

That's the difference between guessing and shipping with confidence.

>) navigate 38/39

## Page 39

Start at Stage 1

10-15 golden cases, run after every commit. Add stages as your system matures.

