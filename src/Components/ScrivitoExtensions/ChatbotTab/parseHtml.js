import * as Scrivito from "scrivito";

export function parseHtml(html) {
  const parts = html.split(/<widget|<\/widget>/).filter((p) => p.trim() !== "");
  const widgetsDescription = parts.map(partToWidget);

  return widgetsDescription;
}

function partToWidget(part) {
  const html = part.replace(/^[^<]*>/, "").replace(/(<\/)?script/g, "$1pre");
  const result = { objClass: "TextWidget", id: null, _innerHtml: html };

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
    attributes.match(/data-[\w-]+="[^"]*"/g).forEach((a) => {
      const [, key, value] = a.match(/data-([\w-]+)="([^"]*)"/);
      result[key] = value;
    });
  }

  if (result.objClass.startsWith("Headline")) {
    const styleMatch = html.match(/^<(\w+)/);
    result.style = styleMatch ? styleMatch[1] : null;
    result.headline = html.replace(/^\s*<\w+>|<\/\w+>\s*$/g, "");
  }

  if (result.objClass.startsWith("Text")) {
    result.text = html;
  }

  return result;
}
