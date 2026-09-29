# Arabic review changes reverted to Hebrew parity (29.09.26)

The translation commit `87af0c3` carried a few non-text changes made during the
Arabic review. The rule for this unit is: learner-visible text in Arabic,
functionality and layout identical to the Hebrew `methodica-math-ratio-02`.
These changes were therefore reverted, each in its own commit so that any one
can be brought back with a single `git revert <sha>`.

| # | What | Revert commit | Status |
|---|------|---------------|--------|
| 1 | Hint pills in part 01, s16 and s29 | `f968385` | **reverted** — to restore: `git revert f968385` |
| 2 | Bottom-bar hint / answers-toggle positions (shared CSS) | `4532c36` | **restored** in `f3a5e0f` (the Hebrew values do not fit the Arabic labels, see §2) |

## 1. Hint pills in part 01 (s16, s29)

`methodica-ar-math-ratio-02-01/index.html`, the `s16-hint-overlay` and
`s29-hint-overlay` popups. The Hebrew hint is plain text; the review wrapped
part of it in the green/red `keep-badge` pills used by the answer cards.

Why reverted: parity with Hebrew. The green "يحافظ على النسبة" pill in the s16
hint also looks like the correct answer card, so it may give the answer away.

As shipped by the review (s16):
```html
<p>تحققوا من الطريقة التي تغيّرت بها النسبة؟ هل يتعلق الأمر بتغيير <span class="keep-badge keep-badge--yes">يحافظ على النسبة</span>؟</p>
```
Now:
```html
<p>تحققوا من الطريقة التي تغيّرت بها النسبة؟ هل يتعلق الأمر بتغيير يحافظ على النسبة؟</p>
```

As shipped by the review (s29):
```html
<p>… هل التغيير يحافظ / <span class="keep-badge keep-badge--no">لا يحافظ على النسبة</span>؟</p>
```
Now:
```html
<p>… هل التغيير يحافظ / لا يحافظ على النسبة؟</p>
```

## 2. Bottom-bar positions (`unit-css/styles.css`)

The review swapped the hint pill and the "answers" toggle in the bottom bar and
let the hint-close button grow. Shared by all five parts.

| Rule | Review value (now) | Hebrew value |
|------|--------------------|--------------|
| `.scq-hint` | `left: 245px` | `left: 180px` |
| `.answers-toggle` | `left: 185px` | `left: 336px` |
| `.scq-hint-close` | `min-width: 196px` + `display:flex; align-items:center; justify-content:center` | `width: 196px` |

Reverted in `4532c36` for parity, then **restored in `f3a5e0f`** after the browser check
(29.09.26, part 03 s22, app scaled 0.8, px as rendered):

| State | Hebrew CSS | Review CSS |
|---|---|---|
| Before answering: check button `هل إجابتي صحيحة؟` 19–209 | hint pill 144–304 covers most of it (only `ابتي صحيحة؟` shows; a click there hits the hint) | hint 196–356, check fully visible |
| After answering: `متابعة` 19–131 + answers toggle | toggle 269–421, clear | toggle 148–300, clear |
| Hint popup close `العودة إلى السؤال` | 216px of text in a fixed 196px button — overflows | button 256px, fits |

The Arabic labels are wider than `צדקתי?` / `אפשר רמז?` / `חזרה לשאלה`, so the Hebrew
positions cannot hold them. The layout differs from Hebrew only in these three rules;
`unit-css/styles.css` is otherwise identical to the Hebrew unit's (plus comment slugs).

Note for the Arabic review: the check button starts as `هل كنت على حق?` (34 places in the
five `index.html`, with a Latin `?`) and `unit-js/main.js:229` / `:953` reset it to
`هل إجابتي صحيحة؟` on retry / re-entry. In Hebrew both are `צדקתי?`. One wording should be chosen;
the positions above were measured with the longer one.
