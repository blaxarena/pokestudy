# Hangul Writer 1.0.1 (vendored)

Source: https://github.com/mirodn/hangul-writer
Package: https://registry.npmjs.org/hangul-writer/-/hangul-writer-1.0.1.tgz
License: MIT; see LICENSE for David Chanin and Miro copyright notices.

The package archive was verified against its npm metadata SHA-512 integrity:
`sha512-X5shwALAW8KCLXrfzwe5bNqmYOVLnm9E3SCKLpfAdfZwqIt/W4SeBusM5oGFkGSiJHh6NbwF02hRZjaGyL3xUw==`

`index.esm.js` is the unmodified package distribution. The app uses its local
`loadCharacterData` API only, for the bundled jamo data and generated syllables.
It does not enable the upstream handwriting quiz or send handwriting elsewhere.
No runtime CDN or remote character-data requests are required.

The upstream data supports 51 compatibility jamo and 11,172 modern Hangul
syllables. Syllable layouts are generated from jamo; they are educational
shapes, not exact copies of the app's original typeface. Conventions vary:
ㅈ and ㅊ use the print forms (3 and 4 strokes). See UPSTREAM-README.md.
