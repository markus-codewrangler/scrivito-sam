import * as React from "react";
import * as Scrivito from "scrivito";
import { useChatCompletion } from "openai-streaming-hooks-chrome-fix";
import TextareaAutosize from "react-textarea-autosize";
import { sortBy, throttle } from "lodash-es";
import { languages } from "./languages.js";
import { getToken, refreshToken } from "./token.js";

import "./ChatbotTab.scss";

export function ChatbotTab({ obj }) {
  const uiContext = Scrivito.uiContext();
  const editor = Scrivito.currentEditor();
  const locale = Scrivito.editorLanguage() || "en";

  if (!uiContext || !editor) return null;

  return (
    <div className={`scrivito_${uiContext.theme}`}>
      <div className="scrivito_detail_content">
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
    model: "gpt-3.5-turbo-0613",
    // @ts-ignore
    apiKey: getToken,
    user: editor.id(),
  });

  React.useEffect(scrollToEnd, [messages]);
  const language = languages[locale];
  const onSend = React.useCallback(async () => {
    const html = await widgetsToHtml(obj);
    console.log(html);

    if (!prompt) return;

    const submit = [];
    if (messages.length === 0) {
      setSystemHtml(html);
      submit.push({
        content: language.systemPrompt
          .replace("<USERNAME>", editor.name() || "???")
          .replace("<USEREMAIL>", editor.email() || "???")
          .replace("<WIDGETHTML>", html),
        role: "system",
      });
    } else if (systemHtml !== html) {
      setSystemHtml(html);
      submit.push({
        content: language.systemUpdatePrompt.replace("<WIDGETHTML>", html),
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
    language.systemPrompt,
    language.systemUpdatePrompt,
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
                    className="btn btn-primary refresh"
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
          <button
            className="btn btn-primary send"
            onClick={onSend}
            title={language.send}
          >
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

const SPLIT = /<\/html>\s*```|```html\n<html>|<\/html>|<html>|```[a-z]*/;

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
    const widgetsDescription = isHtml ? parseHtmlToWidgets(part) : undefined;
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
      className="btn btn-primary accept"
      onClick={() => save(obj, widgetsDescription)}
    >
      <i className="icon fa-check"></i>
    </button>
  );
});

function toScrivitoWidgets(widgetsDescription, obj) {
  if (!widgetsDescription) return undefined;
  const prevWidgets = getWidgets(obj);
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
        return { widget: existingWidget, attributes, modification: "edit" };
      }
      const WidgetClass = Scrivito.getClass(objClass);
      if (!WidgetClass) return null;
      return {
        // @ts-ignore
        widget: new WidgetClass(attributes),
        attributes,
        modification: "new",
      };
    }
  );

  return newWidgets.filter((w) => w !== null);
}

async function save(obj, widgetsDescription) {
  const scrivitoWidgets = toScrivitoWidgets(widgetsDescription, obj);
  const prevWidgets = getWidgets(obj);

  const isUpdateOnly =
    scrivitoWidgets
      .map(({ modification, widget }) =>
        modification === "update" ? widget.id() : modification
      )
      .join() === prevWidgets.map((widget) => widget.id()).join();

  if (!isUpdateOnly) {
    let container = obj;
    if (prevWidgets.length) container = prevWidgets[0].container();
    const newWidgets = scrivitoWidgets.map(({ widget }) => widget);
    const attributeName = widgetlistAttributeNames(container)[0];

    const containers = prevWidgets.map((widget) => widget.container());
    containers.forEach((c) =>
      widgetlistAttributeNames(c).forEach((name) => c.update({ [name]: [] }))
    );
    container.update({ [attributeName]: newWidgets });
  }

  scrivitoWidgets.forEach(({ widget, attributes }) =>
    widget.update(attributes)
  );
  await obj.finishSaving();
}

function parseHtmlToWidgets(html) {
  const parts = html.split(/<widget|<\/widget>/).filter((p) => p.trim() !== "");
  const widgetsDescription = parts.map(partToWidget);

  return widgetsDescription;
}

function partToWidget(part) {
  const html = part.replace(/^[^<]*>/, "");
  let type = "TextWidget";
  let id = null;

  const hasWidgetData = html !== part;
  if (hasWidgetData) {
    const attributes = part.split(">")[0];
    const idMatch = attributes.match(/id="([a-f0-9]{8})"/);
    if (idMatch) [, id] = idMatch;
    const typeMatch = attributes.match(/type="([A-Z][a-zA-Z]*Widget)"/);
    if (typeMatch && Scrivito.getClass(typeMatch[1]) !== null) {
      [, type] = typeMatch;
    }
  }

  const result = { objClass: type, id };

  if (type === "HeadlineWidget") {
    const styleMatch = html.match(/^<(h.)/);
    result.style = styleMatch ? styleMatch[1] : "h2";
    result.headline = html.replace(/^\s*<h.>|<\/h.>\s*$/g, "");
  }

  if (type === "TextWidget") {
    result.text = html.replace(/(<\/)?script/g, "$1pre");
  }

  return result;
}

async function widgetsToHtml(obj) {
  const widgets = await Scrivito.load(() => getWidgets(obj));
  const html = widgets
    .map((w) => {
      const id = w.id();
      const widgetClass = w.objClass();
      const inner = w.get("headline") || w.get("text") || "";
      const tag = widgetClass === "HeadlineWidget" ? w.get("style") : "";
      return `<widget type="${widgetClass}" id="${id}">${
        tag ? `<${tag}>` : ""
      }${inner}${tag ? `</${tag}>` : ""}</widget>`;
    })
    .join("\n");
  return `<html>\n${html}\n</html>`;
}

function getWidgets(content) {
  return widgetlistAttributeNames(content).flatMap((attributeName) =>
    content
      .get(attributeName)
      .flatMap((widget) =>
        widgetlistAttributeNames(widget).length ? getWidgets(widget) : widget
      )
  );
}

function widgetlistAttributeNames(content) {
  const attributes = content.attributeDefinitions();
  return sortBy(
    Object.keys(attributes).filter(
      (name) => attributes[name][0] === "widgetlist"
    ),
    (name) => name.replace("nav", "0")
  );
}
