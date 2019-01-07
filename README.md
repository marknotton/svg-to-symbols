# SVG to Symbols

![Made For NPM](https://img.shields.io/badge/Made%20for-NPM-orange.svg) ![Made For Gulp](https://img.shields.io/badge/Made%20for-Gulp-red.svg)

Compile a source of SVG images into one single file, with all files sanitised and refactored to be used as symbols.

## Installation
```
npm i @marknotton/svg-to-symbols --save-dev
```
```js
const symbols = require('@marknotton/svg-to-symbols');
```

## Usage

```js

gulp.task('symbols', () => {

    let options = {
      prefix   : 'icon',
      exclude  : ['facebook', 'twitter'],
      scss     : '/src/sass/_symbols.scss',
      sanitise : true
    };

    return gulp.src('/assets/images/**/*.svg')
    .pipe(symbols(options))
    .pipe(concat('symbols.svg'))
    .pipe(gulp.dest(images))

});
```

## Options

| Setting | Type | Default | Description |
|--|--|--|--|
| prefix | string | icon | All symbol element ID's will be prefixed with this string. A hyphen will be used to separate the prefix and the filename to create a valid ID name. If the prefix name matches an actual filename, then no prefix will be applied.
| exclude | array | null | There may be cases (particularly with complex SVG's) where you don't want to include a SVG image into the symbols file. An array of SVG filenames will be ignored (no need to include the file extension). This does not effect the sass map.
| scss | string/bool | false | Define a path and filename to store a file which contains a Sass map for each symbol. The map will contain the symbol names, height and width. This can come in handy when you need to calculate the original aspect ratios of each symbol.
| sanitise | bool | true | Removes any inline style tags, XML tags and commenting from the symbols. Unless your SVG elements are very cleanly coded, you may find many files contain potentially conflicting CSS styling directly in the file. If you need to retain the styling of a symbol, it's recommended you do this elsewhere (like a global .css file).
| children | bool | false | Enabling this will include useful data of each child element from the svg into the scss map file. This nested map item will log the element type (path, circle, polyline... ), left and top positions, height and width, the x and y co-ordinates of the centre, and class and id names. Additionally, if the child is wrapped in a group `<g>...</g>` a reference name which includes an ID or/and Class attributes concatenated together. 
