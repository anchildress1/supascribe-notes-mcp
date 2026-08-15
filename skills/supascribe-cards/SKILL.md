---
name: supascribe-cards
description: Invoke for any operation on the user's Supascribe index card system. Triggers include "create cards", "add to supascribe", "log this as a card", "save as an index card", "make cards for [project]", "write cards", "card this up", "log this decision", "audit cards", "review my cards", "supascribe", "project cards", and any reference to the user's index-card knowledge system — even brief or oblique. Mandatory whenever cards are involved; bypassing produces card shapes the user has rejected and will flag.
---

# Supascribe Cards

Operating rules for reading, writing, and auditing Ashley Childress's index-card
corpus. Every rule below is a gate, not a suggestion.

**Reader model:** a recruiter, hiring manager, or technical peer evaluating her
work. They have no context beyond the card. Optimize every field for that reader.

**What the corpus is not:** it is not a resume, and it is not a blog. Employment
history and certifications belong to the About page; long-form narrative belongs
to the blog, which is linked from the site and indexed separately for the agent.
A card that duplicates either one is dead weight even when it is true.

---

## 0. Hard gates

Do not call `write_cards` unless ALL are true:

1. Pre-flight (§1) ran this session.
2. Every new or changed title and blurb was shown in chat and the user confirmed.
3. Every category exists in `lookup_categories` output.
4. Every lvl0/lvl1 tag exists in `lookup_tags` output.
5. Every card passes the decision test or an explicit non-decision exception
   (§2.1–§2.2), plus the fact constraints (§3.4).
6. No card names its own principle (§3.5).

Never call `write_cards` during an audit. Audits report; the user decides.

---

## 1. Pre-flight — mandatory, parallel, every session

```
lookup_projects      → confirm the project key exists verbatim
lookup_categories    → the only legal category values
lookup_tags          → the only legal lvl0/lvl1 values
search_cards(...)    → 5-10 existing cards per target category, for calibration
```

If the project key is absent: **stop and ask.** Never invent one.
If a needed tag is absent: **surface it and stop.** Never invent one.

### 1.1 Uniqueness

**MCP only. No SQL, no DDL, no migrations — ever.**

Server enforces `UNIQUE` on `title`, `blurb`, `fact`. Soft-deleted cards keep
those values reserved while being invisible to search.

| Check                 | Method                                        | Result                              |
| --------------------- | --------------------------------------------- | ----------------------------------- |
| Within batch          | Pairwise compare all three fields             | Reliable                            |
| Against live cards    | `search_cards` on the most distinctive phrase | Loose — read hits, don't trust zero |
| Against deleted cards | None available                                | **Blind spot**                      |

On an update, same-`objectID` match is expected; different `objectID` is a
collision.

Blind spot mitigation: when a value reuses phrasing that may have existed before
(rewrite of a deleted card, recycled title, boilerplate), **write one card per
call.** A failed single write is an unambiguous collision. A failed batch may be
partially written — re-read every card in it before retrying.

Surface collisions. Never paraphrase to evade the constraint. Never mutate the
matching card without confirmation. State plainly that deleted-card collisions
were unchecked; never imply otherwise.

Gap closes when an MCP tool does exact-match on `title`/`blurb`/`fact` including
deleted rows.

---

## 2. The decision test

> **Was something decided, and does the card say why?**

That is the whole filter. Two fields, both already on the card.

**A card is not a decision unless it displays evidence of one.** Evidence means
something pointable: an incident, an artifact, a number, a named alternative, a
thing that happened on a day. A disposition is not evidence. Naming a project in
the sentence is not evidence — "In SupaScribe Notes MCP, I avoid workarounds"
still contains no decision.

### Accept

- A choice with a named alternative and why the alternative lost.
- A reversal tied to an incident: what happened, what changed after.
- A milestone with measurable scale: a number, a before/after.
- A constraint with a reason.
- A lesson extracted from a concrete failure — especially one where the card
  admits being wrong. These consistently score highest in the corpus.
- **Fact of experience** — exposure to a named tool, framework, or domain
  through a named project. Valid even without a decision, because it answers
  "has she actually worked with X." Requires a named project AND a named
  capability.

### Reject

- Dispositions and self-description: "I challenge assumptions instinctively",
  "I design by hunting failure points", "guardrails are necessary".
- Anything already stated on the About page.
- Restatements of rules from `AGENTS.md`, `PRD.md`, `CONTRIBUTING.md`, or README
  policy sections.
- Tutorial content explaining how a domain works.
- Workflow minutiae any practitioner performs by default.
- Documentation prose describing what a tool _does_ rather than what she
  _decided_.
- **Biographical filler** — no named project, no named tool or domain, no
  decision. Birthplace, upbringing, relocation, sentiment about a place, music
  preference, aptitude-test anecdotes. Deleted from the corpus twice; do not
  reintroduce them.
- **Resume material** — job tenure, role progression, employer achievements,
  certifications. These live on the About page.
- Status notes: "the project is currently design-only". Narrow exception in
  §2.1.
- Slogan-shaped titles with no concrete decision attached.

### 2.1 Status notes — narrow exception

A status note is not a decision and never scores above 2, but a small number
earn a place because they go **stale rather than wrong**: they stop a reader
assuming a project is dead or finished. Keep at most one per project
("design-only", "experimental and unfinished", "originated as a hackathon
build"). Everything beyond that is filler.

### 2.2 Distinguishing fact-of-experience from biographical filler

Both are first-person and light on trade-off. The test: **can the reader point at
something?** "Carbon Trace exposed me to GSAP, Howler, Canvas2D, and PixiJS"
passes — named project, named tools. "Earlier work lived on internal systems"
fails on the same test, but survives as the one card that explains a decade-long
gap in a public GitHub history. Judgment calls like that go to the user.

Borderline cases: surface them. Never silently include.

---

## 3. Card shape

### 3.0 The three slots

Every decision card carries a fork, a call, and a cost.

| Slot         | Question                                              |
| ------------ | ----------------------------------------------------- |
| **The fork** | What was actually on the table                        |
| **The call** | Which way she went                                    |
| **The cost** | What the other option would have cost, or why it lost |

**No fork means no decision card.** That is not a formatting preference — it is
the decision filter in §2 restated in a form that can be checked sentence by
sentence. If the fork has to be invented, do not invent it. Status notes (§2.1)
and the explicit non-decision exceptions in §2.2 do not require these slots.

"Cost" here means _why the rejected path lost_, not what the chosen path cost
her. It is the reason, expressed as a comparison, and it usually already lives in
the sentence.

The three slots are a drafting template, not database fields. Do not label them
in the fact text.

### 3.1 Title

A complete claim stating the takeaway. The title alone must transmit the lesson.

Accept:

- "DATA_LICENSES.md collapsed from 1,844 lines to 273"
- "Stopped guessing emails after two same-day bounces"
- "I raised the model's temperature from 0 to 0.4 and moved the guardrails into SQL"
- "The model wrote 'fifty-six commits after midnight' about forty-seven"

Reject:

- Descriptive labels: "Stack: SvelteKit + Tailwind"
- Meta: "About the project", "Voice rules summary"
- Slogan abstractions: "Restraint is a deliberate engineering choice"

### 3.2 Blurb

One sentence, 10–15 words, restating the title's **claim** — using the same words
the title uses, not synonyms. For a decision card, that claim is the decision.
For a non-decision exception, it is the concrete experience or status; never
invent a decision to fill the field.

This is not style. `blurb` is a searchable attribute weighted `ordered`, so early
words carry more weight and a paraphrase into different vocabulary throws away
match surface for no gain.

Reject: two sentences, parentheticals, differentiator or moat vocabulary,
restating fact details instead of the title's claim.

### 3.3 What the index actually reads

Verified against the Algolia dashboard. Re-check if the config changes.

| Field       | Searchable            | Facet |
| ----------- | --------------------- | ----- |
| `title`     | ✅ ordered            | —     |
| `blurb`     | ✅ ordered            | —     |
| `projects`  | ✅ unordered          | ✅    |
| `category`  | ✅ unordered          | ✅    |
| `tags.lvl1` | ✅ unordered          | ✅    |
| `tags.lvl0` | ❌                    | ✅    |
| **`fact`**  | **❌ not searchable** | —     |

Two consequences that change how cards are written:

1. **The fact is invisible to keyword search.** It does its work _after_
   retrieval, when Ask AI or the chat agent reads the whole record. Write it for
   a model that already found the card, not to win a match.
2. **Title and blurb are the entire keyword surface.** A card whose title and
   blurb are vague is unreachable no matter how good the fact is.

`signal` is a hidden ranking attribute — never rendered, sorts descending.
`created_at_epoch` breaks ties.

**The table has `UNIQUE` constraints on `title`, `blurb`, and `fact`.** This does
not prevent duplication; it camouflages it. Historic near-duplicates differ by a
single word ("difficult" vs "hard") purely to satisfy the index. Never treat
"the text differs" as evidence two cards are distinct.

### 3.4 Fact — hard constraints

- **30–50 words. Under 30 is a reject, not a short card.** A fact too thin to
  stand alone tells a stranger nothing.
- 1–3 sentences. Claim → reasoning → stop.
- Four sentences violate the shape. Condense when they support one claim; split
  only when the extra sentence introduces an independent claim.
- First person. A fact with no `I` in it is usually describing a system instead
  of a decision — check it against §2 before keeping it.
- Never third person. "Ashley reframed it", "the author is a perfectionist" —
  both have appeared in the corpus and both were deleted.
- No internal repo paths (`src/lib/X.ts`), no "source of truth lives in".
- No "rejected: A, B, C" enumeration.
- No pitch vocabulary: "the moat", "the differentiator", "deliberately rejects".

Accept:

> "Registries publish full physical addresses. I store first name, last name,
> state, and country, and drop the street address — republishing home addresses at
> dataset scale is PII I don't want to carry and a lawsuit surface I don't want to
> defend."

Reject — too thin, nothing pointable:

> "Satisfaction comes from knowing the work is directionally correct rather than
> fully complete."

Reject — system voice, no decision:

> "The index operates under a closed-world assumption and explicitly avoids
> inferring information not present in canonical entries."

### 3.5 The virtue rule

**A decision-card fact states the decision and why the alternative lost. An
explicit non-decision exception states the evidence that qualifies it under §2.1
or §2.2. Neither names an abstract virtue or invents an alternative.**

Naming the virtue does the reader's thinking for them. It converts evidence into
a label, and a labelled card carries no more information than its tag already
does.

Reject — names the virtue, contains no decision:

> "I believe linters, formatters, and guardrails are necessary to keep systems
> stable and predictable."

Accept — same territory, states a decision and what it displaced:

> "I moved lint config into a shared package after the third repo diverged on
> import ordering. Every project now inherits rules it cannot locally override,
> which costs flexibility I decided nobody was using well."

Concrete test: **delete every abstract noun** from the fact — predictability,
quality, restraint, responsibility, performance, reuse, autonomy, privacy,
epistemics, ownership. If what remains no longer says anything, the card was a
label.

### 3.6 Voice

Decision and fact-of-experience cards use first person and past tense. Status
notes use first person and the tense required to state the current status
truthfully. Engineering self-reflection, not pitch.

Match:

- "I separated telemetry from identity data."
- "I capped the agent at one lookup, then removed the cap."
- "The crawler worked. I did not need it and the search tool both."

Reject:

- "X deliberately rejects Y" — pitch cadence
- "This is the moat / differentiator / advantage" — product copy
- "Web search confirms the pattern is novel" — arguing with a skeptic
- Any third-person reference to Ashley

### 3.7 Independence

Cards stand alone. No internal paths, no "see file X", no "captured in document
Y". The `url` field accepts only publicly accessible URLs — standards, articles,
registry sites, DEV announcement posts. Otherwise the claim carries itself.

---

## 4. Atomicity and repetition

One claim per card. A decision, its rationale, and its rejected alternative are
one claim and belong together. Split an independent second decision or an
architectural footnote that makes a separate claim. **Default to splitting only
when the takeaways remain independently useful.**

### 4.1 Duplication is directional

- **Within a project**, the same claim twice is noise. Cut one.
- **Across projects**, the same claim is **proof, not duplication.** It is the
  only evidence a pattern is real rather than aspirational. Three projects each
  showing "I plan before I build" is stronger than one.

Never demote or delete a card for repeating a claim made under a different
project key. **Rewrite it so each instance states its own project's version** —
the same conclusion reached through different specifics. Identical sentences
under different project keys are the failure mode; identical _conclusions_ are
the point.

---

## 5. Dated truth

**Judge a card against the day it was written, never against today.**

The system changes. A card describing the config as it stood in February is not
false in August — it is _dated_, and dated is the entire point of a decision log.

This distinction drives what happens to the card:

| The card is…                                             | Action                                    |
| -------------------------------------------------------- | ----------------------------------------- |
| **Wrong** — describes something that never happened      | Delete                                    |
| **Superseded** — was true, the decision later changed    | Demote, keep, write a new card            |
| **Stale config** — recorded a setting, the setting moved | Demote; the card recorded the wrong thing |

**Settings go stale. Reasons don't.** A card that records _what was weighed_
survives every config change. A card that records _what the value was_ rots the
moment someone edits a dashboard. When a card has rotted, the defect is that it
captured a setting instead of a reason — not that the author lied.

### 5.1 Supersede protocol

A rewrite that changes what the card claims is a **new card with a new ID and a
new date**. Editing in place erases that the earlier thing was ever believed,
which destroys the chronology the corpus exists to hold.

- New card: written normally, signal per §6.
- Old card: **kept live, demoted** — low signal sinks it below everything
  current while leaving it retrievable.
- There is no `supersedes` field. Signal does the work until there is one.

Edit in place only for mechanical fixes: typos, tag corrections, category moves,
voice cleanups that do not change the claim.

---

## 6. Signal — 1 to 10

Signal is a **sort key**, not a grade. The only question it answers is what order
things should appear in. The tiers are handles, not verdicts.

|        | Meaning                     | Test                                                      |
| ------ | --------------------------- | --------------------------------------------------------- |
| **10** | Proven outcome              | Someone external validated it — award, competitive win    |
| **9**  | Position with a cost        | She'd defend it in an interview and can name what it cost |
| **8**  | Decision, alternative named | The rejected option appears in the text                   |
| **7**  | Decision with a reason      | Alternative implied, not stated                           |
| **6**  | Decision, thin reasoning    | Something was chosen, the why is weak                     |
| **5**  | Lesson from an event        | Something happened and she learned from it                |
| **4**  | Fact of experience          | Named tool, named project, no decision                    |
| **3**  | Description                 | What the system does                                      |
| **2**  | Status or participation     | "I entered X", "currently design-only"                    |
| **1**  | Label                       | Names a virtue, contains no decision                      |

**The 8/7 break is the useful one** — it is the only line that asks whether the
rejected path is written down, which is what the corpus is most often missing.

**10 means externally validated and competitive.** Internal employer recognition
is not a 10 no matter how senior. Awards from the employer she works for cap
around 4–6.

Constraints and habits:

- Target roughly a pyramid. No bucket should exceed ~20% of the corpus.
- A signal-1 card is a deletion candidate, not a resting place. If it earns a 1,
  ask whether it earns existence.
- Do not bulk-assign. Signal discriminates only if it varies.
- **The database `CHECK` allows 1–10.** Confirm the MCP `write_cards` schema
  allows the same before writing anything above 5 — if it still validates 1–5,
  high-signal cards must be written at 5 and corrected afterward, or the schema
  updated first.

---

## 7. Categories

Use only values returned by `lookup_categories`. Sample similar cards via
`search_cards` before assigning.

Current set includes: About, Architecture, Awards, Constraints, Decisions,
Experience, Experimentation, Philosophy, Principle, Process, Work Style.
**Re-read the registry each session — it changes.**

- **About** — project-level introduction. Rare. Not a home for biography.
- **Decisions** — specific choices made. Most common.
- **Constraints** — what the system won't do.
- **Principle** — invariants she follows.
- **Philosophy** — deeper values driving the work.
- **Process** — how work gets done.
- **Architecture** — structural design choices, including choices about a system
  she built. A card describing how an agent or index behaves is Architecture,
  not Work Style.
- **Experience** — external truths treated as load-bearing.
- **Experimentation** — open-ended exploratory choices.
- **Work Style** — patterns in how _she_ works. Not how her systems work. This
  category has repeatedly absorbed agent-configuration cards; check Architecture
  first.

---

## 8. Tagging

Use only returned lvl0/lvl1 values. Per card: 1–4 lvl0, 2–5 lvl1.

### 8.1 The Restraint anti-default

`Principle > Restraint` has previously absorbed cards belonging to at least six
other principles, twice — 57% of principle-tagged cards before one cleanup, 62%
before the next. **It is the most over-applied tag in the corpus. Treat any
impulse to use it as a signal to check the alternatives first.**

| If the card is about…                                            | Tag                   |
| ---------------------------------------------------------------- | --------------------- |
| speed, latency, responsiveness, avoiding recalculation           | Performance           |
| refusing to guess, closed-world assumptions, not fabricating     | Epistemics            |
| attribution, disclosure, accountability, who authored what       | Responsibility        |
| stability, repeatability, deterministic behavior, guardrails     | Predictability        |
| PII, legal exposure, dropping sensitive fields                   | Privacy               |
| packaging patterns, shared config, encode-once                   | Reuse                 |
| observability, health checks, inspectable runtime state          | Operational Ownership |
| local control, licensing, self-direction, no external dependency | Autonomy              |

**Restraint applies only when the card is about declining to do something AND no
principle above names the reason more precisely.**

### 8.2 One principle per card

A card carrying two `Principle > *` tags is ambiguous ground truth. Assign
exactly one unless the card genuinely and equally serves two — rare, and it goes
to the user rather than being decided silently.

### 8.3 Issuer tags

Awards and employer-era cards carry `Issuer > *`. Cards with no project key and
no issuer are unreachable by every facet on the site — they surface only on a
full-text title or blurb match. If a card names an employer or institution and
the registry has a matching Issuer tag, apply it.

---

## 9. Write protocol

1. Pre-flight in parallel (§1).
2. List candidate atomic claims as short titles. **Confirm which to write.**
   Expect the user to cut; they usually want fewer than proposed.
3. Confirm the project key. If new, ask for the name verbatim.
4. Draft new or changed titles + blurbs **in chat**. Voice problems are cheap to
   catch here and expensive after a batch write.
5. Call `write_cards` only after explicit confirmation. Typical batch ≤ 8;
   schema permits 50.
6. Report returned IDs.

### 9.1 Updating an existing card

`write_cards` requires `title`, `blurb`, `fact`, `tags`, `category`, and `signal`
on every write. Fetch the full record first and resend every field. Omitting one
does not preserve it.

For metadata-only updates, show each `objectID`, title, and exact metadata change
for confirmation. Unchanged titles and blurbs are required payload, not new
proposals; preserve them exactly without redrafting or separate reapproval.

**Never trust a UUID that was not returned by a tool call in this session.**
UUIDs relayed through summaries or subagents get corrupted. If a lookup returns
fewer cards than requested, find the missing one by content search rather than
retrying the ID.

### 9.2 Bulk changes — signal, tags, deletion

**All via `write_cards`.** Validation for tags, categories, signal range, and
field shape lives in the application layer. Anything routed around the MCP skips
it, and skips `card_revisions` — the only history the corpus has.

`write_cards` requires the full record, which creates one hazard: retyping a fact
corrupts it silently.

> **Fetch, then echo. Never re-author a field you are not deliberately changing.**

Copy `title`, `blurb`, `fact`, `tags`, `category`, `projects`, `created_at`
verbatim from a `lookup_card_by_id` result returned **this session**. Change only
the target field. Never reconstruct from memory, a summary, an earlier message,
or a subagent report. Not fetched this session → fetch again.

Bulk rescore or delete:

1. Fetch full records.
2. Show each `objectID`, title, exact field change. Unchanged titles and blurbs
   are payload, not proposals — no redraft, no re-approval.
3. Write in batches ≤50.
4. Report values read back, not values intended.

Cannot assemble from fresh records → stop and say so.

Schema rejects a card (signal out of range, tag absent) → report the constraint
and stop. Never alter the database to make a card fit.

### 9.3 Deleting

Soft-delete by setting `deleted_at` to an ISO-8601 UTC timestamp. Deletion is the
user's decision. Propose; do not execute unasked.

Deleting from the database is not enough. The Algolia index is a separate store
updated by a manual push — **until that push runs, deleted cards are still live
on the site.** Say so when reporting deletions; never report a delete as done.

---

## 10. Audit mode

When asked to review, audit, or check existing cards:

1. Fetch per project or per tag via `search_cards`.
2. Skip every card where `deleted_at` is non-null.
3. Apply §2 (decision test), §3.4 (fact constraints), §3.5 (virtue rule), §5
   (dated truth), and §8.1 (Restraint anti-default) to each remaining card.
4. Report violators grouped by project: title + objectID + one-line reason.
5. Separate genuine violations from close calls. Report close calls in their own
   list with both candidate readings, and do not resolve them.
6. **Never label a card false without checking whether it was true when written.**
   Use §5. This has been the single most repeated audit error.
7. **Do not call `write_cards`.**

### 10.1 Audit by cohort, not card by card

Before reading cards one at a time, look for structural patterns — creation date,
category, project, signal distribution, word count. Card quality in this corpus
correlates strongly with _when_ it was written, and a single date predicate has
previously isolated half the defective cards in one query. Read individually only
after the cohorts are known.

---

## 11. Fuzzy requests

"Card this up", "make some cards", or "log this" with no target = **stop and
ask** which conversation thread, project, or decision to capture. Cards are
claims the user wants on public record. Only the user decides what earns that.

---

## 12. Sourcing

Mine chat history for the project — pivots, course corrections, "stop doing X"
moments, milestones, lessons from specific failures.

**Do not mine static rule documents** the user wrote (`AGENTS.md`, `PRD.md`,
`CONTRIBUTING.md`, README policy sections). Rule docs are inputs to the work.
Cards capture judgment displayed _by_ the work.

**Do not mine the blog.** Blog posts are indexed separately and fed to the agent
directly. Carding them duplicates content the system already has, and the site
links to the blog anyway.

**Do mine the repository** for decisions that never got carded — code comments
explaining a choice, config that encodes a trade-off, a CHANGELOG entry marking a
reversal. These are frequently better documented than the index is.

---

## 13. Flagged failures — previously rejected by the user

- Skipping pre-flight
- Choosing a project name without asking
- Facts over 100 words bundling multiple claims
- Facts under 30 words carrying nothing
- Two-sentence blurbs with parentheticals
- Blurbs that paraphrase the title into different vocabulary
- Descriptive labels as titles instead of takeaway claims
- Internal repo paths in the fact
- Marketing or pitch voice
- Third-person references to Ashley
- Bundled multi-claim cards
- Inventing categories or tags absent from the registry
- Calling `write_cards` with a new or changed title/blurb that was not confirmed
  in chat
- Drafting from rule docs instead of chat history
- Describing HOW a domain works instead of WHAT was decided and WHY
- Workflow restatements with no judgment behind them
- Slogan-shaped titles with abstract restraint claims and no decision body
- Including soft-deleted cards in samples or audits, or ignoring their reserved
  values during duplicate checks
- **Naming the virtue instead of stating the decision** (§3.5)
- **Defaulting to `Principle > Restraint`** without testing the alternatives (§8.1)
- **Calling a card false when it was true on the date it was written** (§5)
- **Demoting a card for repeating a claim made under a different project** (§4.1)
- **Treating cards as a resume or a blog summary** — both live elsewhere
- **Editing a changed decision in place** instead of writing a new card (§5.1)
- **Using direct SQL or DDL for anything** — MCP only (§1.1, §9.2)
- **Re-authoring a field instead of echoing the fetched value** (§9.2)
- **Reporting deletes as done** before the Algolia push has run (§9.3)
