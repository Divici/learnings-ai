# Designing RAG Systems

> Converted from PDF to Markdown with OCR.

## Page 1

@ Gauntlet

What RAG Actually Solves

RAG is used when knowledge is too large for prompts, changes over time, or is
incomplete and fragmented. It's not about adding more text to your prompts. Rather,
it's about controlling what the model knows and when it knows it.

The fundamental problem RAG solves is the gap between what language models
can hold in their context windows and what they need to know to provide accurate,
up-to-date answers. This is a control problem, not a scaling problem.

Designing RAG Systems

Architecture, Tradeoffs, and Decision-Making

Knowledge Too Large

Context windows have limits

Knowledge Changes

Static training becomes stale

Knowledge Fragments

## Page 2

Information is distributed

@ Gauntlet

RAG Is a Control Problem

At its essence, RAG is about controlling three critical dimensions: what enters the
prompt, when retrieval happens, and how much uncertainty is acceptable in your

system.
What Enters the Prompt When Retrieval Happens
You decide which information Timing matters. Pre-fetch? On-
makes it into the context window. demand? Multi-hop? Each choice
This is filtering, ranking, and has latency and accuracy

selection. implications.

How Much Uncertainty

Every system has a tolerance threshold. Define yours explicitly or it will define
itself.

@ Gauntlet

Core Design Tradeoffs

## Page 3

Every RAG system navigates a complex optimization space. You cannot maximize all dimensions simultaneously—understanding these
tradeoffs is the foundation of good system design.

Recall Precision Latency
Did we retrieve everything relevant? High Is the context actually useful? High How fast must the answer arrive? Speed
recall means fewer missed facts but more pre n reduces hallucination but risks constrains how many retrieval hops and
noise to filter. missing edge cases. re-ranking passes you can afford.
Cost Complexity
Tokens, models, infrastructure. Every retrieval, embedding, and Can humans debug this? Sophisticated architectures improve
generation has a price tag. metrics but make failure diagnosis exponentially harder.

@ Gauntlet

The Full RAG Lifecycle

RAG failures rarely happen during retrieval itself. They happen in data ingestion, chunking decisions, metadata design, ranking logic, and
evaluation feedback loops. Understanding the full pipeline is essential.

1 2 3 4

Ingest and Structure Chunk and Enrich Embed and Index Retrieve
Data

Break into semantic units, Generate embeddings, buil Query indexes, apply filters,
add contextual metadata vector and keyword indexes fetch candidates

## Page 4

Parse documents, extract
metadata, normalize formats

5 6 7 8
Rank and Filter Reason and Generate Evaluate Outputs Update System
Re-score results, apply Construct prompts, call LLM, Measure quality, log failures, Refine prompts, adjust
relevance thresholds synthesize outputs identify patterns rankings, retrain models

@ Gauntlet

Design From Observed Failures

Start where it matters most: what breaks in practice.
p 1 Wrong Answers

Design your RAG system by Add re-ranking, improve evals, refine prompts

Deploying a simple baseline

2. Observing concrete pain points 2 Missing Facts
3. Identifying specific failure modes co.

Implement query expansion, increase recall
4. Adding only the complexity needed to fix them

3 Too Much Noise

Apply metadata filtering, improve chunking

4 Slow Responses

Add compression, reduce retrieval hops

Poor Reasoning

## Page 5

2 Use decomposition or multi-hop retrieval

@ Gauntlet

PATTERN

Baseline: Naive RAG

The Starting Point

Strengths
Chunk Documents

e Fast to build and deploy

* Easy to reason about and debug
Embed Chunks oo :

e Minimal infrastructure requirements

¢ Clear failure modes

Vector Search

Weaknesses

e No precision control mechanisms
Stuff Into Prompt e Poor scalability with corpus size

* Semantic search limitations
Generate Answer © No ranking optimization

@ Gauntlet

## Page 6

[parrenw |
Metadata-Filtered RAG

Constrain Before You Retrieve

Metadata filtering reduces the search space before vector similarity
runs.

This approach dramatically improves precision by eliminating

irrelevant documents early in the pipeline, but requires careful

metadata design during ingestion

Common Filter Dimensions

e Tenant / User: Enforce access control and personalization
Date Range: Retrieve only current or historical data
e Document Type: Limit to specific formats or categories

e Access Level: Security and permission boundaries

@ Gauntlet

## Page 7

PATTERN

Hybrid RAG (Vector + Keyword)

Semantic Search Is Not Enough

Hybrid retrieval combines vector similarity (meaning) with keyword matching (exact matches). This dual approach captures both semantic

understanding and lexical precision.

Vector Similarity

Captures seman
Excellent for natural language and fuzzy matching.

Use When

¢ Codebases with function names and APIs

e Log analysis and error messages

@ Gauntlet

meaning and conceptual relationships.

Keyword / BM25

lentifiers,

Ensures exact term matching. Critical for technical

error codes, and precise terminology.

e Legal or technical documentation

e Systems requiring exact identifier matches

## Page 8

RAG Fusion

Users Ask Bad Questions

Real users rarely ask perfectly formed queries. They use ambiguous language, omit
context, and phrase questions poorly. Fusion transforms weak queries into multiple
targeted searches.

Generate Query Variants Retrieve for Each

Create multiple phrasings of the Execute parallel searches across
same question variants

Merge and Dedupe

Combine results and remove duplicates

Use When

This improves coverage, not
¢ Queries are vague precision. Expect more
© Recall is weak results, not better ones.

e Users are non-technical

@ Gauntlet

## Page 9

Multi-Hop RAG

When Reasoning Requires Multiple Steps

Some questions cannot be answered with a single retrieval pass. Multi-hop RAG
uses retrieved context to generate intermediate reasoning, then retrieves again
based on that reasoning

Initial Retrieval Generate Intermediate Answer

Fetch context based on original query Reason over first-pass results

Secondary Retrieval Synthesize Final Output
Use intermediate answer to retrieve Combine all context for complete
deeper context answer
@ Gauntlet
PATTERN
Context Compression RAG
Tokens Are a Hard Constraint
Tradeoff Analysis

Retrieve Large Documents
Risk:

## Page 10

| Fetch comprehensive context without token limits Potential information loss during compression. Critical details may
be summarized away.

Summarize or Extract Benefit:

Apply compression to reduce token count while preserving key Massive cost and latency sa
format 90%.

gs. Can reduce token usage by 70-

Pass Compressed Context

Send only essential information to generation step

@ Gauntlet

## Page 11

PATTERN
Graph RAG

Relationships Matter More Than Text

Graph RAG retrieves entities, relationships, and connected context from knowledge
graphs. This approach excels when understanding requires navigating complex
relationships.

What Graph RAG Retrieves

e Entities: People, places, organizations, concepts
e Relationships: How entities connect and interact

e Connected Context: Multi-hop traversal of the graph

Strengths Costs
e Multi-hop reasoning e Expensive to maintain graphs
through relationship ¢ Requires entity extraction and linking

chains
e Hard to keep synchronized with source data

e Global structure

¢ Complex query logic
understanding

e Inference over implicit
connections

© Use only when relationships dominate. For most text-heavy use cases,
vector search suffices.

@ Gauntlet

## Page 12

PATTERN

Agentic RAG

Retrieval Becomes a Decision

In Agentic RAG, the system decides whether to retrieve, which source to use, and when to stop. This transforms RAG from a fixed pipeline into an
adaptive decision-making system.

Whether to Retrieve Which Source to Use When to Stop
Agent evaluates if retrieval is necessary Multiple knowledge bases or tools Agent determines completion criteria
or if it already has sufficient context to available—agent selects the most rather than following fixed iteration
answer. appropriate. counts.

Agentic RAG Enables

e Long-running tasks that span multiple sessions
e Tool-using systems that integrate with external APIs

e Autonomous workflows that adapt to results

@ Gauntlet

STRATEGY

## Page 13

Time Constraints Drive Architecture

Technical feasibility means nothing if the user experience fails. Your architecture must fit within real-world latency budgets and interaction
patterns. These constraints are not limitations—they're design requirements.

Under 1 Second 1-3 Seconds Async / Long-Running

Simple retrieval only. Single pass, no re- Re-ranking allowed. Can afford one Multi-hop and agents enabled. Users
ranking, minimal processing. Users additional processing step. Users tolerate don't expect immediate results. Optimize
expect instant responses. brief waits for better accuracy. for thoroughness over speed.

@ Gauntlet

## Page 14

STRATEGY

Interaction Type Drives Evals

The way users interact with your RAG system directly dictates its eval priorities. Different interaction models demand different tradeoffs in
precision, recall, and reliability, shaping what your architecture must prioritize.

Chat Research Automation.

Precision first-wrong answers erode Recall first—missing information is often Reliability gating—errors can compound
user trust quickly. worse than some noise. silently and have significant downstream
The system must prioritize accuracy and Users are typically prepared to sift effects without human oversight.
conciseness in direct conversation. through results for comprehensiveness. Robust validation is crucial

@ Gauntlet

## Page 15

PRODUCTION

When NOT to Use RAG

RAG solves uncertainty, not logic. Recognizing when RAG is the wrong solution is
as important as knowing when to apply it.

Knowledge Is Small and Static

Use prompts directly. RAG overhead isn't justified

Logic Must Be Deterministic

Use rules engines. RAG introduces probabilistic behavior.

Data Is Live and Transactional

Use tools and APIs. RAG works on indexed snapshots.

Answers Require Computation

Use code execution. RAG retrieves, it doesn't compute.

@ Gauntlet

PRODUCTION

## Page 16

Production Failure Modes

What Breaks in Real Systems

Production RAG systems fail in predictable ways. Understanding these failure modes helps you build defensive architectures and monitoring

systems that catch problems before they reach users.

Stale Embeddings Silent Empty Retrieval Prompt-Context Coupling

Source documents update but No results found but system doesn't Prompt changes break existing retrieval.
embeddings don't. Retrieval returns = surface this. LLM generates from oO Tight coupling makes iteration fragile
outdated context leading to incorrect memory, guaranteeing hallucination. and risky.

answers.

Ranking Drift Eval Dataset Decay

Relevance scores shift over time. Previously working queries 9S Evaluation data becomes stale. You're measuring yesterday's
start failing without code changes. system against yesterday's queries.

[rrooucro
Evals Close the Loop

RAG Without Evals Is a Demo

Evaluation transforms RAG from a prototype into a learning system. Without continuous measurement, you're flying blind—unable to detect
regressions, validate improvements, or understand failure modes.

## Page 17

What to Measure
Evaluate steps separately
e Retrieval Recall: Are we finding relevant documents?
Don't conflate failures. Bad retrieval and bad generation require

¢ Precision: Is retrieved content actually useful?
different fixes.

e Correctness: Are generated responses accurate?
« Latency: Are we meeting UX requirements?

© Cost: Are we operating within budget constraints? Build eval datasets from production logs

Real user queries reveal failure modes synthetic data misses.

@ Gauntlet

PRODUCTION

RAG Maturity Path

How Systems Actually Evolve

Naive RAG

ob

Starting point

Better Chunking

Semantic boundaries

Metadata Filtering

Constrained search

Hybrid Retrieval

## Page 18

@ Gauntlet

Vector + keyword

Re-ranking

Precision improvement

Query Expansion

Coverage increase

Agentic Control

Adaptive decisions

