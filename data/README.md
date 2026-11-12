# TOCFL vocabulary data

This dataset was imported from the user's `8000zhuyin_202409 (1).zip` attachment, workbook dated 2024-09-23. It contains the seven proficiency sheets (Novice 1 through Level 5), preserving each term, tone-marked Pinyin, part of speech, and the topic context where supplied.

The workbook's proficiency sheets contain 7,517 non-empty vocabulary entries. It does not include English definitions, so `english` is returned as an empty string by the API rather than being inferred.

`/api/vocab/packs?pack=N` serves 100 entries per pack, with the final pack containing the remaining entries.
