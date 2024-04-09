export function getPrimaryAttributeName(content) {
  const entries = Object.entries(content.attributeDefinitions());
  return ["html", "string", "link"]
    .flatMap((type) =>
      entries.map(([attributeName, [attributeType]]) =>
        attributeType === type ? attributeName : null
      )
    )
    .find((n) => !!n);
}
