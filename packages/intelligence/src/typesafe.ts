import { noul, TypeSafeClient, type EntryType } from "@typesafe-ai/sdk";

import {
  CAPTURE_JEV_MODEL,
  type CaptureAssessmentInput,
  type JevEvaluation,
  type JevEvaluator,
} from "./capture-assessment.js";

const questions = {
  relevant: noul(
    "Does the Handoff contain concrete context and next actions that are relevant to continuing the stated Project goal?",
  ),
  sensitivityMismatch: noul(
    "Does any captured content appear more sensitive than the declared sensitivity labels indicate?",
  ),
  portable: noul(
    "Could another coding agent continue the Project from this Handoff without relying on important unmentioned local-only context?",
  ),
  conflicting: noul(
    "Does any statement in the Handoff conflict with another supplied Project or Handoff statement?",
  ),
  stale: noul(
    "Does the Handoff contain signals that its progress, decisions, blockers, or next actions may no longer match the supplied repository revision and Project goal?",
  ),
} as const;

function toEntryType(value: CaptureAssessmentInput): EntryType {
  // SAFETY: The domain schemas contain only JSON values; serialization removes optional undefined fields.
  return JSON.parse(JSON.stringify(value)) as EntryType;
}

export class TypeSafeJevEvaluator implements JevEvaluator {
  readonly #client: TypeSafeClient;

  constructor(client: TypeSafeClient = new TypeSafeClient()) {
    this.#client = client;
  }

  async evaluate(input: CaptureAssessmentInput): Promise<JevEvaluation> {
    const response = await this.#client.systemOne({
      model: CAPTURE_JEV_MODEL,
      state: toEntryType(input),
      questions,
    });

    return {
      model: response.model,
      judgments: {
        relevant: response.answers.relevant.noul,
        sensitivityMismatch: response.answers.sensitivityMismatch.noul,
        portable: response.answers.portable.noul,
        conflicting: response.answers.conflicting.noul,
        stale: response.answers.stale.noul,
      },
    };
  }
}
