# DermAssist Frontend Agent Guidelines

## Mandatory Artifact Usage

- **CRITICAL**: The AI assistant must **ALWAYS** create or update markdown artifacts for:
  - **Implementation Plans** (`implementation_plan.md`): Always create a formal plan artifact before starting major or multi-file code modifications, and wait for user approval.
  - **Evaluations & Analyses** (e.g. `analysis_results.md`, `evaluation_notes.md`): Always save detailed analyses, architectural evaluations, database schema investigations, and design comparisons into an artifact.
  - **Walkthroughs** (`walkthrough.md`): Always document completed changes, how they were verified, and test outputs in a walkthrough artifact.
- **Never Dump Large Plans in Chat**: Never output long plans or deep technical analyses solely as chat messages. Always persist them into well-structured markdown artifacts and provide a concise summary in chat pointing to the artifact.

---

## Zero-Mistake & Rigorous Verification Protocol (CRITICAL)

- **Make No Mistakes**: The AI assistant must operate with extreme precision, diligence, and zero tolerance for syntax, runtime, or architectural errors.
- **Contextual Awareness**: Always read and inspect adjacent lines, imports, and component hierarchies before proposing code modifications. Never guess or hallucinate props, component names, or imports.
- **Vue Sequential Conditional Rule**: In multi-branch template conditionals (`v-if`, `v-else-if`, `v-else`), `v-else` must **always** be the final terminal branch. Never put `v-else-if` after `v-else`.
- **Mandatory Verification**: Always verify Vue templates compile cleanly and format code using Prettier (`npx prettier --write {path}`). Never mark a frontend task complete without testing page rendering and responsiveness.

---

## Core DermAssist Feature Patterns

- **Doctor-Registered Patients**: Must strictly only book appointments with their registering doctor. Reject other doctor IDs with 403. Omit alternative doctor availability suggestions when the doctor is away. Frame attending physician as "Your Attending Doctor".
- **Temporary Password Generator**: All patient registration forms (scanner modal, patients page, scan findings) must use `usePasswordGenerator` (`generateTemporaryPassword('Patient')`), provide inline Copy and Regenerate buttons, and toggle password visibility.
- **Clinical Scan Patient Assignment**: Must default to an appointment-centric schedule (listing chronological appointments with Today, Tomorrow, Date Picker, and All Dates filters). Never fall back to `created_at` as the appointment date. Provide a separate "Registered (Walk-In)" tab for unscheduled patients.
- **Chat Contrast Standards**: Primary colored sender bubbles must use pure white headers, elevated white status pill badges (`bg-white shadow-sm`), and solid white preview cards for clinical findings.
- **Zero Native Browser Prompts**: Strictly no `alert()`, `confirm()`, or `prompt()`. Always use `vue-sonner` toasts and `<AppModalConfirmation>`.
- **Cookie Notice & Terms Integration**: Cookie notice must remain a minimal, floating glassmorphism pill with direct "Terms & Cookies" hyperlink opening `<AppModalTermsModal initial-tab="cookies" />`. Never show intimidating technical terms (e.g. "bot farms", "device tracking tokens") in initial cookie notices.
- **Vue Sequential Conditional Rule**: In multi-branch templates (`v-if`, `v-else-if`, `v-else`), `v-else` must **always** be the final terminal branch. Never put `v-else-if` after `v-else`.
- **AI Retraining Terminal Console**: Live training output must render realistic tqdm-style step progress bars (`[STEP] Epoch ... [=====>...]`) updated in-place (`replace_last`). The UI terminal must feature Unix window controls, auto-scroll toggle, clipboard copy, buffer clear, fullscreen expand, and an interactive prompt (`dermassist@ai-worker:~/algorithms$`) with command history.
