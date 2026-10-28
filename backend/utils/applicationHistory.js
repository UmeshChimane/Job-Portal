// Historical actors expose names and their relationship to this application only.
// No email, phone, resume or full user document belongs in the timeline.
function applicationHistory(application, recruiterId) {
  const candidateId = String(application.candidate?._id || application.candidate || "");
  return (application.statusHistory || []).map(entry => {
    const actor = entry.changedBy;
    const id = actor ? String(actor._id || actor) : "";
    const name = [actor?.firstName, actor?.lastName].filter(Boolean).join(" ");
    return { status: entry.status, changedAt: entry.changedAt || null,
      changedBy: { name: name || "Account unavailable", role: id && id === candidateId ? "Candidate" : id && id === String(recruiterId) ? "Recruiter" : "Account" } };
  });
}
module.exports = { applicationHistory };
