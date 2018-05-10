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
  svg : /(<svg)([^<]*|[^>]*)([\s\S]*?)<\/svg>/gm,
  properties : /(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/gm,
};

var PLUGIN_NAME = 'gulp-svg-to-symbols';
var files = {};
var something = {};
var outputFile = null;
var options = {
  name            : 'var templates',
  folderDelimiter : '|',
  removeFileTypes : true,
};
var opener = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0" style="position:absolute; display:none; overflow:hidden !important;">\n';

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
  var name = path.basename(file.path).replace(/(.*)\.[^.]+$/g, '$1').toLowerCase();
  return name;
}

function parseFileContent( file ){
    var contents = file.contents.toString("utf-8");
    var fileName = parseFileName(file);
    var safename = ("icon-" + fileName).replace('icon-icon', 'icon');
    //svgString
    // if( options.minify )
    //     contents = contents.replace( /\s[\r\n ]+/g, '' ) // remove new lines
    //                        .replace(/>\s+</g, "><");     // remove whitespaces between tags
    var content = contents.replace(expressions.svg, '$3').replace(/<!--(.*?)-->/, '').replace(/<\?xml.*?\?>/, '')
    var properties = getProperties(contents.replace(expressions.svg, '$2'));
    var dimensions = getDimensions(properties.viewbox);
    // if ( Object.size(test) > 0 ) {
      // var [all, tag, properties, content] = test;
      var contents = `\n<symbol id="${safename}" viewbox="0 0 ${dimensions.width} ${dimensions.height}">\n  ${content}</symbol>\n`;
      something[fileName] = { "width" : parseInt(dimensions.width, 10), "height" : parseInt(dimensions.height, 10) }

    return contents;
}

function formatXML(xml) {
      const PADDING = ' '.repeat(2); // set desired indent size here
      const reg = /(>)(<)(\/*)/g;
      let pad = 0;

      xml = xml.replace(reg, '$1\r\n$2$3');

      return xml.split('\r\n').map((node, index) => {
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

// Iterates on each file in the stream
function iterateFile( file, enc, callback ){
  outputFile = outputFile || file;
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
/**
 * Push the end result of the files iteration back to the stream
 */
function iterationResult( callback ){
    outputFile = outputFile ? outputFile.clone() : new File();

    // if the user wants to concatenate all the files into one
    if( options.fileName )
        outputFile.path = path.resolve(outputFile.base, options.fileName);

        var sassFile = '$symbols:' + JSON.stringify(something).replace(/"/gm, '').replace(/{/gm, '(').replace(/}/gm, ')').replace(/,/gm, ',\n') + ";";
        fs.writeFileSync('dev/sass/settings/_symbols.scss', sassFile);

    outputFile.contents = new Buffer(
        opener + formatXML(objToString(files)) + '</svg>'
    );

    this.push(outputFile);
    callback();
}

module.exports.getSvgs = function( userOptions ){
    options = Object.assign(options, userOptions);
    return through.obj(iterateFile, iterationResult);
};
