/**
 * API Documentation Generator
 *
 * Generates TypeScript API documentation for npm packages.
 * Uses esm.sh to resolve package types, which handles @types/* packages automatically.
 * Uses @deno/doc (WASM build of deno_doc) for documentation generation.
 *
 * @module server/utils/docs
 */

import type { DocsGenerationResult } from '#shared/types/deno-doc'
import { getDocNodes } from './client'
import { buildSymbolLookup, flattenNamespaces, mergeOverloads } from './processing'
<<<<<<< Updated upstream
import { renderDocNodes, renderGroupedDocNodes, renderGroupedToc, renderToc } from './render'
import { computeEntryPrefixes } from './text'
=======
import { renderDocNodes, renderGroupedDocNodes, renderGroupedToc, renderModuleDoc, renderToc } from './render'
import { entrySlug } from './text'
>>>>>>> Stashed changes
import type { ProcessedEntry } from './types'

/**
 * Generate API documentation for an npm package.
 *
 * Uses @deno/doc (WASM build of deno_doc) with esm.sh URLs to extract
 * TypeScript type information and JSDoc comments, then renders them as HTML.
 *
 * @param packageName - The npm package name (e.g., "react", "@types/lodash")
 * @param version - The package version (e.g., "19.2.3")
 * @returns Generated documentation or null if no types are available
 *
 * @example
 * ```ts
 * const docs = await generateDocsWithDeno('ufo', '1.5.0')
 * if (docs) {
 *   console.log(docs.html)
 * }
 * ```
 */
export async function generateDocsWithDeno(
  packageName: string,
  version: string,
): Promise<DocsGenerationResult | null> {
  // Get doc nodes (grouped by entry point) using @deno/doc WASM
  const result = await getDocNodes(packageName, version)

  if (result.entries.length === 0) {
    return null
  }

  const entries = result.entries
    .map(entry => {
      const flattenedNodes = flattenNamespaces(entry.nodes)
      // The module-level doc (`@module`) is an intro for the whole entry, not a
      // symbol, pull it out so it renders once at the top instead of being
      // dropped as an unknown kind.
      const moduleDoc = flattenedNodes.find(node => node.kind === 'moduleDoc')?.jsDoc
      const symbolNodes = flattenedNodes.filter(node => node.kind !== 'moduleDoc')
      return {
        entryPoint: entry.entryPoint,
        nodes: symbolNodes,
        symbols: mergeOverloads(symbolNodes),
        moduleDoc,
      }
    })
    .filter(entry => entry.symbols.length > 0 || Boolean(entry.moduleDoc))

  if (entries.length === 0) {
    return null
  }

  const isMultiEntry = entries.length > 1

  // Anchor IDs are only prefixed when multiple entry points share a page. Prefixes
  // are computed as a set so lossy slugs can't collide (see computeEntryPrefixes);
  // the root entry is never prefixed, so a package that also ships a root export
  // keeps clean root IDs while namespacing submodules.
  const prefixes = isMultiEntry
    ? computeEntryPrefixes(entries.map(entry => entry.entryPoint))
    : null

  const processed: ProcessedEntry[] = entries.map(entry => {
    const prefix = prefixes?.get(entry.entryPoint) ?? ''
    return {
      entryPoint: entry.entryPoint,
      prefix,
      nodes: entry.nodes,
      symbols: entry.symbols,
      lookup: buildSymbolLookup(entry.nodes, prefix),
      moduleDoc: entry.moduleDoc,
    }
  })

  const allNodes = processed.flatMap(entry => entry.nodes)

  if (!isMultiEntry) {
    const entry = processed[0]!
    const [moduleDoc, body] = await Promise.all([
      renderModuleDoc(entry.moduleDoc, entry.lookup),
      renderDocNodes(entry.symbols, entry.lookup),
    ])
    const html = [moduleDoc, body].filter(Boolean).join('\n')
    const toc = renderToc(entry.symbols)
    return { html, toc, nodes: allNodes }
  }

  // Render HTML and TOC from pre-computed merged symbols
  const html = await renderGroupedDocNodes(processed)
  const toc = renderGroupedToc(processed)

  return { html, toc, nodes: allNodes }
}
