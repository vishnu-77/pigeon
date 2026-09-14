# PigeonMQ landing page and interactive demo plan

Date: 2026-09-14. Direction clarified by the user: create a product landing page
where visitors can understand PigeonMQ and try it. This replaces the earlier console
proposal. The landing page and isolated demo are now implemented and deployed at
https://www.pigeonmq.cc/. The original assessment and agreed plan follow below;
[hosted demo notes](hosted-demo.md) record verification and operational details.

## Goal

Help a first-time visitor understand what PigeonMQ does, experience one useful
behaviour through a real example, and find a clear path to running it themselves.

The main visitor journey is:

**Understand the promise -> try a message -> change one condition -> see why the
outcome changes -> get started.**

## What the assessment still tells us

- ACME CHECKOUT makes the example look like the product. PigeonMQ should own the
  page identity; the payment example belongs inside the demo.
- The current page presents architecture, policy gates and logs before explaining
  what problem they solve. Its content needs a deliberate reading sequence.
- Dense monospace text, uppercase labels, long IDs and coloured pills compete
  for attention. Keep technical detail available through progressive disclosure.
- The message list is session-local. For a landing-page demo, that is appropriate
  when explicitly labelled as the current run. It must not imply global broker history.
- Gate animations come from scenario code rather than a measured per-gate trace.
  Present animations as explanations and show real broker responses as evidence.
- At a 390px viewport, the current document measured 536px wide. The demo must
  have a purpose-built mobile layout.
- Multiple visitors or external clients must not share a consuming cursor or see
  each other's evidence. Public demonstration runs need isolation.

Keep the working governed-message flow and its real results. Refine how people
discover, use and understand it.

## Page structure

| Section | Purpose | Proposed content |
| --- | --- | --- |
| Navigation | Orient visitors | PigeonMQ, How it works, Try the demo, Docs, GitHub |
| Hero | Explain the product immediately | A concrete headline, one-sentence explanation, Try it live as the primary action and Get started as secondary |
| Interactive demo | Let visitors experience the promise | One guided message moving from sender through broker to receiver, with a clear result |
| Why the outcome changed | Explain the distinguishing behaviour | Short explanations of sender permissions, sensitive-data controls and duplicate suppression, linked to the example |
| How it works | Give developers a compact mental model | Define a subject policy, negotiate a contract, send under that contract; one short expandable code example |
| Get started | Make the next step easy | Verified installation/start instructions, local network demo, documentation and repository links |
| Project status and footer | Set accurate expectations | Open-source licence, experimental status and concise links to limitations |

Working hero copy for design exploration:

> **Messaging with policy built in.**
>
> PigeonMQ checks who can send a message, what data it contains, and where it is
> allowed to go before delivery.
>
> **Try it live** · Get started

Keep claims within implemented behaviour. Duplicate suppression does not prove
exactly-once business processing or prevention of all duplicate charges.

## Interactive demo

Start with a single obvious action: **Send a message**. The default payment payload
uses synthetic, tokenized data. Present a friendly summary such as order and amount;
offer the raw envelope under View payload.

On desktop, show Sender -> PigeonMQ -> Receiver as three carefully composed stages.
On mobile, turn them into a compact vertical sequence. Use a short, restrained
animation that does not delay access to results and respects reduced motion.

After the valid run, invite the visitor to change one condition:

| Action | Expected result | Explanation |
| --- | --- | --- |
| Send a message | Accepted, delivered and acknowledged | The sender and payload meet this subject's policy. |
| Retry the same message | Original message returned | The idempotency key prevents another accepted copy within the configured window. |
| Add forbidden card data | Denied and quarantined | The sensitive field is blocked; stored evidence is redacted. |
| Change the sender | Negotiation or publish denied | The chosen sender lacks permission for this subject. |

Keep one scenario active at a time. An optional advanced scenario can demonstrate
region restrictions after the core experience is clear.

Every run shows a plain-language outcome followed by optional detail:

- View payload and actual response.
- View the relevant policy rule.
- View this run's audit and quarantine evidence.

The UI must distinguish acceptance, receiver acknowledgement, duplicate return and
denial. Explain that gateway acknowledgement in this demo is not a real payment
authorization decision. Expose a clear Run again action with fresh run state.

## Visual direction

- Give the hero a strong typographic hierarchy and enough space to establish the
  product before introducing technical detail.
- Make the live demo the main visual element. Use a coherent sender/broker/receiver
  illustration rather than many equally weighted dashboard cards.
- Retain a restrained dark palette, with one brand accent and accessible outcome colours.
- Use readable sans-serif body text. Reserve monospace for payloads, subject names
  and code. Shorten IDs in summaries while retaining copyable full values.
- Keep the main page concise. Expand technical details in context and link to the
  full API reference rather than embedding a long reference document in the landing page.
- Provide intentional idle, running, success, denied, disconnected and retry states.
  If the live backend is unavailable, show that clearly; never substitute a simulated
  success while describing it as live.

## Build sequence and verification

### 1. Shape the story and layout

Draft the hero, section order and outcome explanations. Produce desktop and mobile
wireframes for the landing page and one expanded demo result.

Completion: a visitor can identify what PigeonMQ does and where to try it without
reading raw policy or audit output.

### 2. Design and build the guided demo

Implement the valid-send flow, then retry, forbidden-data and unauthorized-sender
variations. Show real responses with optional payload, rule and evidence views.

Completion: each scenario has an understandable result and a clear next action.
Repeated runs and scenario changes cannot show stale results from another run.

### 3. Prepare reliable live execution

Confirm which existing website source and hosting path will serve the public page.
Keep the local and Docker examples functioning. Isolate each visitor's demo state,
contracts, consumer cursor and evidence; enforce bounded execution and cleanup.
Use synthetic examples and expose only evidence associated with that visitor's run.

Completion: two simultaneous visitors can run the example independently, and a
failed or unavailable backend produces an honest, recoverable error state.

### 4. Finish the learning and adoption path

Add the short explanation sections, compact policy example, verified quickstart,
docs links and accurate project status. Keep implementation detail proportional to
what a visitor needs to understand or try the product.

Completion: someone who understands the demo can run it locally using the presented
instructions, with no misleading production or performance claims.

### 5. Refine and verify the whole experience

Check desktop and mobile, keyboard navigation, reduced motion, payload expansion,
run reset, repeated clicks, timeouts and concurrent visitors. Verify that all visible
outcomes agree with the broker and that page-level horizontal overflow is absent.

The first reviewable delivery should contain **the hero, live demo and getting-started
section**. Add supporting explanation only where it helps people understand what
they just observed.

## Scope boundary

This landing-page refinement does not require building the previously proposed
management console. Production authentication, queue leases/redelivery, distributed
contracts and HTTP business replies remain separate broker milestones. A public
live demo does require its own isolation and bounded-use handling before deployment.
