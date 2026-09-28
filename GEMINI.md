# DermAssist Frontend Agent Guidelines

## Mandatory Artifact Usage

- **CRITICAL**: The AI assistant must **ALWAYS** create or update markdown artifacts for:
  - **Implementation Plans** (`implementation_plan.md`): Always create a formal plan artifact before starting major or multi-file code modifications, and wait for user approval.
  - **Evaluations & Analyses** (e.g. `analysis_results.md`, `evaluation_notes.md`): Always save detailed analyses, architectural evaluations, database schema investigations, and design comparisons into an artifact.
  - **Walkthroughs** (`walkthrough.md`): Always document completed changes, how they were verified, and test outputs in a walkthrough artifact.
- **Never Dump Large Plans in Chat**: Never output long plans or deep technical analyses solely as chat messages. Always persist them into well-structured markdown artifacts and provide a concise summary in chat pointing to the artifact.

---

## Core DermAssist Feature Patterns

- **Doctor-Registered Patients**: Must strictly only book appointments with their registering doctor. Reject other doctor IDs with 403. Omit alternative doctor availability suggestions when the doctor is away. Frame attending physician as "Your Attending Doctor".
- **Temporary Password Generator**: All patient registration forms (scanner modal, patients page, scan findings) must use `usePasswordGenerator` (`generateTemporaryPassword('Patient')`), provide inline Copy and Regenerate buttons, and toggle password visibility.
- **Clinical Scan Patient Assignment**: Must default to an appointment-centric schedule (listing chronological appointments with Today, Tomorrow, Date Picker, and All Dates filters). Never fall back to `created_at` as the appointment date. Provide a separate "Registered (Walk-In)" tab for unscheduled patients.
- **Chat Contrast Standards**: Primary colored sender bubbles must use pure white headers, elevated white status pill badges (`bg-white shadow-sm`), and solid white preview cards for clinical findings.
- **Zero Native Browser Prompts**: Strictly no `alert()`, `confirm()`, or `prompt()`. Always use `vue-sonner` toasts and `<AppModalConfirmation>`.
