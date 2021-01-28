'use strict';

const path = require('path');

exports.type = 'full';

exports.active = true;

exports.description = 'Formats svgs for symbol intergration';

exports.fn = function(item, params) {

  if ( params.file ) {

    let fileName = path.parse(params.file.path).name
    let options  = params.options
    let element  = item.content[0]

    // Only add the prefix if it doesn't exits in the file name
    if ( (fileName + '-').indexOf(options.prefix, 0) !== 0 ) {
      fileName = options.prefix + fileName
    }

    if (options.symbolIdAttr && typeof options.symbolIdAttr === 'function') {
      fileName = options.symbolIdAttr(fileName)
    } else {
      fileName = fileName.toLowerCase()
                .replace(/[^a-zA-Z0-9]/g, ' ')       // Replace any special characters with a space
                .replace(/^([0-9]+)(.*)/gm, `$2-$1`) // Move any numbers from the start of the string to the end
                .replace(/\s+/g, '-')                // Replace each space with a hyphen
                .replace(/\-\-+/g, '-')              // Remove all duplicate hyphen with just a singular hyphen
                .replace(/^-+|-+$/g, '')             // Trim additionals hyphens from the start and end
    }

    // Change the <svg> to a <symbol> tag
    element.elem = 'symbol'

    // Remove class attributes on the parent element
    if ( options.removeClassAttr ) {
      element.removeAttr('class')
    }

    // Remove the ID and replace it so they all sit at the same place in the <symbol> tag
    element.removeAttr('id')
    // addAttr method doesn't work, so this is the workaround
    element.attrs.id = { 
      name: 'id',
      value: fileName,
    }

    // Because we're manipulating the filename to generate an id, there may
    // be cases where the filename could be a purposeful value for query selection
    if ( options.addOriginalFilenameAttrToSymbols ) {
      element.addAttr({ 
        name: 'data-filename',
        value: path.parse(params.file.path).name,
        prefix: '',
        local: 'class'
      })
    }
  }

  return item

}
