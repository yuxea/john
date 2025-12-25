#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { walk } from "https://deno.land/std/fs/walk.ts";

const copyrightHeader = `/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
`;

const dir = "./";

for await (
	const entry of walk(dir, {
		exts: [".ts", ".tsx"],
		includeDirs: false,
		skip: [/(copyright|build)\.ts$/],
	})
) {
	const filePath = entry.path;
	const content = await Deno.readTextFile(filePath);

	if (!content.startsWith(copyrightHeader)) {
		await Deno.writeTextFile(filePath, copyrightHeader + "\n" + content);
		console.log(`aded header to ${filePath}`);
	}
}
