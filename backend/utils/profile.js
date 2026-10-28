function profileUser(user) {
  return {
    id: user._id, firstName: user.firstName, lastName: user.lastName,
    email: user.email, role: user.role, phone: user.phone || "",
    headline: user.headline || "", location: user.location || "", bio: user.bio || "",
    skills: user.skills || [], education: user.education || "",
    experienceYears: user.experienceYears ?? null, relevantExperienceYears: user.relevantExperienceYears ?? null,
    workHistory: user.workHistory || [],
    company: user.company || "", website: user.website || "",
    resumeUrl: user.resumeUrl || null, createdAt: user.createdAt,
  };
}
module.exports = { profileUser };
