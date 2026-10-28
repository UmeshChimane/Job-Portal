import { API_URL, clearSession, getToken } from "./auth";

export async function downloadResume(path: string) {
  if (!/^\/resumes\/[a-f0-9]{24}$/i.test(path)) throw new Error("Invalid resume link");
  const token = getToken();
  if (!token) throw new Error("Please sign in to download this resume");
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (response.status === 401) clearSession(token);
  if (!response.ok) throw new Error("Unable to download this resume");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "resume.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
