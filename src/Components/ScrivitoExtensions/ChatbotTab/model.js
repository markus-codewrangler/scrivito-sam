export function getModel() {
  const fallback = "gpt-4-turbo-preview";
  try {
    return localStorage.getItem("openai_model") || fallback;
  } catch {
    return fallback;
  }
}
