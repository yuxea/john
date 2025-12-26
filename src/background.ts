/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { refreshAllFeeds } from "./api.ts";
import { scheduleRefresh, setupMessageListener } from "./messaging.ts";
import { initializeStorage } from "./storage.ts";

console.log("john background script loaded");

browser.runtime.onInstalled.addListener(async () => {
	await initializeStorage();
	await scheduleRefresh();
	await refreshAllFeeds();
});

(async () => {
	setupMessageListener();
	await scheduleRefresh();
})();
