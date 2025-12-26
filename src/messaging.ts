/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
	doesUserExist,
	getFeed,
	getProfile,
	refreshAllFeeds,
	refreshFeed,
} from "./api.ts";
import { getSettings, setSettings } from "./storage.ts";
import { ExtensionSettings, Tweet, TwitterProfile } from "./types.ts";

let refreshTimer: ReturnType<typeof setInterval> | undefined;

export async function scheduleRefresh(): Promise<void> {
	const { refreshInterval } = await getSettings();
	const intervalMs = refreshInterval * 60 * 1000;

	if (refreshTimer !== undefined) {
		clearInterval(refreshTimer);
	}

	refreshTimer = setInterval(() => {
		refreshAllFeeds().catch((error) => {
			console.error("refresh failed", error);
		});
	}, intervalMs);
	console.log(`refresh scheduled every ${refreshInterval} minutes`);
}

export function cancel(): void {
	if (refreshTimer !== undefined) {
		clearInterval(refreshTimer);
		refreshTimer = undefined;
	}
}

type RuntimeMessageProtocol =
	| { type: "GET_SETTINGS" }
	| { type: "UPDATE_SETTINGS"; settings: ExtensionSettings }
	| { type: "GET_FEED"; username: string }
	| { type: "GET_PROFILE"; username: string }
	| { type: "REFRESH_FEED"; username: string }
	| { type: "CHECK_USER"; username: string }
	| { type: "GET_ALL_FEEDS" }
	| { type: "GET_ALL_PROFILES" };

type RuntimeResponseProtocol =
	| ExtensionSettings
	| { success: boolean; error?: string }
	| { tweets: Tweet[] }
	| { profile: TwitterProfile }
	| { tweets: Tweet[]; profile: TwitterProfile }
	| { exists: boolean }
	| { feeds: Record<string, Tweet[]> }
	| { profiles: Record<string, TwitterProfile> };

async function handleMessage(
	message: RuntimeMessageProtocol,
): Promise<RuntimeResponseProtocol> {
	switch (message.type) {
		case "GET_SETTINGS":
			return await getSettings();
		case "UPDATE_SETTINGS": {
			await setSettings(message.settings);
			await scheduleRefresh();
			return { success: true };
		}
		case "GET_FEED": {
			const tweets = await getFeed(message.username);
			return { tweets };
		}
		case "GET_PROFILE": {
			const profile = await getProfile(message.username);
			return { profile };
		}
		case "REFRESH_FEED": {
			return await refreshFeed(message.username);
		}
		case "CHECK_USER": {
			const exists = await doesUserExist(message.username);
			return { exists };
		}
		case "GET_ALL_FEEDS": {
			const { twitterUsers } = await getSettings();
			const feeds: Record<string, Tweet[]> = {};

			await Promise.allSettled(
				twitterUsers.map(async (username) => {
					try {
						feeds[username] = await getFeed(username);
					} catch (error) {
						console.error(`failed to fetch user ${username}'s feed`, error);
						feeds[username] = [];
					}
				}),
			);

			return { feeds };
		}
		case "GET_ALL_PROFILES": {
			const { twitterUsers } = await getSettings();
			const profiles: Record<string, TwitterProfile> = {};

			await Promise.allSettled(
				twitterUsers.map(async (username) => {
					try {
						profiles[username] = await getProfile(username);
					} catch (error) {
						console.error(`failed to fetch ${username}'s profile`, error);
					}
				}),
			);

			return { profiles };
		}
	}
}

export function setupMessageListener(): void {
	browser.runtime.onMessage.addListener(
		(data: unknown): Promise<RuntimeResponseProtocol> => {
			return handleMessage(data as RuntimeMessageProtocol).catch((error) => {
				console.error("failed to handle message", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "unknown error",
				};
			});
		},
	);
}
