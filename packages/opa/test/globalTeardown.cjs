"use strict";

module.exports = async function globalTeardown() {
  if (global.__OPA_CONTAINER__) {
    await global.__OPA_CONTAINER__.stop();
    console.log("[opa-server] Container stopped");
  }
};
