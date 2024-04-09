import "./ChatbotTab.scss";

import * as React from "react";
import * as Scrivito from "scrivito";

import { useChatCompletion } from "openai-streaming-hooks-chrome-fix";
import TextareaAutosize from "react-textarea-autosize";
import { throttle } from "lodash-es";

import { languages } from "./languages.js";
import { getToken, refreshToken } from "./token.js";
import { widgetlistAttributeNames } from "./widgetlistAttributeNames.js";
import { flatWidgets } from "./flatWidgets.js";
import { extractHtml } from "./extractHtml.js";
import { parseHtml } from "./parseHtml.js";
import { getModel } from "./model.js";
import { prompts } from "./prompts.js";
import { getWidgetsPrompt } from "./getWidgetsPrompt.js";

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
  const [hasToken, setHasToken] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [autoSubmit, setAutoSubmit] = React.useState(false);

  React.useEffect(() => {
    refreshToken().then(setHasToken);
  }, []);

  const {
    messages,
    loading,
    submitPrompt,
    abortResponse,
    resetMessages,
    setMessages,
  } = useChatCompletion({
    // @ts-ignore
    model: getModel(),
    // @ts-ignore
    apiKey: getToken,
    user: editor.id(),
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
    setHasToken(await refreshToken());
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

  const isDisabled =
    !hasToken ||
    loading ||
    (messages.length > 0 && messages[messages.length - 1].meta.loading);

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
const Content = React.memo(({ content, obj, loading }) => {
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
        {toScrivitoWidgets(widgetsDescription, obj) && (
          <AcceptButton widgetsDescription={widgetsDescription} obj={obj} />
        )}
      </section>
    );
  });
});

const AcceptButton = Scrivito.connect(function AcceptButton({
  obj,
  widgetsDescription,
}) {
  return (
    <button
      title="Übernehmen"
      className="btn accept"
      onClick={() => save(obj, widgetsDescription)}
    >
      <i className="icon fa-check"></i>
    </button>
  );
});

function toScrivitoWidgets(widgetsDescription, obj) {
  if (!widgetsDescription) return undefined;
  const prevWidgets = flatWidgets(obj);
  const usedIds = [];
  const newWidgets = widgetsDescription.map(
    ({ id, objClass, ...attributes }) => {
      const existingWidget = prevWidgets.find((w) => w.id() === id);
      if (
        existingWidget &&
        existingWidget.objClass() === objClass &&
        !usedIds.includes(id)
      ) {
        usedIds.push(id);
        return {
          widget: existingWidget,
          attributes,
          modification: "edit",
          widgetId: id,
        };
      }
      const WidgetClass = Scrivito.getClass(objClass);
      if (!WidgetClass) return null;
      return {
        // @ts-ignore
        widget: new WidgetClass({}),
        attributes,
        modification: "new",
      };
    }
  );

  return newWidgets.filter((w) => w !== null);
}

async function save(obj, widgetsDescription) {
  const scrivitoWidgets = toScrivitoWidgets(widgetsDescription, obj);
  const prevWidgets = flatWidgets(obj);

  const widgetIds = scrivitoWidgets
    .map(({ widgetId }) => widgetId)
    .filter((w) => !!w);
  const prevWidgetIds = prevWidgets.map((widget) => widget.id());
  const editWidgetIds = prevWidgetIds.filter((id) => widgetIds.includes(id));
  const editWidgets = scrivitoWidgets.filter(({ widgetId }) =>
    editWidgetIds.includes(widgetId)
  );

  editWidgets.forEach(({ widget, attributes }) => {
    const widgetToUpdate = obj.widgets().find((w) => w.id() === widget.id());
    updateAttributes(widgetToUpdate, attributes);
  });

  const hasNewWidgets = scrivitoWidgets.some(
    ({ modification }) => modification === "new"
  );
  const isUpdateOnly =
    !hasNewWidgets && widgetIds.join() === prevWidgetIds.join();

  if (!isUpdateOnly) {
    const firstPrevWidget = prevWidgets[0];
    const container = firstPrevWidget?.container() || obj;
    const preferredAttributeName = firstPrevWidget
      ? containerAttributeName(firstPrevWidget)
      : "body";
    const attributeName =
      widgetlistAttributeNames(container).find(
        (name) => name === preferredAttributeName
      ) || widgetlistAttributeNames(container)[0];
    const newWidgets = scrivitoWidgets.map(({ widget }) => widget);

    prevWidgets.forEach((prevWidget) => {
      const clearContainer = prevWidget.container();
      widgetlistAttributeNames(clearContainer).forEach((name) => {
        clearContainer.update({
          [name]: clearContainer
            .get(name)
            .filter((widget) =>
              widget.widgets().some((w) => w.id() === container.id())
            ),
        });
      });
    });
    container.update({ [attributeName]: newWidgets });
  }

  scrivitoWidgets.forEach(({ widget, attributes }) =>
    updateAttributes(widget, attributes)
  );
  await obj.finishSaving();
}

function containerAttributeName(widget) {
  const container = widget.container();
  return widgetlistAttributeNames(container).find((name) =>
    container.get(name).some((w) => w.id() === widget.id())
  );
}

function updateAttributes(content, attributes) {
  Object.entries(attributes).forEach(([key, value]) => {
    try {
      const name = key.replace("-title", "");
      const definition = content.attributeDefinitions()[name];
      if (!definition) {
        throw new Error(`Unknown attribute ${content.objClass()}#${key}`);
      }
      const [attributeType] = definition;
      switch (attributeType) {
        case "link":
          content.update({
            [name]: (content.get(name) || new Scrivito.Link({ url: "/" })).copy(
              {
                title: value,
              }
            ),
          });
          break;
        case "float":
        case "integer":
          content.update({ [name]: Number(value) });
          break;
        default:
          content.update({ [name]: value });
      }
    } catch (e) {
      console.error(e);
    }
  });
}
