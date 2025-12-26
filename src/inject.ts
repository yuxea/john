/**
 * Copyright (c) 2025 yuvia
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { interceptWebpackModuleSystem, WebpackRequire } from "./webpack.ts";

console.log("[john] patcher script loaded");

export interface PatchReplace {
	match: string | RegExp;
	replace: string | ((substring: string, ...args: any[]) => string);
}

export interface Patch {
	query: RegExp | RegExp[];
	patch: PatchReplace | PatchReplace[];
	predicate?: () => boolean;
}

export interface Extension {
	name: string;
	patches?: Patch[];
	start?: () => void;
}

export interface DefinedPatch extends Patch {
	query: RegExp[];
	patch: PatchReplace[];
	done: boolean;
}

export interface DefinedExtension extends Extension {
	patches: DefinedPatch[];
	id: number;
}

export const extensions: DefinedExtension[] = [];

export function defineExtension(pl: Extension) {
	const plugin = pl as DefinedExtension;

	plugin.id = extensions.length;
	plugin.patches ??= [];

	for (const patch of plugin.patches) {
		if (patch.query && !Array.isArray(patch.query)) patch.query = [patch.query];
		if (!Array.isArray(patch.patch)) patch.patch = [patch.patch];
		patch.done = false;
	}

	extensions.push(plugin as any);
}

function repl(
	source: string,
	match: string | RegExp,
	replace: string | ((substring: string, ...args: any[]) => string),
): string {
	if (typeof replace === "string") {
		return source.replace(match, replace);
	} else {
		return source.replace(match, replace);
	}
}

function patch(
	factories: WebpackRequire["m"],
	factoryId: number,
) {
	const factory = factories[factoryId];
	if (!factory || factory.__patched) return;

	let code = Function.prototype.toString.call(factories[factoryId]);
	const patchedBy: string[] = [];

	for (const ext of extensions) {
		for (const patch of ext.patches) {
			if (patch.predicate && !patch.predicate()) continue;
			if (!patch.query) continue;

			if (patch.done) {
				console.warn(`[john] ${ext.name} is patching ${patch.query} again`);
			} else {
				console.trace("[john] initializing ext", ext.name);
			}
			patch.done = true, patchedBy.push(ext.name);

			for (const inner of patch.patch) {
				const before = code;
				code = repl(code, inner.match, inner.replace);
				if (code === before) {
					console.warn(`[john] ${ext.name} failed to patch ${inner.match}`);
				}
			}
		}
		ext.start?.();
	}

	if (!patchedBy.length) return;
	factories[factoryId] = (0, eval)(
		`// Patched by ${[...patchedBy].join(", ")}\n` +
			`0,${code}\n` +
			`//# sourceURL=Webpack-Module/${factoryId}`,
	);
	console.trace(`patched factory ${factoryId}`, [...patchedBy].join(", "));
}

function patchFactories(factories: WebpackRequire["m"]) {
	for (const id in factories) {
		patch(factories, id as unknown as number);
	}
}

interceptWebpackModuleSystem({
	ready(factories) {
		console.log(
			"[john] webpack factories loaded",
			Object.keys(factories).length,
		);
		patchFactories(factories);
	},
	chunkLoad: patchFactories,
});
