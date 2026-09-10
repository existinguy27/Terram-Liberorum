import { n as __exportAll, t as createComponent } from "./compiler_BBqjyzTe.mjs";
import { b as createAstro, d as renderHead, f as addAttribute, l as renderTemplate } from "./server_DzBc2ZSr.mjs";
//#region src/pages/index.astro
var pages_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => ""
});
createAstro("https://astro.build");
var $$Index = createComponent(($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Index;
	return renderTemplate`<html lang="en"><head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" href="/favicon.ico"><meta name="viewport" content="width=device-width"><meta name="generator"${addAttribute(Astro.generator, "content")}><title>Terram Liberorum</title>${renderHead($$result)}</head><body class="min-h-screen flex items-center justify-center bg-gray-900 text-white font-sans"><div class="text-center"><h1 class="text-5xl md:text-7xl font-bold mb-4">Terram Liberorum</h1><p class="text-xl md:text-2xl text-gray-300">Coming Soon</p></div></body></html>`;
}, "C:/Terram Liberorum Website/Terram-Liberorum/src/pages/index.astro", void 0);
var $$file = "C:/Terram Liberorum Website/Terram-Liberorum/src/pages/index.astro";
//#endregion
//#region \0virtual:astro:page:src/pages/index@_@astro
var page = () => pages_exports;
//#endregion
export { page };
