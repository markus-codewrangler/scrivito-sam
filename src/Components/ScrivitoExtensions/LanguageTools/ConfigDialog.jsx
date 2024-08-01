import * as React from "react";
import * as Scrivito from "scrivito";

export const ConfigDialog = Scrivito.connect(function ConfigDialog({
  onClose,
}) {
  return (
    <dialog className="assist-dialog-modal" open>
      <Scrivito.ContentTag
        className="assist-dialog-config-text"
        content={Scrivito.Obj.root()}
        attribute="languageToolsPrompt"
      />
      <span className="btn" onClick={onClose}>
        OK
      </span>
    </dialog>
  );
});
