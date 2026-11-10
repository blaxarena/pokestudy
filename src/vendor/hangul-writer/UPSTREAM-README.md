Hangul Writer
=====================

[![CI](https://github.com/mirodn/hangul-writer/actions/workflows/ci.yml/badge.svg)](https://github.com/mirodn/hangul-writer/actions/workflows/ci.yml)
[![Codecov](https://img.shields.io/codecov/c/github/mirodn/hangul-writer/master.svg)](https://codecov.io/gh/mirodn/hangul-writer)
[![npm](https://img.shields.io/npm/v/hangul-writer.svg)](https://www.npmjs.com/package/hangul-writer)

Hangul Writer is a free and open-source JavaScript library for Korean Hangul stroke order animations and handwriting practice quizzes. Learners draw a character stroke by stroke and get immediate feedback on each stroke, including wrong stroke order and strokes drawn in the wrong direction.

It supports all 51 Hangul jamo and all 11,172 precomposed syllables (가–힣).

> **Built on Hanzi Writer.** Hangul Writer is a fork of [Hanzi Writer](https://github.com/chanind/hanzi-writer) by [David Chanin](https://github.com/chanind), and almost all of it is his work: rendering (SVG and canvas), stroke animations, the quiz flow and the stroke recognition that judges each drawn stroke. Hangul Writer adds the Korean part on top: Hangul stroke data, syllable composition and the Hangul demo. Thank you, David, for building Hanzi Writer and sharing it under an open license. If you find this project useful, please also star [Hanzi Writer](https://github.com/chanind/hanzi-writer).

## Demo

Build the library, then open `demo/index.html` in a browser:

```
yarn install
yarn build
open demo/index.html
```

Type any jamo or syllable into the input to animate it or practise writing it.

## Usage

```js
import HangulWriter from 'hangul-writer';

const writer = HangulWriter.create('target', '한', {
  width: 300,
  height: 300,
  padding: 10,
});

// play the stroke order animation
writer.animateCharacter();

// or let the user draw the character
writer.quiz({
  onCorrectStroke: (data) => console.log(`Stroke ${data.strokeNum + 1} correct`),
  onMistake: (data) => console.log(data.isBackwards ? 'Wrong direction' : 'Try again'),
  onComplete: (summary) => console.log(`Done with ${summary.totalMistakes} mistakes`),
});
```

Without a bundler, include `dist/hangul-writer.min.js` with a `<script>` tag; it defines a global `HangulWriter`.

Character data is bundled, so no network requests are made.

## Supported characters

| Group | Characters |
|---|---|
| Basic consonants | ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ |
| Basic vowels | ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ |
| Double consonants | ㄲ ㄸ ㅃ ㅆ ㅉ |
| Compound vowels | ㅐ ㅒ ㅔ ㅖ ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ |
| Consonant clusters | ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ |
| Syllables | all 11,172 from 가 to 힣, composed automatically |

Jamo use the Hangul Compatibility Jamo block (U+3130–U+318F), which is what Korean keyboards produce.

## How the character data works

Each character is a list of strokes in writing order. Every stroke has an SVG outline, used for rendering, and a median: its centreline, used for animation and stroke recognition. Coordinates live in a 1024-unit box (x 0 to 1024, y −124 to 900) with the y axis pointing up.

- **Jamo** (`src/hangul/data/`) are authored as medians only. `buildCharacterData` generates outlines of even width from them. Double consonants and clusters are built from the single consonants, so changing ㄱ also changes ㄲ and ㄳ.
- **Syllables** (`src/hangul/syllable.ts`) are split into initial, vowel and optional final, and those jamo are fitted into a block layout chosen by the vowel's shape: the initial goes to the left of the vowel (가), above it (고), or above and to the left (과), with the final below (각). Stroke order follows the standard order: initial, vowel, final.

To load your own data, pass a `charDataLoader` option, just as in Hanzi Writer.

### Adding or adjusting a jamo

1. Create or edit the jamo's module in `src/hangul/data/`, listing each stroke's median in writing order.
2. Register it in `src/hangul/data/index.ts`.
3. Run `yarn test`. Every stroke of every jamo is checked automatically: it must be recognised when drawn correctly or a little imprecisely, flagged when drawn backwards, and not confused with the character's other strokes.

## Limitations

- Syllable layouts are generated, not hand-tuned. They're clearly legible, but not as refined as a real typeface. For example, the ㄱ in 가 is scaled to fit rather than redrawn to suit the vowel.
- Stroke width varies between syllables: crowded blocks get thinner strokes.
- Stroke order follows common teaching practice. Where conventions differ, ㅈ and ㅊ use the print form (a bar with ㅅ beneath, in 3 and 4 strokes), and ㅎ follows [hangeul-stroke-order](https://github.com/MagisterAdamus/hangeul-stroke-order).

## Contributing

Pull requests are welcome. This project uses [Yarn 1](https://classic.yarnpkg.com/) (`npx yarn@1` works if it isn't installed):

```
yarn install
yarn test        # run tests
yarn build       # build into dist/
yarn lint-test   # lint
yarn typecheck   # type-check
```

## Releasing

Releases are automated with [semantic-release](https://github.com/semantic-release/semantic-release) and published to npm through [Trusted Publishing](https://docs.npmjs.com/trusted-publishers), so no npm token is stored anywhere. Every push to `master` that passes CI is released, and commit messages decide the version:

| Commit | Release |
|---|---|
| `fix: …` | patch (1.0.0 → 1.0.1) |
| `feat: …` | minor (1.0.0 → 1.1.0) |
| a `BREAKING CHANGE:` footer in the commit message | major (1.0.0 → 2.0.0) |

Other types, such as `docs:`, `ci:` or `chore:`, don't trigger a release.

Publishing needs a trusted publisher for this repository and the `ci.yml` workflow, set up in the package's settings on npmjs.com. It also needs the repository variable `RELEASE_ENABLED` set to `true` under Settings → Secrets and variables → Actions → Variables.

## License

Hangul Writer is released under the [MIT](LICENSE) license.

It's based on [Hanzi Writer](https://github.com/chanind/hanzi-writer) by David Chanin, also MIT licensed. All Hangul character data in this repository was created for this project. Stroke orders were cross-checked against [hangeul-stroke-order](https://github.com/MagisterAdamus/hangeul-stroke-order) by Adam Stone (CC BY-SA 4.0); none of its images or shapes are included.
