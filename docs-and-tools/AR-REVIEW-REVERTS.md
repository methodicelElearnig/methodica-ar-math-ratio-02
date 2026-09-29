# Arabic review changes reverted to Hebrew parity (29.09.26)

The translation commit `87af0c3` carried a few non-text changes made during the
Arabic review. The rule for this unit is: learner-visible text in Arabic,
functionality and layout identical to the Hebrew `methodica-math-ratio-02`.
These changes were therefore reverted, each in its own commit so that any one
can be brought back with a single `git revert <sha>`.

| # | What | Revert commit | To restore |
|---|------|---------------|------------|
| 1 | Hint pills in part 01, s16 and s29 | `f968385` | `git revert f968385` |
| 2 | Bottom-bar hint / answers-toggle positions (shared CSS) | `4532c36` | `git revert 4532c36` |

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

| Rule | Review value | Hebrew value (now) |
|------|--------------|--------------------|
| `.scq-hint` | `left: 245px` | `left: 180px` |
| `.answers-toggle` | `left: 185px` | `left: 336px` |
| `.scq-hint-close` | `min-width: 196px` + `display:flex; align-items:center; justify-content:center` | `width: 196px` |

Why reverted: parity with Hebrew layout. If the Arabic labels turn out not to fit
the Hebrew positions in the browser check, restore this commit rather than
re-editing by hand.

After this revert `unit-css/styles.css` is byte-identical to the Hebrew unit's.
