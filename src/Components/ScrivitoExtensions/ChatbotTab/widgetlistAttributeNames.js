import { sortBy } from "lodash-es";

export function widgetlistAttributeNames(content) {
  const attributes = content.attributeDefinitions();
  return sortBy(
    Object.keys(attributes).filter(
      (name) => attributes[name][0] === "widgetlist"
    ),
    (name) => name.replace("nav", "0")
  );
}
