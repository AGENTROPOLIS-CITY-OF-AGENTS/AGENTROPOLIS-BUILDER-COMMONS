export function createProjectRoom({ roomId, projectId, repositoryRefs = [] }) {
  if (!roomId || !projectId) throw new Error("roomId and projectId are required");

  return {
    schema_version: "0.1",
    room_id: roomId,
    project_id: projectId,
    state: "open",
    participants: [],
    tasks: [],
    notes: [],
    repository_refs: [...new Set(repositoryRefs)],
    issue_refs: [],
    pull_request_refs: [],
    contribution_evidence_refs: [],
    receipt_refs: [],
    opportunity_refs: [],
    metadata: {}
  };
}

export function joinRoom(room, participantId) {
  if (!participantId) throw new Error("participantId is required");
  if (!room.participants.includes(participantId)) room.participants.push(participantId);
  return room;
}

export function leaveRoom(room, participantId) {
  room.participants = room.participants.filter((id) => id !== participantId);
  return room;
}

export function addRoomReference(room, collection, ref) {
  const allowed = new Set([
    "repository_refs",
    "issue_refs",
    "pull_request_refs",
    "contribution_evidence_refs",
    "receipt_refs",
    "opportunity_refs"
  ]);
  if (!allowed.has(collection)) throw new Error("unsupported reference collection");
  if (!room[collection].includes(ref)) room[collection].push(ref);
  return room;
}
