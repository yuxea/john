#!/usr/bin/env -S deno run --unstable-bundle --allow-read --allow-write
/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { copy } from "@std/fs/copy";
import { emptyDir } from "@std/fs/empty-dir";
import { join } from "@std/path";

const outDir = "./dist";
const isDev = Deno.args.includes("--dev");

async function build() {
	console.log("🍅🧹"), await emptyDir(outDir);

	const entrypoints = [
		{ input: "src/background.ts", output: "background.js" },
		{ input: "src/popup.tsx", output: "popup.js" },
	];

	for (const entry of entrypoints) {
		await Deno.bundle({
			entrypoints: [entry.input],
			outputPath: join(outDir, entry.output),
			minify: !isDev,
			sourcemap: isDev ? "inline" : "linked",
			format: "esm",
			platform: "browser",
			write: true,
		});
	}

	await Deno.copyFile("manifest.json", `${outDir}/manifest.json`);
	await copy("assets", `${outDir}/assets`, { overwrite: true });
}

if (import.meta.main) {
	await build();
}
