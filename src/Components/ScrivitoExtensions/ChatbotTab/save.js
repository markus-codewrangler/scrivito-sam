import * as Scrivito from "scrivito";

import { flatWidgets } from "./flatWidgets";
import { widgetlistAttributeNames } from "./widgetlistAttributeNames.js";
import { getPrimaryAttributeName } from "./getPrimaryAttributeName.js";

export function canBeSaved(obj, widgetsDescription) {
  return !!toScrivitoWidgets(obj, widgetsDescription);
}

export async function save(obj, widgetsDescription) {
  const scrivitoWidgets = toScrivitoWidgets(obj, widgetsDescription);
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
  const primaryAttributeName = getPrimaryAttributeName(content);
  Object.entries(attributes).forEach(([key, rawValue]) => {
    const name =
      key === "_innerHtml" ? primaryAttributeName : key.replace("-title", "");
    if (!name) return;
    const definition = content.attributeDefinitions()[name];
    if (!definition) {
      console.error(`Unknown attribute ${content.objClass()}#${key}`);
      return;
    }

    const [attributeType] = definition;

    const needsCleanup = key === "_innerHtml" && attributeType !== "html";
    const value = needsCleanup ? cleanUp(rawValue, attributeType) : rawValue;

    try {
      switch (attributeType) {
        case "enum":
          content.update({ [name]: value || null });
          break;
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
        case "multienum":
        case "stringlist":
          content.update({ [name]: value.split(/,? /).filter((v) => !!v) });
          break;
        default:
          content.update({ [name]: value });
      }
    } catch (e) {
      console.error(e);
    }
  });
}

function cleanUp(rawValue, attributeType) {
  return rawValue.replace(/^\s*<\w+>|<\/\w+>\s*$/g, "").trim();
}

function toScrivitoWidgets(obj, widgetsDescription) {
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
