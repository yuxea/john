/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { DEFAULT_SETTINGS } from "./constants.ts";
import { ExtensionSettings } from "./types.ts";

class JohnError extends Error {
	constructor(message: string, public code: string) {
		super(message);
		this.name = "JohnError";
	}
}

browser.runtime.onInstalled.addListener(async () => {
	const { settings } = await browser.storage.sync.get("settings");
	if (!settings) {
		await browser.storage.sync.set({ settings: DEFAULT_SETTINGS });
	}
});

async function getSettings(): Promise<ExtensionSettings> {
	const { settings } = await browser.storage.sync.get("settings");
	return (settings ?? DEFAULT_SETTINGS) as ExtensionSettings;
}

type RuntimeMessageProtocol =
	| { type: "GET_SETTINGS" }
	| { type: "UPDATE_SETTINGS"; settings: ExtensionSettings };

type RuntimeResponse =
	| ExtensionSettings
	| { success: boolean; error?: string };

function isRuntimeMessage(value: unknown): value is RuntimeMessageProtocol {
	if (typeof value !== "object" || value === null) return false;

	const msg = value as { type?: unknown };

	if (msg.type === "GET_SETTINGS") return true;

	if (
		msg.type === "UPDATE_SETTINGS" &&
		typeof (value as any).settings === "object"
	) {
		return true;
	}

	return false;
}

browser.runtime.onMessage.addListener(
	async (message: unknown): Promise<RuntimeResponse | void> => {
		try {
			if (!isRuntimeMessage(message)) {
				throw new JohnError("invalid message format", "INVALID_MESSAGE");
			}

			switch (message.type) {
				case "GET_SETTINGS":
					return await getSettings();

				case "UPDATE_SETTINGS":
					if (!message.settings || typeof message.settings !== "object") {
						throw new JohnError("invalid settings object", "INVALID_SETTINGS");
					}
					await browser.storage.sync.set({ settings: message.settings });
					return { success: true };
			}
		} catch (error) {
			console.error("background script error", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "unknown error",
			};
		}
	},
);
