import * as React from "react";
import { availableModels, getModel, setModel } from "./model.js";

export function ModelChooser({ extraOptionLabel, onExtraOption }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showModels, setShowModels] = React.useState(false);
  return (
    <div
      className={`assist-model-chooser ${isOpen ? "active" : ""}`}
      onClick={(e) => {
        setShowModels(e.shiftKey);
        setIsOpen(!isOpen);
      }}
    >
      <i className="icon fa-gear"></i>
      {isOpen && extraOptionLabel && (
        <div
          className="assist-model-chooser-option"
          onClick={() => {
            setIsOpen(false);
            onExtraOption();
          }}
        >
          {extraOptionLabel}
        </div>
      )}
      {isOpen && showModels && <Options />}
    </div>
  );
}

function Options() {
  const [option, setOption] = React.useState("");

  React.useEffect(() => {
    setOption(getModel());
  }, []);

  return availableModels.map((name) => (
    <div
      key={name}
      className={`assist-model-chooser-option ${
        name === option ? "active" : ""
      }`}
      onClick={() => {
        setModel(name);
        setOption(name);
      }}
    >
      {humanReadable(name)}
    </div>
  ));
}

function humanReadable(name) {
  return name.replace(/.*\/|-?\d{5}.*$/g, "");
}
