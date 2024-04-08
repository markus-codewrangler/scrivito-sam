import * as Scrivito from "scrivito";
import { flatWidgets } from "./flatWidgets.js";

export async function extractHtml(obj) {
  return Scrivito.load(() => {
    const widgets = flatWidgets(obj);
    const html = widgets
      .map((w) => {
        const widgetClass = w.objClass();
        const inner = w.get("headline") || w.get("text") || "";
        const tag = widgetClass.startsWith("Headline") ? w.get("style") : "";
        return `  <widget ${getAttributesHtml(w)}>${
          tag ? `<${tag}>` : ""
        }${inner}${tag ? `</${tag}>` : ""}</widget>`;
      })
      .join("\n");
    return `<html ${getAttributesHtml(obj)}>\n${html}\n</html>`;
  });
}

function getAttributesHtml(content) {
  const attributes = { id: content.id(), type: content.objClass() };

  Object.entries(content.attributeDefinitions()).forEach(
    ([attributeName, [attributeType]]) => {
      if ("link" === attributeType) {
        attributes[`data-${attributeName}-title`] =
          content.get(attributeName)?.title() || "";
      }
      if (
        [
          "boolean",
          "enum",
          "float",
          "integer",
          "multienum",
          "string",
          "stringlist",
        ].includes(attributeType)
      ) {
        attributes[`data-${attributeName}`] = []
          .concat(content.get(attributeName) ?? "")
          .join(" ");
      }
    }
  );

  return Object.entries(attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}
