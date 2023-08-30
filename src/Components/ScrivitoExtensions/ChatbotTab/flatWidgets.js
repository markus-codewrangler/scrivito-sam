import { widgetlistAttributeNames } from "./widgetlistAttributeNames.js";

export function flatWidgets(content) {
  return widgetlistAttributeNames(content).flatMap((attributeName) =>
    content
      .get(attributeName)
      .flatMap((widget) =>
        widgetlistAttributeNames(widget).length ? flatWidgets(widget) : widget
      )
  );
}
