export function createContributionEvidence({
  evidenceId,
  projectId,
  contributorRef,
  contributionType,
  summary = "",
  evidence = []
}) {
  if (!evidenceId || !projectId || !contributorRef || !contributionType) {
    throw new Error("evidence identity fields are required");
  }
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error("at least one evidence reference is required");
  }

  return {
    schema_version: "0.1",
    evidence_id: evidenceId,
    project_id: projectId,
    contributor_ref: contributorRef,
    contribution_type: contributionType,
    summary,
    evidence,
    verification: {
      status: "unverified",
      verifier_ref: null,
      verified_at: null,
      receipt_ref: null
    },
    metadata: {}
  };
}

export function verifyContribution(record, { verifierRef, receiptRef = null }) {
  record.verification = {
    status: "verified",
    verifier_ref: verifierRef,
    verified_at: new Date().toISOString(),
    receipt_ref: receiptRef
  };
  return record;
}
