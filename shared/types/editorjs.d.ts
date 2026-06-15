/**
 * @editorjs/embed ships type declarations but its package.json `exports` map
 * doesn't surface them under Node16/Bundler resolution, so TS can't resolve the
 * implicit type of the default import (issue #12). The tool is passed to
 * Editor.js untyped (`as never`); this shim just silences the implicit-any.
 */
declare module '@editorjs/embed' {
  const Embed: unknown
  export default Embed
}
