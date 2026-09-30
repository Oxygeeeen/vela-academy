export type DemoSessionBlueprint = {
  title: string;
  assignment: string;
};

export type DemoPhaseBlueprint = {
  name: string;
  shortName: string;
  description: string;
  outcome: string;
  sessions: DemoSessionBlueprint[];
};

const phaseBlueprints = [
  {
    name: "AI Foundations",
    shortName: "Foundations",
    description: "Build durable literacy in modern AI systems, their limits, and responsible use.",
    outcome: "Explain AI clearly and make evidence-based decisions about its use.",
    topics: [
      "AI systems: a practical mental model",
      "Machine learning without the mystery",
      "Generative AI and foundation models",
      "How large language models work",
      "Prompt anatomy and intent",
      "Evaluating AI-generated output",
      "Bias, fairness, and representation",
      "Privacy, security, and data handling",
      "Designing responsible AI learning experiences",
      "Prompt engineering studio",
      "AI opportunity mapping",
    ],
    assignments: [
      "Explain an AI system to a non-technical audience",
      "Classify real-world ML use cases",
      "Create a model capability map",
      "Facilitate the token prediction exercise",
      "Rewrite five unclear prompts",
      "Build an output evaluation rubric",
      "Complete a bias scenario review",
      "Draft a safe data handling guide",
      "Design a responsible-use case clinic",
      "Submit a prompt pattern library",
      "Present an AI opportunity canvas",
    ],
  },
  {
    name: "Learning Experience Design",
    shortName: "Learning design",
    description: "Convert AI expertise into inclusive, measurable learning journeys.",
    outcome: "Design an end-to-end AI workshop that changes workplace behaviour.",
    topics: [
      "Adult learning for the AI era",
      "Diagnosing learner needs",
      "Writing measurable outcomes",
      "Designing a 90-minute AI workshop",
      "Cognitive load and content sequencing",
      "Scenario-based learning",
      "Teaching with demonstrations",
      "Practice, feedback, and reflection",
      "Inclusive and accessible facilitation",
      "Assessment that measures transfer",
      "Building a facilitator guide",
    ],
    assignments: [
      "Create a learner persona set",
      "Run a five-question needs diagnosis",
      "Rewrite objectives using observable verbs",
      "Storyboard a 90-minute workshop",
      "Simplify an overloaded lesson",
      "Write three workplace scenarios",
      "Record a four-minute demonstration",
      "Design a guided practice loop",
      "Complete an accessibility audit",
      "Build a transfer-based assessment",
      "Submit a facilitator-ready lesson plan",
    ],
  },
  {
    name: "Facilitation Studio",
    shortName: "Facilitation",
    description: "Practise the human skills that make AI training useful, safe, and memorable.",
    outcome: "Lead confident live sessions, answer difficult questions, and coach adoption.",
    topics: [
      "The trainer as a change leader",
      "Opening a room with confidence",
      "Demonstrating AI live",
      "Facilitating prompt practice",
      "Managing mixed skill levels",
      "Responding to resistance",
      "Handling risk and ethics questions",
      "Coaching for workflow adoption",
      "Remote and hybrid delivery",
      "Measuring session impact",
    ],
    assignments: [
      "Record your trainer introduction",
      "Design a psychologically safe opening",
      "Deliver a live tool demonstration",
      "Facilitate a prompt critique",
      "Create two differentiated activities",
      "Respond to five resistance scenarios",
      "Lead an ethics case discussion",
      "Complete a coaching conversation",
      "Build a hybrid delivery runbook",
      "Submit an impact measurement plan",
    ],
  },
  {
    name: "Capstone & Certification",
    shortName: "Certification",
    description: "Apply the full method to a high-value training solution and prove readiness.",
    outcome: "Graduate with a portfolio-ready AI training programme and verified facilitation skill.",
    topics: [
      "Choosing a high-impact capstone",
      "Discovery and stakeholder alignment",
      "Curriculum architecture",
      "Prototype sprint",
      "Pilot facilitation",
      "Evidence and iteration",
      "Executive storytelling",
      "Train-the-trainer systems",
      "Capstone submission",
      "Certification panel",
    ],
    assignments: [
      "Submit a capstone opportunity brief",
      "Document the stakeholder agreement",
      "Build the curriculum blueprint",
      "Share your workshop prototype",
      "Deliver a supervised pilot",
      "Submit evidence and revisions",
      "Record an executive readout",
      "Create a trainer enablement kit",
      "Submit the final capstone",
      "Complete the certification panel",
    ],
  },
];

export const phases: DemoPhaseBlueprint[] = phaseBlueprints.map((blueprint) => ({
  name: blueprint.name,
  shortName: blueprint.shortName,
  description: blueprint.description,
  outcome: blueprint.outcome,
  sessions: blueprint.topics.map((title, order) => ({ title, assignment: blueprint.assignments[order] })),
}));

export const students = [
  { name: "Amara Diallo", email: "amara.diallo@northstar.io", cohort: "Cohort 06", timezone: "Africa/Lagos", progress: 21 },
];
