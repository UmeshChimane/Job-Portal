const { Types } = require("mongoose");
function applicationEvent(applicationId, job, type, recipient) {
  const id = String(applicationId);
  return {
    key: `application:${id}:${type}`, type, recipient,
    related: { kind: "application", id: applicationId, jobId: job._id },
    occurredAt: new Date(),
  };
}
function submissionEvents(id, job, candidate) {
  return [
    { ...applicationEvent(id, job, "application_submitted", candidate), title: "Application submitted", message: `Your application for ${job.title} at ${job.company} was submitted successfully.`, href: `/candidate/applications?jobId=${job._id}` },
    { ...applicationEvent(id, job, "new_application", job.recruiter), title: "New application", message: `A candidate applied for ${job.title}. Review their application.`, href: `/recruiter/applicants/${id}` },
  ];
}
function statusEvent(application, status) {
  const job = application.job;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const type = status === "shortlisted" ? "application_shortlisted" : "application_status";
  return { ...applicationEvent(application._id, job, type, application.candidate), key: `application:${application._id}:status:${status}`,
    title: status === "shortlisted" ? "You've been shortlisted" : "Application status updated",
    message: `Your application for ${job.title} at ${job.company} is now ${label}.`, href: `/candidate/applications?jobId=${job._id}` };
}
function withdrawalEvent(application) {
  const job = application.job;
  return { ...applicationEvent(application._id, job, "application_withdrawn", job.recruiter), title: "Application withdrawn", message: `An application for ${job.title} was withdrawn by the candidate.`, href: `/recruiter/applicants/${application._id}` };
}
function reportEvent(reportId, job) {
  return { key: `report:${reportId}`, type: "job_reported", audience: "admins", title: "Job posting reported", message: `${job.title} at ${job.company} was reported and needs review.`, href: "/admin/reports", related: { kind: "report", id: new Types.ObjectId(reportId), jobId: job._id }, occurredAt: new Date() };
}
module.exports = { submissionEvents, statusEvent, withdrawalEvent, reportEvent };
