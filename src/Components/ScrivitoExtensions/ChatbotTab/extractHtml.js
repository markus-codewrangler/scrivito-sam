import * as Scrivito from "scrivito";
import { flatWidgets } from "./flatWidgets.js";

export async function extractHtml(obj) {
  const widgets = await Scrivito.load(() => flatWidgets(obj));
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
