# A1–B1 TOCFL vocabulary data

This dataset comes from the user's `8000zhuyin_202409 (1).zip` attachment, workbook dated 2024-09-23. It includes the workbook's TOCFL Level 1 (A1), Level 2 (A2), and Level 3 (B1) sheets only. Novice 1 and Novice 2 are below A1 and are excluded; Levels 4 and 5 are beyond B1 and are excluded.

The data preserves 2,005 vocabulary entries with Traditional Chinese terms, tone-marked Pinyin, parts of speech, and the topic context supplied for Levels 1 and 2. The source workbook does not provide English definitions, so the API returns an empty `english` field rather than inventing translations.

`/api/vocab/packs?pack=N` serves 15 entries per pack: 134 packs total, with 10 entries in the final pack.
