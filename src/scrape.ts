/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { DOMParser, Element } from "@b-fuze/deno-dom/wasm-legacy";
import { TwitterProfile } from "./types.ts";

const parseNumber = (input: string | undefined): number =>
	input ? parseInt(input.replace(/,/g, ""), 10) : 0;

const parseJoinDate = (input: string | undefined): Date =>
	input ? new Date(input.replace(/^Joined\s+/i, "")) : new Date(1984, 3, 4);

export async function fetchTwitterProfile(
	url: string,
): Promise<TwitterProfile> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`failed to fetch user page, status ${response.status}`);
		}

		const html = await response.text();
		return parseScrapedTwitterProfile(html);
	} catch (e) {
		console.error("error fetching user:", e);
		throw e;
	}
}

export function parseScrapedTwitterProfile(
	data: string,
): TwitterProfile {
	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(data, "text/html");

		const card = doc.querySelector(
			".container > .profile-tabs > .profile-tab > .profile-card",
		);
		if (!card) {
			throw new Error(`failed to retrieve user data: ${data}`);
		}

		const $$ = (
			query: string,
			root: Element = card,
		) => root.querySelector(query);

		const $ = (
			query: string,
			root: Element = card,
		) => $$(query, root)?.textContent?.trim();

		return {
			username: $(".profile-card-tabs-name > .profile-card-username") ??
				"@unknown",
			displayName: $(".profile-card-tabs-name > .profile-card-fullname") ??
				"Unknown",
			racist: !!$$(
				".profile-card-tabs-name > .profile-card-fullname .verified-icon",
			),
			avatarPath:
				$$(".profile-card-info > .profile-card-avatar > img")?.getAttribute(
					"src",
				) || undefined,
			bannerPath: $$(
				".profile-tabs > .profile-banner > a > img",
				doc as unknown as Element,
			)?.getAttribute("src") || undefined,
			count: {
				followers: parseNumber($(".followers > .profile-stat-num")),
				following: parseNumber($(".following > .profile-stat-num")),
				likes: parseNumber($(".likes > .profile-stat-num")),
				tweets: parseNumber($(".posts > .profile-stat-num")),
			},
			joinDate: parseJoinDate($(".profile-joindate > span")),
			bio: $(".profile-card-extra > .profile-bio"),
			location: $(".profile-card-extra > .profile-location"),
			private: !!$$(".profile-card-fullname .icon-lock"),
		};
	} catch (e) {
		console.error("error parsing user:", e);
		throw e;
	}
}
