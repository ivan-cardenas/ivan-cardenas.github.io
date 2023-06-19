// import { preventingDefault } from "@grrr/utils";
// import { publish, subscribe } from "./observer";
// import { showInfoBox, hideOverlays, setHideInfoBox } from "./observer-subjects";

// export const SELECTOR = ".js-map-intro";

const CONTENT_SELECTOR = ".js-content";
const START_SELECTOR = ".js-start";
const TOGGLE_SELECTOR = ".js-toggle";

export const MapIntro = (container) => {
  const content = container.querySelector(CONTENT_SELECTOR);
  const startButton = container.querySelector(START_SELECTOR);
  const toggleButton = container.querySelector(TOGGLE_SELECTOR);

  /**
   * Event callbacks.
   */
  const listeners = {};
  const onUpdate = (eventType, fn) => {
    listeners[eventType] = [...(listeners[eventType] || []), fn];
  };
  const dispatchEvent = (eventType) => {
    if (listeners[eventType]) {
      listeners[eventType].forEach((fn) => fn());
    }
  };

  /**
   * Toggle the element.
   */
  const toggle = (action) => {
    const hide = action
      ? action === "hide"
      : toggleButton.getAttribute("aria-expanded") === "true";
    startButton.setAttribute("aria-expanded", !hide);
    toggleButton.setAttribute("aria-expanded", !hide);
    content.setAttribute("aria-hidden", hide);
    container.setAttribute("data-expanded", !hide);
    dispatchEvent(hide ? "hide" : "show");

    if (hide) {
      publish(setHideInfoBox);
    }
  };

  return {
    init() {
      toggleButton.addEventListener(
        "click",
        preventingDefault((e) => toggle())
      );
      startButton.addEventListener(
        "click",
        preventingDefault((e) => toggle("hide"))
      );
    },
    show: () => toggle("show"),
    hide: () => toggle("hide"),

    on: onUpdate,
  };
};

export const enhancer = (container) => {
  const mapIntro = new MapIntro(container);
  mapIntro.init();

  // Hide map-intro when the info-box is shown.
  subscribe(showInfoBox, mapIntro.hide);
  subscribe(hideOverlays, mapIntro.hide);
};


