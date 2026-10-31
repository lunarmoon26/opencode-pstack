# Third-party sources

- **Pstack**, Lauren Tan, MIT. Original source `cursor/plugins`, commit
  `c742dd61706fbacc1b95f1a20b7b988cf096ce6c`, version 0.15.36.
  Verbatim inputs and license are in `vendor/pstack/`.
- **Cursor Team Kit**, Cursor, MIT, at the same commit. Only `deslop`,
  `control-cli`, and `control-ui` are imported. License and inputs are in
  `vendor/cursor-team-kit/`.
- **OpenCode translation and builder**, Darpan Kakadia, MIT.
  `kakadiadarpan/pstack-opencode` commit
  `35f8dfc8da3f0c3f075653d4124ef46e808b14b8`. `port/` is imported unchanged
  except for the additional license file; `scripts/build.ts` is adapted.
  `port/LICENSE` preserves the original notice. Generated assets retain
  the upstream licenses in `dist/licenses/`.

The Falentio port was inspected for native tool registration and testing
approaches, not copied. No affiliation with or endorsement by Cursor,
Lauren Tan, OpenCode, or the maintainers of other ports is implied.
