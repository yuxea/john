/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { fetchTwitterFeed } from "./feed.ts";
import { fetchTwitterProfile } from "./scrape.ts";
import {
	getCachedFeed,
	getCachedProfile,
	getSettings,
	setCachedFeed,
	setCachedProfile,
} from "./storage.ts";
import type { Tweet, TwitterProfile } from "./types.ts";

export async function getFeed(username: string): Promise<Tweet[]> {
	const cached = await getCachedFeed(username);
	if (cached) return cached;

	const { nitterInstance } = await getSettings();
	const feedUrl = `${nitterInstance}/${username}/rss`;
	const feed = await fetchTwitterFeed(feedUrl);

	return await setCachedFeed(username, feed.tweets), feed.tweets;
}

export async function getProfile(username: string): Promise<TwitterProfile> {
	const cached = await getCachedProfile(username);
	if (cached) return cached;

	const { nitterInstance } = await getSettings();
	const profileUrl = `${nitterInstance}/${username}`;
	const profile = await fetchTwitterProfile(profileUrl);

	return await setCachedProfile(username, profile), profile;
}

export async function refreshFeed(
	username: string,
): Promise<{ tweets: Tweet[]; profile: TwitterProfile }> {
	const { nitterInstance } = await getSettings();

	const [feed, profile] = await Promise.all([
		fetchTwitterFeed(`${nitterInstance}/${username}/rss`),
		fetchTwitterProfile(`${nitterInstance}/${username}`),
	]);

	await Promise.all([
		setCachedFeed(username, feed.tweets),
		setCachedProfile(username, profile),
	]);

	return { tweets: feed.tweets, profile };
}

export async function refreshAllFeeds(): Promise<void> {
	const { twitterUsers } = await getSettings();

	await Promise.allSettled(
		twitterUsers.map((username) => refreshFeed(username)),
	);
}

export async function doesUserExist(username: string): Promise<boolean> {
	try {
		const { nitterInstance } = await getSettings();
		const response = await fetch(`${nitterInstance}/${username}`);
		return response.ok;
	} catch {
		return false;
	}
}
