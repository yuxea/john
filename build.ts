#!/usr/bin/env -S deno run --unstable-bundle --allow-read --allow-write
/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { copy } from "@std/fs/copy";
import { emptyDir } from "@std/fs/empty-dir";
import { join } from "@std/path";
import { parseArgs } from "@std/cli/parse-args";

const outDir = "./dist";

const flags = parseArgs(Deno.args, {
	boolean: ["dev", "firefox", "chrome"],
	default: { dev: false, firefox: false, chrome: true },
});

interface BrowserManifests {
	[id: string]: {
		omits: string[];
		isChromium?: true;
		overrides?: { [id: string]: any };
	};
}

const browsers: BrowserManifests = {
	chrome: {
		isChromium: true,
		omits: ["browser_action", "browser_specific_settings"],
		overrides: {
			background: {
				service_worker: "worker.js",
			},
		},
	},
	firefox: {
		overrides: {
			manifest_version: 2,
			background: {
				scripts: ["background.js"],
				type: "module",
			},
		},
		omits: ["action"],
	},
};

const browser = flags.firefox ? browsers.firefox : browsers.chrome;

const manifest = JSON.parse(Deno.readTextFileSync("manifest.json"));

browser.omits.forEach((omit) => delete manifest[omit]);
Object.entries(browser.overrides ?? {}).forEach(([key, value]) =>
	manifest[key] = value
);

async function build() {
	console.log("🍅🧹"), await emptyDir(outDir);

	const entrypoints = [
		{ input: "src/background.ts", output: "background.js" },
		{ input: "src/content.ts", output: "content.js" },
		{ input: "src/popup.tsx", output: "popup.js" },
	];

	await emptyDir(outDir);

	if (browser.isChromium) {
		Deno.writeTextFileSync(
			`${outDir}/worker.js`,
			"importScripts('browser-polyfill.js');importScripts('background.js')",
		);
	}

	await Deno.bundle({
		entrypoints: ["npm:webextension-polyfill"],
		outputPath: join(outDir, "browser-polyfill.js"),
		minify: !flags.dev,
		format: "iife",
		platform: "browser",
		write: true,
	});

	for (const entry of entrypoints) {
		console.log(
			entry.input,
			await Deno.bundle({
				entrypoints: [entry.input],
				outputPath: join(outDir, entry.output),
				minify: !flags.dev,
				sourcemap: flags.dev ? "inline" : "linked",
				format: "esm",
				platform: "browser",
				write: true,
				external: [
					"webextension-polyfill",
				],
			}),
		);
	}

	Deno.writeTextFileSync(
		`${outDir}/manifest.json`,
		JSON.stringify(manifest, null, 4),
	);
	await copy("static", `${outDir}/`, { overwrite: true });
	await copy("assets", `${outDir}/assets`, { overwrite: true });
}

if (import.meta.main) {
	await build();
}
