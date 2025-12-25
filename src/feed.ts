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
	const parser = new DOMParser();
	const doc = parser.parseFromString(content, "text/html");

	if (!doc) return mediaUrls;

	doc.querySelectorAll("img").forEach((img) => {
		const src = img.getAttribute("src");
		if (src) mediaUrls.push(src);
	});

	doc.querySelectorAll("a").forEach((link) => {
		const href = link.getAttribute("href");
		const text = link.textContent?.trim();
		if (href && text === "Video") {
			mediaUrls.push(href);
		}
	});

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

export async function parseTwitterFeed(
	data: string,
): Promise<TwitterFeed> {
	try {
		const feed = await parseFeed(data);
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

		const tweets: Tweet[] = feed.entries
			.map((tweet) => {
				const author = tweet.author?.name ?? tweet["dc:creator"]?.[0];
				if (!author) return null;

				const isRetweet = author !== partialProfile.username;
				const published = tweet.published ?? tweet.updated ??
					new Date(1984, 3, 4);
				const content = tweet.description?.value ?? tweet.title?.value ?? "";

				return {
					retweet: isRetweet ? { author } : undefined,
					id: String(tweet.id),
					author: partialProfile.username,
					content: normalize(content),
					date: published,
					media: extractMediaUrls(content) || undefined,
				};
			})
			.filter((tweet) => tweet !== null);

		return { partialProfile, tweets };
	} catch (e) {
		console.error("error parsing feed:", e);
		throw e;
	}
}

export async function fetchTwitterFeed(
	url: string,
): Promise<TwitterFeed> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`failed to fetch rss feed: ${response.status} ${response.statusText}`,
			);
		}

		const html = await response.text();
		return parseTwitterFeed(html);
	} catch (e) {
		console.error("error fetching feed:", e);
		throw e;
	}
}
