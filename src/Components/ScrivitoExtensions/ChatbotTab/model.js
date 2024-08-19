export function getModel() {
  const fallback = "gpt-4o-mini";
  try {
    return localStorage.getItem("openai_model")?.trim() || fallback;
  } catch {
    return fallback;
  }
}
