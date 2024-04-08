import * as Scrivito from "scrivito";

export function parseHtml(html) {
  const parts = html.split(/<widget|<\/widget>/).filter((p) => p.trim() !== "");
  const widgetsDescription = parts.map(partToWidget);

  return widgetsDescription;
}

function partToWidget(part) {
  const html = part.replace(/^[^<]*>/, "");
  const result = { objClass: "TextWidget", id: null };

  const hasWidgetData = html !== part;
  if (hasWidgetData) {
    const attributes = part.split(">")[0];
    const idMatch = attributes.match(/id="([a-f0-9]{8})"/);
    if (idMatch) {
      const [, id] = idMatch;
      result.id = id;
    }
    const typeMatch = attributes.match(/type="([A-Z][a-zA-Z]*Widget)"/);
    if (typeMatch && Scrivito.getClass(typeMatch[1]) !== null) {
      const [, type] = typeMatch;
      result.objClass = type;
    }
    const linkTitleMatch = attributes.match(/data-(\w+-title)="([^"]*)"/);
    if (linkTitleMatch) {
      const [, key, value] = linkTitleMatch;
      result[key] = value;
    }
  }

  if (result.objClass.startsWith("Headline")) {
    const styleMatch = html.match(/^<(\w+)/);
    result.style = styleMatch ? styleMatch[1] : null;
    result.headline = html.replace(/^\s*<\w+>|<\/\w+>\s*$/g, "");
  }

  if (result.objClass.startsWith("Text")) {
    result.text = html.replace(/(<\/)?script/g, "$1pre");
  }

  return result;
}
