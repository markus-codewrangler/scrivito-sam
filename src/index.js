import { ChatbotTab } from "./Components/ScrivitoExtensions/ChatbotTab/ChatbotTab.jsx";
import { LanguageToolsTab } from "./Components/ScrivitoExtensions/LanguageTools/LanguageToolsTab.jsx";

export const assistPropertiesGroup = {
  title: "Assistant Sam",
  component: ChatbotTab,
  key: "assist-group",
};

export const languageToolsPropertiesGroup = {
  title: "Assistant Noam",
  component: LanguageToolsTab,
  key: "languageTools-group",
};
