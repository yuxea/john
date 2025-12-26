/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ExtensionSettings } from "./types.ts";

export const DEFAULT_SETTINGS: ExtensionSettings = {
	enabled: true,
	nitterInstance: "https://nitter.stay.rip",
	twitterUsers: [],
	refreshInterval: 30,
};
