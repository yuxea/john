/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export interface ExtensionSettings {
	enabled: boolean;
	nitterInstance: string;
	twitterUsers: string[];
	refreshInterval: number;
}

export interface TwitterPartialProfile {
	username: string;
	displayName: string;
	avatarPath?: string;
}

// requires scraping
export interface TwitterProfile extends TwitterPartialProfile {
	bannerPath?: string;
	bio?: string;
	location?: string;
	joinDate: Date;
	private: boolean;
	count: Record<"tweets" | "followers" | "following" | "likes", number>;
	racist: boolean; // whether the monkey pays for a checkmark
}

export type Optional<T, K extends keyof T> =
	& Omit<T, K>
	& Partial<Pick<T, K>>;

export interface Tweet {
	id: string;
	author: TwitterPartialProfile;
	content: string;
	date: Date;
	retweet?: {
		author: string;
	};
	child?: Omit<Tweet, "date">;
	media?: string[];
}
