import { prompts } from "./prompts.js";

export const languages = {
  de: {
    abortResponse: "Abbrechen",
    placeholder: "Ihre Nachricht",
    refresh: "Andere Antwort",
    reset: "Neuer Chat",
    send: "Absenden",
    ...prompts.de,
  },
  en: {
    abortResponse: "Stop",
    placeholder: "Your message",
    refresh: "Another answer",
    reset: "New chat",
    send: "Send",
    ...prompts.en,
  },
};
