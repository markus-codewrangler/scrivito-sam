import * as Scrivito from "scrivito";

let token;

export async function refreshToken() {
  // @ts-ignore
  window.tenantId =
    Scrivito.getInstanceId?.() ||
    // @ts-ignore
    typeof import.meta.env === "undefined"
      ? // @ts-ignore
        process.env.SCRIVITO_TENANT
      : // @ts-ignore
        import.meta.env.SCRIVITO_TENANT;

  token = await Scrivito.load(() =>
    // @ts-ignore
    Scrivito.currentEditor()?.authToken()
  );

  return !!token;
}

export function getToken() {
  return token;
}
