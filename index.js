////////////////////////////////////////////////////////////////////////////////
// Settings
////////////////////////////////////////////////////////////////////////////////

'use strict'

// Dependencies
const through = require('through2'),
      fs = require('fs'),
      path = require('path');

module.exports.getSvgs = getSvgs;

////////////////////////////////////////////////////////////////////////////////
// Functions
////////////////////////////////////////////////////////////////////////////////

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

var expressions = {
  svg : /(<svg)([^<]*|[^>]*)([\s\S]*?)<\/svg>/gm,
  properties : /(\S+)=["']?((?:.(?!["']?\s+(?:\S+)=|[>"']))+.)["']?/gm,
};

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};
var opener = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="0" height="0" style="position:absolute; display:none; overflow:hidden !important;">';
function getId(file) {
   return path.basename(file.path).replace(/(.*)\.[^.]+$/g, '$1').toLowerCase();
}

function getSvgs(options) {
  // Not necessary to accept options but nice in case you add them later
  options = options || {};
  var firstFile = true;
  var counter = 0;
  // through2.obj(fn) is a convenience wrapper around through2({ objectMode: true }, fn)
  //
  //
  var stream = through.obj(function (file, enc, callback) {
    counter ++;
    if (!firstFile) {
      firstFile = false;

    }

    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      this.emit('error', new Error('Streaming not supported'));
      return callback();
    }

    if (file.isBuffer()) {

      var svgString = file.contents.toString();

      // var test = expressions.svg.exec(svgString);
      // var tag = svgString.replace(expressions.svg, '$1')
      var content = svgString.replace(expressions.svg, '$3').replace(/<!--(.*?)-->/, '').replace(/<\?xml.*?\?>/, '')
      // if ( Object.size(test) > 0 ) {
        var name = getId(file);
        // var [all, tag, properties, content] = test;
        var properties = getProperties(svgString.replace(expressions.svg, '$2'));
        var dimensions = getDimensions(properties.viewbox);


        var symbol = `${firstFile ? opener : ''}
<symbol id="${properties.id || getId(file)}" viewbox="0 0 ${dimensions.width} ${dimensions.height}">
  ${content}</symbol>
   `;

        file.contents = new Buffer(formatXML(symbol), "utf8");

        this.push(file);


      // } else {
        // console.log(svgString)
      // }



      callback();

    }

      firstFile = false;

  });
  console.log(counter);



 return stream;
};
