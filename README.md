# Pigeon website

This branch contains the public adoption and research website for **Pigeon**, the contract-native message broker.

The broker runtime lives on [`main`](https://github.com/vishnu-77/pigeon/tree/main). The website is deliberately separate so landing-page UI, research explanation and replay components never become broker dependencies.

## Experience

The homepage follows two views over the same project:

- **Developer** — what Pigeon is, how contract-native messaging works, Node/Python/Rust/HTTP quickstarts, current capability and limits.
- **Researcher** — the messaging-authority gap, runtime communication-contract model, experiments, benchmark framing and open research questions.

Both views share the same **Message Replay**, which explains an allowed message and a quarantined contract violation without pretending the landing page is an operational broker console.

## Local development

```bash
npm install
npm run dev
```

Static build:

```bash
npm run build
```

The design system uses a warm paper/ink base with muted postal red as Pigeon's brand signal and restrained green/ochre for runtime decisions. No glow, glassmorphism or dashboard styling.
