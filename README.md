
# SVG to Symbols

![Made For NPM](https://img.shields.io/badge/Made%20for-NPM-orange.svg) ![Made For Gulp](https://img.shields.io/badge/Made%20for-Gulp-red.svg)

Congatinate a source of SVG images into one single file, with all files sanitised using [Svgo](https://github.com/svg/svgo) and refactored to `<symbol>` elements.

## Installation
```
npm i @marknotton/svg-to-symbols --save-dev
```
```js
const svgToSymbols = require('@marknotton/svg-to-symbols');
```

## Usage

```js

gulp.task('symbols', () => {

  let options = {
    symbolIdAttr : (filename) => { return filename + '-foo-bar' },
    removeClassAttr : true,
    prefix : 'icon-',
    containerId : 'symbols',
    svgo : { 
      plugins : [ 
        { removeXMLNS : false }
      ]
    }
  };

  return gulp.src('/assets/images/**/!(symbols)*.svg')
  .pipe(svgToSymbols('symbols.svg', options))
  .pipe(gulp.dest('/assets/images'))

});
```

## Options

| Setting | Type | Default | Description |
|--|--|--|--|
| symbolIdAttr | function | *filename* | Excluding this option will add the svg filename as the symbol ID. Otherway a function with the file name passed into the callback function will be instantiated instead. This is to give you better control of the symbol references. Suited for those who favour BEM convenstions.  |
| removeClassAttr | bool | true | Removes the class attribute on all symbol parent elements | 
| prefix | string | icon- | All symbol element ID's will be prefixed with this string. 
| containerId | string | 'symbols' | ID added to the `<svg>` that wraps all the symbols  | 
| addOriginalFilenameAttrToSymbols | bool | true | Because we're manipulating the filename to generate an id attribute, there may be cases where the filename could be a purposeful value for query selections |
| containerAttributes | object| | HTML attributes that get added to the `<svg>` that wraps all the symbols.   Nested objects will be prefixed with the parent key name. `{ data : { foo : bar }}` will be `<svg data-foo="bar">`. **style** being the exception and is handled to behave as expected for CSS| 
| svgo | Object | | Pass in any options that Svgo natively supports to fully customise your output. By default *svg-to-syboles* has altered Svgos' default options so that **removeXMLNS** is `true`, **cleanupIDs** is `false`, and **sortAttrs** is `true`. Everthing else is the same. [See here for formatting guidelines](https://ourcodeworld.com/articles/read/659/how-to-decrease-shrink-svg-file-size-with-svgo-in-nodejs) and [go here for more information on Svgo plugins](https://github.com/svg/svgo)| 

## Example

```html
<svg id="symbols" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="0" height="0" style="position:absolute; display:none; overflow:hidden !important;">
  <symbol viewBox="0 0 170.4 85.9" id="icon-arrow-down" data-filename="arrow-down"><path fill="none" d="M170.1.4L85.2 85.2.4.4"/></symbol>
  <symbol viewBox="0 0 85.9 170.4" id="icon-arrow-left" data-filename="arrow-left"><path fill="none" d="M85.6 170.1L.7 85.2 85.6.4"/></symbol>
  <symbol viewBox="0 0 85.9 170.4" id="icon-arrow-right" data-filename="arrow-right"><path fill="none" d="M.4.4l84.8 84.8L.4 170.1"/></symbol>
  <symbol viewBox="0 0 170.4 85.9" id="icon-arrow-up" data-filename="arrow-up"><path fill="none" d="M.4 85.6L85.2.7l84.9 84.9"/></symbol>
</svg>
```