/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

console.log("[bridget] content script loaded");

const script = document.createElement("script");
script.src = browser.runtime.getURL("patches.js");
script.onload = function () {
	(this as typeof script).remove();
};
(document.head || document.documentElement).appendChild(script);
