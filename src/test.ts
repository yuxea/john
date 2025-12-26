/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { extractIdentifiersFromPartialUser } from "./utils.ts";

import sample from "./test.sample.json" with { type: "json" };
import { parseTwitterFeed } from "./feed.ts";
import { parseScrapedTwitterProfile } from "./scrape.ts";

const { twitterFeed, twitterProfile } = sample;

Deno.test("extractIdentifiersFromPartialUser - valid input", () => {
	const result = extractIdentifiersFromPartialUser(
		"fuck elon musk / @fuckelonmusk",
	);
	assertEquals(result.displayName, "fuck elon musk");
	assertEquals(result.username, "@fuckelonmusk");
});

Deno.test("extractIdentifiersFromPartialUser - no separator", () => {
	const result = extractIdentifiersFromPartialUser("fuckelonmusk");
	assertEquals(result.displayName, "fuckelonmusk");
	assertEquals(result.username, "@fuckelonmusk");
});

Deno.test("extractIdentifiersFromPartialUser - empty string", () => {
	const result = extractIdentifiersFromPartialUser("");
	assertEquals(result.displayName, "Unknown");
	assertEquals(result.username, "@unknown");
});

Deno.test("extractIdentifiersFromPartialUser - whitespace only", () => {
	const result = extractIdentifiersFromPartialUser("	 ");
	assertEquals(result.displayName, "Unknown");
	assertEquals(result.username, "@unknown");
});

Deno.test("extractIdentifiersFromPartialUser - extra whitespace", () => {
	const result = extractIdentifiersFromPartialUser(
		"  fuck elon musk	  /  @fuckelonmusk  ",
	);
	assertEquals(result.displayName, "fuck elon musk");
	assertEquals(result.username, "@fuckelonmusk");
});

Deno.test("parseTwitterFeed - valid feed", async () => {
	const result = await parseTwitterFeed(twitterFeed);

	assertExists(result);
	assertEquals(result.partialProfile.username, "@elonmusk");
	assertEquals(result.partialProfile.displayName, "Elon Musk");
	assertExists(result.partialProfile.avatarPath);

	assertEquals(result.tweets.length, 20);
});

Deno.test("parseTwitterFeed - identifies retweets", async () => {
	const result = await parseTwitterFeed(twitterFeed);

	const retweet = result.tweets.find((t) => t.id === "2004246048915755270");
	assertExists(retweet);
	assertExists(retweet.retweet);
	assertEquals(retweet.retweet.author, "@JDVance");
});

Deno.test("parseTwitterFeed - identifies original tweets", async () => {
	const result = await parseTwitterFeed(twitterFeed);

	const originalTweet = result.tweets.find((t) =>
		t.id === "2004236268075733117"
	);
	assertExists(originalTweet);
	assertEquals(originalTweet.retweet, undefined);
	assertEquals(originalTweet.author.username, "@elonmusk");
});

Deno.test("parseTwitterFeed - extracts media urls", async () => {
	const result = await parseTwitterFeed(twitterFeed);

	const tweetWithMedia = result.tweets.find((t) =>
		t.id === "2004146656821002483"
	);
	assertExists(tweetWithMedia);
	assertExists(tweetWithMedia.media);
	assertEquals(tweetWithMedia.media.length > 0, true);
});

Deno.test("parseTwitterFeed - normalizes content", async () => {
	const result = await parseTwitterFeed(twitterFeed);

	const tweet = result.tweets.find((t) => t.id === "2004236268075733117");
	assertExists(tweet);
	assertEquals(tweet.content, "🎁🎄 Merry Christmas!! 🎄🎁");
});

Deno.test("parseTwitterFeed - parses dates", async () => {
	const result = await parseTwitterFeed(twitterFeed);

	const tweet = result.tweets[0];
	assertEquals(tweet.date && tweet.date instanceof Date, true);
});

Deno.test("parseScrapedTwitterProfile - identifies racism", () => {
	const result = parseScrapedTwitterProfile(twitterProfile);

	assertEquals(result.username, "@elonmusk");
	assertEquals(result.displayName, "Elon Musk");
	assertEquals(result.racist, true);
});

Deno.test("parseScrapedTwitterProfile - parses stats", () => {
	const result = parseScrapedTwitterProfile(twitterProfile);

	assertEquals(result.count.tweets, 92143);
	assertEquals(result.count.following, 1255);
	assertEquals(result.count.followers, 230413484);
	assertEquals(result.count.likes, 192497);
});

Deno.test("parseScrapedTwitterProfile - parses join date", () => {
	const result = parseScrapedTwitterProfile(twitterProfile);

	assertExists(result.joinDate);
	assertEquals(result.joinDate instanceof Date, true);
	assertEquals(result.joinDate.getFullYear(), 2009);
});

Deno.test("parseTwitterFeed - handles complex blockquote with links", async () => {
	const result = await parseTwitterFeed(twitterFeed);

	const tweet = result.tweets.find((t) => t.id === "2004190405022064720");
	assertExists(tweet, "tweet with id 2004190405022064720 should exist");

	assertStringIncludes(
		tweet.content,
		"GROK STAYS AHEAD OF THE CURVE: ACING ALL TESTS KNOWN TO MAN",
		"should include the main content",
	);

	assertStringIncludes(
		tweet.content,
		"Source: @xAI, @TechCrunch",
		"should include the source from the quoted content",
	);

	assertStringIncludes(
		tweet.content,
		"It's not just the smartest LLM",
		"html entities should be decoded",
	);

	assertStringIncludes(
		tweet.child!.content,
		"Try the @Grok app!",
		"nested quote should be included",
	);

	assertStringIncludes(
		tweet.child!.content,
		"apps.apple.com/us/app/grok/i",
		"links should be preserved",
	);
});
