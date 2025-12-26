/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { DEFAULT_SETTINGS } from "./constants.ts";
import { ExtensionSettings, Tweet, TwitterProfile } from "./types.ts";

const CACHE_EXPIRY_MS = 30 * 60 * 1000;

interface CachedItem<T> {
	data: T;
	timestamp: number;
	expiresAt: number;
}

interface StorageSchema {
	feeds: Record<string, CachedItem<Tweet[]>>;
	profiles: Record<string, CachedItem<TwitterProfile>>;
}

export async function getSettings(): Promise<ExtensionSettings> {
	const { settings } = await browser.storage.sync.get("settings");
	return settings as ExtensionSettings ?? DEFAULT_SETTINGS;
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
	await browser.storage.sync.set({ settings });
}

async function getCache(): Promise<StorageSchema> {
	const { cache } = await browser.storage.local.get("cache");
	return cache as StorageSchema ?? { feeds: {}, profiles: {} };
}

async function setCache(cache: StorageSchema): Promise<void> {
	await browser.storage.local.set({ cache });
}

function isExpired(item: CachedItem<any>): boolean {
	return Date.now() > item.expiresAt;
}

function createCacheItem<T>(data: T): CachedItem<T> {
	return {
		data,
		timestamp: Date.now(),
		expiresAt: Date.now() + CACHE_EXPIRY_MS,
	};
}

export async function getCachedFeed(username: string): Promise<Tweet[] | null> {
	const cache = await getCache();
	const item = cache.feeds[username];

	if (!item || isExpired(item)) {
		if (item) {
			delete cache.feeds[username];
			await setCache(cache);
		}
		return null;
	}

	return item.data;
}

export async function setCachedFeed(
	username: string,
	tweets: Tweet[],
): Promise<void> {
	const cache = await getCache();
	cache.feeds[username] = createCacheItem(tweets);
	await setCache(cache);
}

export async function getCachedProfile(
	username: string,
): Promise<TwitterProfile | null> {
	const cache = await getCache();
	const item = cache.profiles[username];

	if (!item || isExpired(item)) {
		if (item) {
			delete cache.profiles[username];
			await setCache(cache);
		}
		return null;
	}

	return item.data;
}

export async function setCachedProfile(
	username: string,
	profile: TwitterProfile,
): Promise<void> {
	const cache = await getCache();
	cache.profiles[username] = createCacheItem(profile);
	await setCache(cache);
}

export async function initializeStorage(): Promise<void> {
	const { settings } = await browser.storage.sync.get("settings");
	if (!settings) {
		await browser.storage.sync.set({ settings: DEFAULT_SETTINGS });
	}

	const { cache } = await browser.storage.local.get("cache");
	if (!cache) {
		await browser.storage.local.set({
			cache: { feeds: {}, profiles: {} },
		});
	}
}

export async function clearCache(): Promise<void> {
	await browser.storage.local.set({
		cache: { feeds: {}, profiles: {} },
	});
}
