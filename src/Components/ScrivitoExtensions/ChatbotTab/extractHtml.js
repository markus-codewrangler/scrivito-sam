import * as Scrivito from "scrivito";
import { flatWidgets } from "./flatWidgets.js";
import { getPrimaryAttributeName } from "./getPrimaryAttributeName.js";

export async function extractHtml(obj) {
  return Scrivito.load(() => {
    const widgets = flatWidgets(obj);
    const html = widgets
      .map((w) => {
        const widgetClass = w.objClass();
        const primaryAttributeName = getPrimaryAttributeName(w);
        const inner = primaryAttributeName
          ? getStringValue(w, primaryAttributeName)
          : "";
        const tag =
          widgetClass.startsWith("Headline") && w.get("style")?.length === 2
            ? w.get("style")
            : "";
        return `  <widget ${getAttributesHtml(w, primaryAttributeName)}>${
          tag ? `<${tag}>` : ""
        }${inner}${tag ? `</${tag}>` : ""}</widget>`;
      })
      .join("\n");
    return `<html ${getAttributesHtml(obj)}>\n${html}\n</html>`;
  });
}

function getAttributesHtml(content, excludedAttributeName) {
  const attributes = { id: content.id(), type: content.objClass() };

  Object.entries(content.attributeDefinitions()).forEach(
    ([attributeName, [attributeType]]) => {
      if (attributeName === excludedAttributeName) return;
      if (
        [
          "boolean",
          "enum",
          "float",
          "integer",
          "link",
          "multienum",
          "string",
          "stringlist",
        ].includes(attributeType)
      ) {
        attributes[
          "link" === attributeType
            ? `data-${attributeName}-title`
            : `data-${attributeName}`
        ] = getStringValue(content, attributeName);
      }
    }
  );

  return Object.entries(attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

function getStringValue(content, attributeName) {
  const value = content.get(attributeName) ?? "";
  if (Array.isArray(value)) {
    let joiner = " ";
    if (value.some((v) => v.includes(" "))) joiner = ", ";
    if (value.some((v) => v.includes(","))) joiner = "; ";
    return value.length === 1 ? [value, ""].join(joiner) : value.join(joiner);
  }
  if (value instanceof Scrivito.Link) return value.title() || "";
  return value.toString();
}
