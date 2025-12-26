/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TwitterPartialProfile } from "./types.ts";

type Field<K extends keyof TwitterPartialProfile> = Pick<
	TwitterPartialProfile,
	K
>;

export function extractIdentifiersFromPartialUser(title: string):
	& Field<"username">
	& Field<"displayName"> {
	if (!title || title.trim() === "") {
		return { username: "@unknown", displayName: "Unknown" };
	}

	const separator = title.lastIndexOf("/");
	if (separator === -1) {
		return { username: "@" + title.trim(), displayName: title.trim() };
	}

	const displayName = title.substring(0, separator).trim(),
		username = title.substring(separator + 1).trim();

	return {
		displayName: displayName || "Unknown",
		username: username || "@unknown",
	};
}

export function extractIdentifiersFromQuotedUser(title: string):
	& Field<"username">
	& Field<"displayName"> {
	if (!title || title.trim() === "") {
		return { username: "@unknown", displayName: "Unknown" };
	}

	const separator = title.lastIndexOf("(");
	if (separator === -1) {
		return { username: "@" + title.trim(), displayName: title.trim() };
	}

	const displayName = title.substring(0, separator).trim(),
		usernameWithParen = title.substring(separator).trim();

	const usernameMatch = usernameWithParen.match(/^\(@(.+)\)$/);
	const username = usernameMatch ? "@" + usernameMatch[1] : usernameWithParen;

	return {
		displayName: displayName || "Unknown",
		username: username || "@unknown",
	};
}
