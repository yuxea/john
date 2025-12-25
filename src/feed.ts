/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { parseFeed } from "@mikaelporttila/rss";
import { Tweet, TwitterPartialProfile } from "./types.ts";
import { extractIdentifiersFromPartialUser } from "./utils.ts";

export interface TwitterFeed {
	partialProfile: TwitterPartialProfile;
	tweets: Tweet[];
}

function extractMediaUrls(content: string): string[] {
	const mediaUrls: string[] = [];

	const imgRegex = /<img[^>]+src="([^"]+)"/g;
	let match;
	while ((match = imgRegex.exec(content)) !== null) {
		mediaUrls.push(match[1]);
	}

	const videoRegex = /<a[^>]+href="([^"]+)"[^>]*>\s*<br>Video<br>/g;
	while ((match = videoRegex.exec(content)) !== null) {
		mediaUrls.push(match[1]);
	}

	return mediaUrls;
}

const normalize = (input: string): string =>
	input.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\n\s*\n/g, "\n")
		.trim();

export async function fetchFeed(url: string): Promise<TwitterFeed | null> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`failed to fetch rss feed: ${response.status} ${response.statusText}`,
		);
	}

	const xml = await response.text();
	const feed = await parseFeed(xml);
	if (!feed) {
		throw new Error("failed to parse RSS feed");
	}

	const { username, displayName } = extractIdentifiersFromPartialUser(
		feed.title.value ?? "Unknown",
	);

	const partialProfile: TwitterPartialProfile = {
		username,
		displayName,
		avatarPath: feed.image?.url,
	};
	const tweets: Tweet[] = [];

	for (const tweet of feed.entries) {
		const author = tweet.author?.name ?? tweet["dc:creator"]?.[0];
		if (!author) continue;

		const isRetweet = author !== partialProfile.username;
		const published = tweet.published ?? tweet.updated ??
			new Date(4, 3, 1984);
		const content = tweet.description?.value ?? tweet.title?.value ?? "";

		tweets.push({
			retweet: isRetweet ? { author: author } : undefined,
			id: String(tweet.id),
			author: partialProfile.username,
			content: normalize(content),
			date: published,
			media: extractMediaUrls(content) || undefined,
		});
	}

	return { partialProfile, tweets };
}
