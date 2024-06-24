import "./ChatbotTab.scss";

import * as React from "react";
import * as Scrivito from "scrivito";

import TextareaAutosize from "react-textarea-autosize";
import { throttle } from "lodash-es";

import { instanceId } from "./instanceId.js";
import { languages } from "./languages.js";
import { extractHtml } from "./extractHtml.js";
import { parseHtml } from "./parseHtml.js";
import { getModel } from "./model.js";
import { prompts } from "./prompts.js";
import { getWidgetsPrompt } from "./getWidgetsPrompt.js";
import { canBeSaved, save } from "./save.js";
import { useChatCompletion } from "./useChatCompletion.js";

export function ChatbotTab({ obj }) {
  const uiContext = Scrivito.uiContext();
  const editor = Scrivito.currentEditor();
  const locale = Scrivito.editorLanguage() || "en";

  if (!uiContext || !editor) return null;

  return (
    <div className={`scrivito_${uiContext.theme}`}>
      <div className="assist-wrapper">
        <Assist obj={obj} editor={editor} locale={locale} />
      </div>
      <div id="bottom"></div>
    </div>
  );
}

const Assist = Scrivito.connect(function ({ obj, editor, locale }) {
  const [systemHtml, setSystemHtml] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [autoSubmit, setAutoSubmit] = React.useState(false);

  // @ts-ignore
  const token = Scrivito.currentEditor()?.authToken();
  const hasToken = !!token;

  const {
    messages,
    loading,
    submitPrompt,
    abortResponse,
    resetMessages,
    setMessages,
  } = useChatCompletion({
    model: getModel(),
    apiKey: token,
    user: editor.id(),
    instanceId: instanceId(),
  });

  React.useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages]);

  const language = languages[locale] || languages["en"];
  const onSend = React.useCallback(async () => {
    const widgetsPrompt = await getWidgetsPrompt(obj);
    const html = await extractHtml(obj);
    console.log(html);

    if (!prompt) return;

    const submit = [];
    if (messages.length === 0) {
      setSystemHtml(html);
      submit.push({
        content: prompts.systemPrompt
          .replace("<LANGUAGE>", language.language)
          .replace("<USERNAME>", editor.name() || "???")
          .replace("<USEREMAIL>", editor.email() || "???")
          .replace("<WIDGETSTYPES>", widgetsPrompt)
          .replace("<WIDGETHTML>", html),
        role: "system",
      });
    } else if (systemHtml !== html) {
      setSystemHtml(html);
      submit.push({
        content: prompts.systemUpdatePrompt.replace("<WIDGETHTML>", html),
        role: "system",
      });
    }
    submit.push({ content: prompt, role: "user" });
    // @ts-ignore
    submitPrompt(submit);
    setPrompt("");
  }, [
    editor,
    prompts.systemPrompt,
    prompts.systemUpdatePrompt,
    messages.length,
    obj,
    prompt,
    submitPrompt,
    systemHtml,
  ]);

  React.useEffect(() => {
    if (autoSubmit) {
      setAutoSubmit(false);
      onSend();
    }
  }, [messages, autoSubmit, onSend]);

  const isDisabled = !instanceId() || !hasToken || loading;

  return (
    <>
      <div className="chat-wrapper">
        {messages.length < 1 ? (
          <div className="empty"></div>
        ) : (
          messages.map((msg, i) =>
            msg.role === "system" ? null : (
              <div className="message-wrapper" key={i}>
                {msg.role === "assistant" && (
                  <button
                    className="btn refresh"
                    onClick={() => {
                      setMessages(messages.slice(0, i - 1));
                      setPrompt(messages[i - 1].content);
                      setAutoSubmit(true);
                    }}
                    title={language.refresh}
                  >
                    <i className="icon fa-refresh"></i>
                  </button>
                )}
                <div className="role">
                  <span className="avatar">
                    {{ user: "👤", assistant: "🤖" }[msg.role] || "⏳"}{" "}
                  </span>
                  {{ user: editor.name() || "Redakteur", assistant: "Sam" }[
                    msg.role
                  ] || msg.role}
                </div>
                <div className="chat-message">
                  <Content
                    // @ts-ignore
                    content={msg.content}
                    obj={obj}
                    loading={loading}
                    language={language}
                  />
                </div>
              </div>
            )
          )
        )}
      </div>
      <div className="prompt-wrapper">
        <div className="prompt-input">
          <TextareaAutosize
            value={prompt}
            placeholder={language.placeholder}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.which === 13 && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
            disabled={isDisabled}
          />
          <button className="btn send" onClick={onSend} title={language.send}>
            <i
              className={isDisabled ? "icon fa-hourglass" : "icon fa-send"}
            ></i>
          </button>
        </div>
        {messages.length > 0 && (
          <div>
            <button
              className="btn btn-secondary reset"
              onClick={() => {
                setPrompt("");
                resetMessages();
              }}
            >
              {language.reset}
            </button>
            {loading && (
              <button
                className="btn btn-secondary abort"
                onClick={abortResponse}
              >
                {language.abortResponse}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
});

const scrollToEnd = throttle(() => {
  document.getElementById("bottom")?.scrollIntoView({ behavior: "smooth" });
}, 250);

const SPLIT =
  /<\/html>\s*```|```html\n<html[^<>]*>?|<\/html>|<html[^<>]*>?|```[a-z]*/;

// @ts-ignore
const Content = React.memo(({ content, obj, language, loading }) => {
  if (!loading) console.log(content);

  let preprocessedContent = content;
  if (content.includes("<widget") && !content.includes("<html")) {
    preprocessedContent = preprocessedContent.replace(
      "<widget",
      "<html><widget"
    );
    const tmpForReplace = [...preprocessedContent.split("</widget>")];
    // @ts-ignore
    tmpForReplace[tmpForReplace.length - 1] = `</html>${tmpForReplace.at(-1)}`;
    preprocessedContent = tmpForReplace.join("</widget>");
  }

  const parts = preprocessedContent.split(SPLIT);
  return parts.map((part, i) => {
    const isHtml = part.includes("<widget ");
    const widgetsDescription = isHtml ? parseHtml(part) : undefined;
    return (
      <section className={isHtml ? "html" : "text"} key={i}>
        {isHtml ? (
          <div
            dangerouslySetInnerHTML={{
              __html: part?.replace(/<[^>]*$/, ""),
            }}
          />
        ) : (
          part.replace(/<([\/a-z]*)[^>]+>/g, (all, tag) =>
            tag[0] === "/" ? " " : all.replace(/type=|widget |<h.>/g, "")
          )
        )}
        {canBeSaved(obj, widgetsDescription) && (
          <AcceptButton
            widgetsDescription={widgetsDescription}
            obj={obj}
            title={language.accept}
          />
        )}
      </section>
    );
  });
});

const AcceptButton = Scrivito.connect(function AcceptButton({
  obj,
  widgetsDescription,
  title,
}) {
  return (
    <button
      title={title}
      className="btn accept"
      onClick={() => save(obj, widgetsDescription)}
    >
      <i className="icon fa-check"></i>
    </button>
  );
});
