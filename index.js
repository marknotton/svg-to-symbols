////////////////////////////////////////////////////////////////////////////////
// Settings
////////////////////////////////////////////////////////////////////////////////

'use strict'

// Dependencies
const through = require('through2'),
fs = require('fs'),
path = require('path'),
File     = require('vinyl');

var expressions = {
  svg        : /(<svg)([^<]*|[^>]*)([\s\S]*?)<\/svg>/gm,
  style      : /(<style)([^<]*|[^>]*)([\s\S]*?)<\/style>/gm,
  properties : /(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/gm,
  junk       : /(<!--(.*?)-->)|(<\?xml.*?\?>)/g,
  extension  : /(.*)\.[^.]+$/g,
};

var files = {};
var symbols = {};
var output = null;
var options = {
  prefix : 'icon',
  sanitise : false,
  styles : false,
  exclude : [],
  scss : false
};

module.exports = settings => {
  options = Object.assign(options, settings);
  return through.obj(iterateFile, iterationResult);
};

////////////////////////////////////////////////////////////////////////////////
// Symbols File
////////////////////////////////////////////////////////////////////////////////

var tags = {
  open  : '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0" style="position:absolute; display:none; overflow:hidden !important;">\n',
  close : '</svg>'
}

/**
* Push the end result of the files iteration back to the stream
*/
function iterationResult( callback ){

  output = output ? output.clone() : new File();

  createSassFile();

  output.contents = new Buffer(
    tags.open + beautifySVG(objToString(files)) + tags.close
  );

  this.push(output);
  callback();
}

////////////////////////////////////////////////////////////////////////////////
// Sass File
////////////////////////////////////////////////////////////////////////////////

function createSassFile() {

  if (symbols !== null && typeof options.scss == 'string' ) {

    var data = JSON.stringify(symbols);

    var map = `$symbols: ${data};`;

    fs.writeFileSync(options.scss, beautifySCSS(map));

  }
}

////////////////////////////////////////////////////////////////////////////////


function getProperties(properties) {
  var props = [];
  var match;
  while ((match = expressions.properties.exec(properties)) != null) {
    props[match[1].toLowerCase()] = match[2];
  }
  return props;
}

function getDimensions(viewbox) {
  var coords = viewbox.split(" ");
  return {width:coords[2], height:coords[3]}
}

function parseFileName( file ){
  var name = path.basename(file.path).replace(expressions.extension, '$1').toLowerCase();
  return name;
}

function parseFileContent( file ){

  var contents = file.contents.toString("utf-8");
  var filename = parseFileName(file);

  var safename = (`${options.prefix}-${filename}`).replace(options.prefix+'-'+options.prefix, options.prefix);

  var content = contents.replace(expressions.svg, '$3').replace(expressions.junk, '')

  if ( options.styles ) {
    content = content.replace(expressions.style, '');
  }

  var properties = getProperties(contents.replace(expressions.svg, '$2'));
  var dimensions = getDimensions(properties.viewbox);

  if ( options.scss !== false ) {
    symbols[filename] = {
      "width" : parseInt(dimensions.width, 10),
      "height" : parseInt(dimensions.height, 10)
    }
  }

  if ( options.exclude.length && options.exclude.includes(filename)) {
    return "";
  }

  return `\n<symbol id="${safename}" viewbox="0 0 ${dimensions.width} ${dimensions.height}">\n  ${content}</symbol>\n`;

}



// Iterates on each file in the stream
function iterateFile( file, enc, callback ){
  output = output || file;
  var fileName = parseFileName(file),
  path = files; // path.relative(file.base, file.path);

  var filePathArr = fileName.split('\\');

  filePathArr.forEach((v, i) => {
    // last part is the file name itself and not a path
    if( i == filePathArr.length - 1 ) {
      path[v] = parseFileContent(file);
    } else if( v in path ) {
      path = path[v];
    } else {
      path = path[v] = {};
    }
  })

  callback();
}


function objToString (obj) {
  var str = '';
  for (var p in obj) {
    if (obj.hasOwnProperty(p)) {
      str += obj[p] + '\n';
    }
  }
  return str;
}


////////////////////////////////////////////////////////////////////////////////
// Private Functions
////////////////////////////////////////////////////////////////////////////////

/**
 * SCSS Beautifier
 */
function beautifySCSS(data) {
  return data.replace(/['"]+/gm, '')
  .replace(/{/gm, '(')
  .replace(/}/gm, ')')
  .replace(/,/gm, ',\n')
  .replace(/[)],/gm, '\n),\n')
  .replace(/[(]/g, '(\n')
  .replace(/[)];/gm, '\n\n);')
}

/**
 * SVG Beautifier
 */
function beautifySVG(data) {
  const PADDING = ' '.repeat(2);
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;

  data = data.replace(reg, '$1\r\n$2$3');

  return data.split('\r\n').map((node, index) => {
    let indent = 0;

    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/) && pad > 0) {
      pad -= 1;
    } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    pad += indent;

    return PADDING.repeat(pad - indent) + node;

  }).join('\r\n').replace(/^(?:[\t ]*(?:\r?\n|\r))+/gm, '');
}
