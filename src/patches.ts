/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { defineExtension } from "./inject.ts";

defineExtension({
	name: "sample",
	patches: [
		{
			query: [/Anything but skeet/],
			patch: [
				{
					match: /Anything but skeet/g,
					replace: "Anything but skeet (and Twitter posts!)",
				},
			],
		},
	],
	start() {
		console.log("smeowmewoem,w owemowe meow");
	},
});
