/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { FeedEntry, parseFeed } from "@mikaelporttila/rss";
import { DOMParser, Element } from "@b-fuze/deno-dom/wasm-legacy";
import { Tweet, TwitterPartialProfile } from "./types.ts";
import {
	extractIdentifiersFromPartialUser,
	extractIdentifiersFromQuotedUser,
} from "./utils.ts";

export interface TwitterFeed {
	partialProfile: TwitterPartialProfile;
	tweets: Tweet[];
}

function extractMediaUrls(element: Element): string[] {
	const mediaUrls: string[] = [];

	element.querySelectorAll("img").forEach((img) => {
		const src = img.getAttribute("src");
		if (src) mediaUrls.push(src);
		img.remove();
	});

	element.querySelectorAll("a").forEach((link) => {
		const href = link.getAttribute("href");
		const text = link.textContent?.trim();
		if (href && text === "Video") {
			mediaUrls.push(href);
			link.remove();
		}
	});

	return mediaUrls;
}

function parseContent(
	input: string,
): {
	content: string;
	mediaUrls: string[];
	child?: Tweet["child"];
} {
	const parser = new DOMParser();
	const doc = parser.parseFromString(input, "text/html");

	if (!doc) return { content: input, mediaUrls: [] };
	const mediaUrls = extractMediaUrls(doc.body);

	const blockquote = doc.querySelector("blockquote");
	let child: ReturnType<typeof parseQuoted>;

	if (blockquote) {
		doc.querySelector("hr")?.remove();
		child = parseQuoted(blockquote);
		blockquote.remove();
	}

	return {
		content: doc.body?.textContent.trim() || "",
		mediaUrls,
		child,
	};
}

function parseQuoted(blockquote: Element): Tweet["child"] | undefined {
	if (!blockquote) return;

	const identityElement = blockquote.querySelector("b");
	const { username, displayName } = extractIdentifiersFromQuotedUser(
		identityElement?.textContent ?? "Unknown",
	);
	identityElement?.remove();

	const partialProfile: TwitterPartialProfile = {
		username,
		displayName,
	};

	let id: string | undefined;
	for (const link of blockquote.querySelectorAll("a")) {
		const text = link?.getAttribute("href");
		if (!text) continue;

		const url = new URL(text),
			match = url.pathname.match(/\/status\/(\d+)/);

		if (match) {
			id = match[1];
			link.remove();
			break;
		}
	}

	const mediaUrls = extractMediaUrls(blockquote);
	blockquote.querySelector("footer")?.remove();

	return {
		content: blockquote.textContent.trim() || "",
		author: partialProfile,
		media: mediaUrls,
		id: id || "unknown",
	};
}

function parseTweetEntry(
	partialProfile: TwitterPartialProfile,
	tweet: FeedEntry,
) {
	const author = tweet.author?.name ?? tweet["dc:creator"]?.[0];
	if (!author) return null;

	const isRetweet = author !== partialProfile.username;
	const published = tweet.published ?? tweet.updated ??
		new Date(1984, 3, 4);
	const { content, mediaUrls, child } = parseContent(
		tweet.description?.value ?? tweet.title?.value ?? "",
	);

	return {
		retweet: isRetweet ? { author } : undefined,
		id: String(tweet.id),
		author: partialProfile,
		content,
		date: published,
		media: mediaUrls || undefined,
		child,
	};
}

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
			.map((entry) => parseTweetEntry(partialProfile, entry))
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
