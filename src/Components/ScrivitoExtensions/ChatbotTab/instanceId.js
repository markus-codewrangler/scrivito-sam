import * as Scrivito from "scrivito";

export function instanceId() {
  let instanceId = Scrivito.getInstanceId?.();

  // @ts-ignore
  if (!instanceId && typeof import.meta.env.SCRIVITO_TENANT !== "undefined") {
    // @ts-ignore
    instanceId = import.meta.env.SCRIVITO_TENANT;
  }
  // @ts-ignore
  if (!instanceId && typeof process.env.SCRIVITO_TENANT !== "undefined") {
    // @ts-ignore
    instanceId = process.env.SCRIVITO_TENANT;
  }

  return instanceId;
}
