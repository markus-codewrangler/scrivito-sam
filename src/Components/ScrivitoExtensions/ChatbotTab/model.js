export function getModel() {
  const fallback = "gpt-4-1106-preview";
  try {
    return localStorage.getItem("openai_model") || fallback;
  } catch {
    return fallback;
  }
}
