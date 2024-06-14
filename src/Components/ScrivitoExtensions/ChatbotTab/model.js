export function getModel() {
  const fallback = "gpt-4o";
  try {
    return localStorage.getItem("openai_model") || fallback;
  } catch {
    return fallback;
  }
}
