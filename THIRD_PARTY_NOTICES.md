# Third-Party Notices

## cc-safety-net — source of the default deny/ask rule table

The preset rule catalog in `src/preset-rules.ts` (`PRESET_RULES_YAML`, the
`[deny-rule:*]` entries seeded into the live rules document on first
activation) is a port of the rule catalog from **cc-safety-net**:

- Project: <https://github.com/kenryu42/cc-safety-net>
- Files ported: `src/core/rules/destructive.ts` and `src/core/rules/secret.ts`
- Form of the port: the rules were **re-expressed** in this plugin's own
  `permissions` YAML vocabulary (`command` / `argv` / `tools` dimensions, see
  `src/rule.ts`); pattern shapes, tiering and verdicts were re-decided for this
  gate's fail-toward-`ask` philosophy rather than copied verbatim.
- Deviations and coverage gaps are recorded in
  `.agents/plans/compat-cc-safety-net-deny-table/rewrite-target.md`.

cc-safety-net is distributed under the MIT License, reproduced in full below;
its copyright notice is retained here and in the header of
`src/preset-rules.ts`.

```
MIT License

Copyright (c) 2026 J Liew

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
