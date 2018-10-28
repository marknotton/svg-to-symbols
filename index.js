////////////////////////////////////////////////////////////////////////////////
// Gulp SVG to Symbols
////////////////////////////////////////////////////////////////////////////////

// =============================================================================
// Settings
// =============================================================================

'use strict'

// Requirments
const through = require('through2'),
      fs      = require('fs'),
      path    = require('path'),
      File    = require('vinyl');

// Regex Expressions
var expressions = {
  svg        : /(<svg)([^<]*|[^>]*)([\s\S]*?)<\/svg>/gm,
  style      : /(<style)([^<]*|[^>]*)([\s\S]*?)<\/style>/gm,
  properties : /(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/gm,
  junk       : /(<!--(.*?)-->)|(<\?xml.*?\?>)/g,
  extension  : /(.*)\.[^.]+$/g,
};

// Global Variables
var files   = {};
var symbols = {};
var svgs    = [];
var output  = null;

// Configurable Options
var options = {
  prefix   : 'icon',
  sanitise : false,
  exclude  : [],
  scss     : false
};

// Export Module
module.exports = settings => {
  // Merge settings that where passed into module with the default options
  options = Object.assign(options, settings);
  return through.obj(iterate, result);
};

// =============================================================================
// Iterate through files
// =============================================================================

function iterate(file, encoding, callback){
  output = output || file;

  let svg = getSVGData(file);
  let path = files;

  // If the scss option is enabled, start building
  // a associtiation array with each symbol name and it's width and height.
  if ( options.scss !== false && typeof svg.filename !== 'undefined' ) {
    symbols[svg.filename] = {
      "width" : parseInt(svg.width, 10),
      "height" : parseInt(svg.height, 10)
    }
  }

  // If the filename exists in the exclusion array, the don't include it.
  if ( !options.exclude.includes(svg.filename)) {
    svgs.push(svg.symbol);
  }


  callback();
}

// =============================================================================
// Manage the final results
// =============================================================================

function result(callback){

  output = output ? output.clone() : new File();

  if (symbols !== null && typeof options.scss == 'string' ) {

    let data = JSON.stringify(symbols, null, '\t');
    let map = `$symbols: ${data};`;

    fs.writeFileSync(options.scss, beautifySCSS(map));

  }

  let svgData = svgs.join("\n");

  output.contents = new Buffer(
    `<svg id="symbols" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" width="0" height="0" style="position:absolute; display:none; overflow:hidden !important;">\n${svgData}\n\n</svg>`
  );

  this.push(output);

  callback();
}

// =============================================================================
// SVG Data
// =============================================================================

function getSVGData(file){

  let fileContent = file.contents.toString("utf-8");

  // Filename
  let filename = path.basename(file.path).replace(expressions.extension, '$1').toLowerCase();

  // Fix the file name if it is the same as the prefix.
  let safename = (`${options.prefix}-${filename}`).replace(options.prefix+'-'+options.prefix, options.prefix);

  // Return everything inside the SVG Tags
  let data = fileContent.replace(expressions.svg, '$3');

  // If the sanitising option is true
  if ( options.sanitise ) {

    // Removing any XML tags and commenting
    data = data.replace(expressions.junk, '');

    // Remove any style tags
    data = data.replace(expressions.style, '');
  }

  // Get the SVG Tag opener and all the attributes within it.
  let svgAttributes = fileContent.replace(expressions.svg, '$2')

  // Run through the attributes and push each property to an array
  let properties = [];
  let match;
  while ((match = expressions.properties.exec(svgAttributes)) != null) {
    properties[match[1].toLowerCase()] = match[2];
  }

  // Pull out the viewbox from the properties array turn into an array
  let coords = properties.viewbox.split(" ");

  // Then set the width and heigh into an array
  let dimensions = {width:coords[2], height:coords[3]}

  // Compile the symbol string
  let symbol = `\n<symbol id="${safename}" viewbox="0 0 ${dimensions.width} ${dimensions.height}">\n\t${beautifySVG(data)}</symbol>`;

  let result = {
    symbol     : symbol,
    width      : dimensions.width,
    height     : dimensions.height,
    id         : safename,
    filename   : filename,
    properties : properties
  }

  return result;

}

// =============================================================================
// Beautifiers
// =============================================================================

// SCSS ------------------------------------------------------------------------

function beautifySCSS(data) {
  return data.replace(/['"]+/gm, '')
  .replace(/{/gm, '(')
  .replace(/}/gm, ')')
}

// SVG -------------------------------------------------------------------------

function beautifySVG(data) {
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;

  data = data.replace(reg, '$1\r\n$2$3');

  data = data.split('\r\n').map((node, index) => {
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

    return '\t\t'.repeat(pad - indent) + node;

  })

  data = data.join('\r\n').replace(/^(?:[\t ]*(?:\r?\n|\r))+/gm, '');

  return data;
}
