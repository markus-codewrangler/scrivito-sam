import "../../../style.scss";

import * as React from "react";
import * as Scrivito from "scrivito";
import TurndownService from "turndown";

import { localize, replace } from "./languages.js";
import { useChatCompletion } from "../useChatCompletion.js";
import { getModel } from "../model.js";
import { updateObj } from "./updateObj.js";
import { actions, prompts } from "./prompts.js";
import { extract, getWidgetsAsArray } from "./extractContent.js";
import { ModelChooser } from "../ModelChooser.jsx";
import { ConfigDialog } from "./ConfigDialog.jsx";

const turndownService = new TurndownService();

export function LanguageToolsTab({ obj }) {
  const uiContext = Scrivito.uiContext();
  const editor = Scrivito.currentEditor();
  const locale = Scrivito.editorLanguage() || "en";
  const [chatOnly, setChatOnly] = React.useState(true);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [showConfig, setShowConfig] = React.useState(false);

  const { messages, loading, submitPrompt, resetMessages } = useChatCompletion({
    model: getModel(),
    getApiKey: async () =>
      Scrivito.load(() => Scrivito.currentEditor()?.authToken()),
    user: editor?.id(),
    instanceId: Scrivito.getInstanceId(),
  });

  const message = messages
    .filter(({ role }) => role === "assistant")
    .map(({ content }) => content)
    .join("\n");

  React.useEffect(() => {
    if (!loading && isSubmitted) console.log(message);
  }, [loading, isSubmitted, message]);

  if (!uiContext || !editor) return null;

  const objVersions = obj
    .versionsOnAllSites()
    .filter((v) => v.id() !== obj.id())
    .concat(obj);

  const versionsInput = objVersions
    .map((v) =>
      replace(prompts.objDescription, {
        LANGUAGE: languageName("en", v.language()),
        PAGE:
          v.id() === obj.id()
            ? `the current page (${languageName(
                "en",
                v.language()
              )} version of the page)`
            : `the ${languageName("en", v.language())} version of the page`,
        STRUCTURE: extract(v, { includeIds: v.id() === obj.id() }),
        TEXT: Scrivito.extractText(v),
        TITLE: v.get("title"),
      })
    )
    .join("\n\n");

  const root = Scrivito.Obj.root();
  const languageToolsPrompt = root.get("languageToolsPrompt");
  const fallbackLanguageToolsPrompt =
    root
      .versionsOnAllSites()
      .map((site) => site.get("languageToolsPrompt"))
      .find((value) => value) || "";
  const isLanguageToolsPromptConfigurable =
    typeof languageToolsPrompt === "string";
  const sitePrompt = isLanguageToolsPromptConfigurable
    ? turndownService
        .turndown(languageToolsPrompt || fallbackLanguageToolsPrompt)
        .replace(/\\/g, "")
    : "";

  const objTitle = obj.get("title");
  const objText = Scrivito.extractText(obj);
  const objStructure = extract(obj);
  const objLanguage = obj.language();

  const contentsForUpdate = [obj, ...getWidgetsAsArray(obj)];

  const localizeArgs = {
    LANGUAGE: languageName("en", objLanguage),
    SITEPROMPT: sitePrompt,
    USERLANGUAGE: languageName("en", locale),
    LOCALIZEDPAGELANGUAGE: languageName(locale, objLanguage),
  };

  localizeArgs["TOPICS"] = [""]
    .concat(
      actions
        .filter(({ topic }) => topic)
        .map(
          ({ name, topic }) =>
            `${localize(locale, name, localizeArgs)} (${replace(
              topic,
              localizeArgs
            )})`
        )
    )
    .join("\n  * ");

  return (
    <div className={`scrivito_${uiContext.theme}`}>
      <div className="assist-dialog-wrapper">
        <ModelChooser
          extraOptionLabel={
            !Scrivito.isComparisonActive() &&
            isLanguageToolsPromptConfigurable &&
            localize(locale, "configurePrompt")
          }
          onExtraOption={() => {
            setShowConfig(true);
          }}
        />
        {showConfig && <ConfigDialog onClose={() => setShowConfig(false)} />}
        {actions.map((action, i) => (
          <React.Fragment key={i}>
            {action.separator ? (
              <div className="label">
                {localize(locale, `${action.separator}Heading`, localizeArgs)}
              </div>
            ) : (
              <button className="btn" onClick={() => run(action)}>
                {localize(locale, action.name, localizeArgs)}
              </button>
            )}
          </React.Fragment>
        ))}
        {chatOnly && isSubmitted && (
          <ChatResponse message={message} loading={loading} />
        )}
        {!chatOnly && isSubmitted && (
          <StructuredResponse
            update={(parts) => updateObj(contentsForUpdate, parts)}
            message={message}
            loading={loading}
            locale={locale}
          />
        )}
      </div>
    </div>
  );

  async function run(action) {
    const args = {
      ...localizeArgs,
      LANGUAGE: languageName("en", objLanguage),
      TEXT: objText,
      TITLE: objTitle,
      TOPIC: replace(action.topic || action.name, localizeArgs),
    };
    const promptArgs = {
      ...args,
      ...(await Scrivito.load(() => ({
        INSTRUCTIONS: replace(action.instructions, args),
        RESPONSETYPEINSTRUCTIONS: action.chatOnly
          ? replace(prompts.chatResponse, args)
          : replace(prompts.structuredResponse, args),
        STRUCTURE: objStructure,
        USEREMAIL: editor?.email() || "???",
        USERLANGUAGE: languageName("en", locale),
        USERNAME: editor?.name() || "???",
        VERSIONS: versionsInput,
      }))),
    };
    const systemPrompt = replace(prompts.systemPrompt, promptArgs);
    const userPrompt = replace(prompts.userPrompt, promptArgs);

    setChatOnly(action.chatOnly);
    resetMessages();
    setIsSubmitted(true);
    console.log(systemPrompt, userPrompt);
    submitPrompt([
      { content: systemPrompt, role: "system" },
      { content: userPrompt, role: "user" },
    ]);
  }
}

function ChatResponse({ message, loading }) {
  return (
    <div>
      <div className="role">
        <span className="avatar">🗣️ </span>
        Noam
      </div>
      <div className="chat-message">{message}</div>
      {loading && <div className="loading">…</div>}
    </div>
  );
}

function StructuredResponse({ update, message, loading, locale }) {
  const messageParts = message
    .split(/<!--/)
    .map((part) => {
      const [meta, value] = part.replace(/```.*$/, "").split("-->");
      const [objClass, id, attributeName] = meta.trim().split(/:|-/);
      if (value === undefined || !id || !attributeName) return null;
      return {
        attributeName,
        id,
        objClass,
        value: value?.trim() || "",
      };
    })
    .filter((part) => part);

  const messagePartsCount = messageParts.length;
  const expectedNumberOfChanges = messagePartsCount + 2;
  const percent = loading
    ? Math.floor((100 * messagePartsCount) / expectedNumberOfChanges)
    : 100;

  React.useEffect(() => {
    update(messageParts);
  }, [message]);

  const label = localize(locale, "approxChanges", {
    COUNT: loading ? expectedNumberOfChanges : messagePartsCount,
    PERCENT: percent.toString(),
  });

  return (
    <div>
      <div className="role">
        <span className="avatar">✍️ </span>
        Noam
      </div>
      <div className="loading progress-bar">
        <span className="percentage" style={{ width: `${percent}%` }} />
        {label}
      </div>
    </div>
  );
}

function languageName(locale, languageCode) {
  return (
    new Intl.DisplayNames(locale, { type: "language" })
      .of(languageCode)
      ?.toString() || languageCode
  );
}
