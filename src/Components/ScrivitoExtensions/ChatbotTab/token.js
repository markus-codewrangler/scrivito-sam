export async function refreshShortTermToken() {
  const tenantId =
    // @ts-ignore
    typeof import.meta.env === "undefined"
      ? // @ts-ignore
        process.env.SCRIVITO_TENANT
      : // @ts-ignore
        import.meta.env.SCRIVITO_TENANT;

  const auth = await (
    await fetch(
      `https://jr-api.scrivito.com/iam/${tenantId}/short_term_token?origin=${encodeURIComponent(
        "https://edit.scrivito.com"
      )}`,
      { credentials: "include" }
    )
  ).json();

  const token = auth.access_token;

  // @ts-ignore
  window.access_token = token;

  return !!token;
}
