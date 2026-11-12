# Authority & Evidence Observatory — Proposal v0.1

Status: DRAFT / review required. Owner: Research District. Public surface: T.A.G. (Trappin @ Grok). Infrastructure: Intelligence Grid.

## Purpose
Make claims auditable without assigning people reputation scores or pretending to diagnose Dunning-Kruger. Separate research history, demonstrated capability, marketing, speculation, and unsupported claims.

## Three-layer architecture
- **Infrastructure**: WikiVault provenance records, immutable evidence receipts, 54-T containment, BE production evaluation, policy enforcement.
- **District institution**: Research District owns evidence intake, source reconciliation, technical review and dispute handling. Security Watch reviews adversarial or coordinated manipulation signals.
- **Application**: Public T.A.G. Evidence Observatory and educational character-led explainer cards. No direct privileged access to internal stores.

## Claim lifecycle
1. Intake URL, media or claim with timestamp, license and consent status.
2. Preserve source, capture content hash and provenance; no unapproved scraping.
3. Classify: verified, supported with caveats, disputed, unverified, fabricated, or satire. Each requires linked evidence and reviewer identity.
4. Historical prior-art check; distinguish public release from original discovery.
5. Evaluate source quality, uncertainty, counterevidence, and update cadence.
6. Human review for high-impact claims; appeal and correction mechanism.
7. Publish claim-specific receipt, not a person score. Redact personal data.

## MVP contracts
Input: {claim_text, source_urls[], captured_at, media_type, consent_basis}.
Output: {claim_id, status, confidence_basis, citations[], prior_art[], caveats[], reviewer, reviewed_at, correction_history[]}.
Confidence is an evidence assessment, never a psychological assessment of the author.

## Visual contract
Inherit AGENTROPOLIS-DESIGN-SYSTEM, not a fork: obsidian #05070A, cyan #19E6E6, red #FF2A2A; tennis-ball lime is an accent only. User-provided seven reference images are art direction, not automatically licensed production assets. Maintain distinct roles for companion orb, cybernetic humanoids, public-facing operator, and dog mascot. Avoid pixelated aesthetics in city-facing 3D experiences. Accessible contrast, readable text, and motion-reduction mode are required.

## Initial test cases
- Distinguish facial reenactment and deepfake demonstrations from AGI evidence.
- Verify claimed SEC S-1 documents against the official EDGAR record before reposting; satire and edited screenshots remain labeled.
- Distinguish Gaussian splatting, LiDAR, Wi-Fi sensing and multimodal fusion; do not claim an integrated capability without reproducible evidence.

## Governance and release gates
Inspect -> Simulate -> Preview -> Approve -> Execute -> Verify -> Record.
Default-deny outbound connections; allowlisted sources; no autonomous publication, takedowns, accusations or profiling. Security Watch reviews prompt injection and media metadata exfiltration. BE evals test hallucinations, citation integrity, false positives and correction behavior. 54-T signs execution receipts. Independent review and explicit release authorization before merge/deploy.

## Success criteria
100% of public factual verdicts carry inspectable source references; every status change has a receipt; no person-level expertise score; public corrections remain visible; accessibility and mobile review pass.
