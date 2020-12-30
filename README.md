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
	    symbolIdAttr : (filename) => { return filename + '-foo-bar },
		removeClassAttr : true,
		prefix : 'icon-',
		containerId : 'symbols',
		svgo : { 
			plugins : [ 
				{ removeXMLNS : false }
			]
		}
    };

    return gulp.src('/assets/images/**/*.svg')
    .pipe(svgToSymbols('symbols.svg', options))
    .pipe(gulp.dest(images))

});
```

## Options

| Setting | Type | Default | Description |
|--|--|--|--|
| symbolIdAttr | function | *filename* | Excluding this option will add the svg filename as the symbol ID. Otherway a function with the file name passed into the callback function will be instantiated instead. This is to give you better control of the symbol references. Suited for those who favour BEM convenstions.  |
| removeClassAttr | bool | true | Removes the class attribute on all symbol parent elements | 
| prefix | string | icon- | All symbol element ID's will be prefixed with this string. 
| containerId | string | 'symbols' | ID added to the `<svg>` that wraps all the symbols  | 
| containerAttributes | object| | HTML attributes that get added to the `<svg>` that wraps all the symbols.   Nested objects will be prefixed with the parent key name. `{ data : { foo : bar }}` will be `<svg data-foo="bar">` style being the exception and is handled to behave as expected for CSS| 
| svgo | Object | | Pass in any options that Svgo natively supports to fully customise your output. By default *svg-to-syboles* has altered Svgos' default options so that **removeXMLNS** is `true`, **cleanupIDs** is `false`, and **sortAttrs** is `true`. Everthing else is the same. [See here for formatting guidelines](https://ourcodeworld.com/articles/read/659/how-to-decrease-shrink-svg-file-size-with-svgo-in-nodejs) and [go here for more information on Svgo plugins](https://github.com/svg/svgo)| 