////////////////////////////////////////////////////////////////////////////////
// Gulp SVG to Symbols
////////////////////////////////////////////////////////////////////////////////

// This is essentialy a fork of gulp-contact with svgo intigrations 

// =============================================================================
// Settings
// =============================================================================

'use strict'

const { Transform }  = require('stream')
const Svgo           = require('svgo')
const path           = require('path')
const File           = require('vinyl')
const Concat         = require('concat-with-sourcemaps')
const Symbol         = require('./symbol')
const defaultOptions = {
	/** 
	 * @param {function} symbolIdAttr Defaults to filename 
	 * Can be also function with the original filename as a callback param
	 * @example symbolIdAttr : (filename) => { return filename + '-foo-bar }
	 */
	removeClassAttr : true, 
	prefix  : 'icon-',
	containerId : 'symbols',
	containerAttributes : {
		'xmlns'       : 'http://www.w3.org/2000/svg',
		'aria'        : { 'hidden' : 'true' },
		'width'       : "0",
		'height'      : "0",
		'style' : {
			'position' : 'absolute', 
			'display'  : 'none', 
			'overflow' : 'hidden !important',
		}
	},
	/**
	 * Passing in SVG Plugin properties must be done as a flattened object, 
	 * unlike the native method described in their documentation. 
	 * I didn't feel an array of objects with singular booleans was necessary. 
	 * You can still pass individual plugin settings as values. 
	 * @see https://ourcodeworld.com/articles/read/659/how-to-decrease-shrink-svg-file-size-with-svgo-in-nodejs
	 * @see https://github.com/svg/svgo
	 */
	svgo : {
		plugins : [
			{ removeXMLNS : true },
			{ cleanupIDs  : false },
			{ sortAttrs   : true }
		]
	}
}
let options  = {}


/**
 * Adds multiple attributes values to a HTML tag
 * @param {string} html <svg>  
 * @param {object} attributes 
 */

function setAttributes(html, attributes) {

	for (const [key, value] of Object.entries(attributes)) {
		if ( typeof(value) === 'string' ) {
			html = html.replace('>', ` ${key}="${value}">`)
		}
		if ( typeof(value) === 'object' ) {
			if ( key === 'style' ) {
				let declarations = ""
				for (const [nestedKey, nestedValue] of Object.entries(value)) {
					declarations = `${declarations} ${nestedKey}:${nestedValue};`
				}
				html = html.replace('>', ` ${key}="${declarations.trim()}">`)
			} else {
				for (const [nestedKey, nestedValue] of Object.entries(value)) {
					html = html.replace('>', ` ${key}-${nestedKey}="${nestedValue}">`)					
				}
			}
		}
	}

	return html

}

/**
 * Wrap Content in an <svg> tag along with data attributes supplied in the optns 
 * @param {String} content 
 * @param {Object} options 
 */
function wrapContent(content) {

	if ( options.containerId ) {
		options.containerAttributes = Object.assign({'id': options.containerId}, options.containerAttributes);
	}

	let container = setAttributes('<svg>', options.containerAttributes)

	return Buffer.from(`${container}\n${content}\n</svg>`);
}

/**
 * @see https://stackoverflow.com/a/48218209
 * @param  {...any} objects 
 */
function mergeDeep(...objects) {
  const isObject = obj => obj && typeof obj === 'object';
  
  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach(key => {

      const pVal = prev[key];
      const oVal = obj[key];
      
      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      }
      else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      }
      else {
				prev[key] = oVal;
      }
    });
    
    return prev;
  }, {});
}

// file can be a vinyl file object or a string
// when a string it will construct a new one
module.exports = function(file, opt = {}) {

  if (!file) {
    throw new Error('svg-to-symbols: Missing file option');
	}
	
  // to preserve existing |undefined| behaviour and to introduce |newLine: ""| for binaries
  if (typeof opt.newLine !== 'string') {
    opt.newLine = '\n';
  }

	// Merge default settings and any settings passed in directly
	options = {...defaultOptions, ...opt }

	if ( options.svgo.plugins ) {
		options.svgo = mergeDeep(defaultOptions.svgo, options.svgo)
	}

	const stream = new Transform({objectMode: true})

	var isUsingSourceMaps = false;
  var latestFile;
  var latestMod;
  var fileName;
  var concat;
	
  if (typeof file === 'string') {
    fileName = file;
  } else if (typeof file.path === 'string') {
    fileName = path.basename(file.path);
  } else {
    throw new Error('svg-to-symbols: Missing path in file options');
  }

	/**
	 * Stream Buffer -------------------------------------------------------------
	 * gulp-concat bufferContents method converted to nodes native stream _transform method
	 */

  stream._transform = function(file, enc, cb) {

		/**
		* Because the file needs to be passed into each instance of the svgo class, we
		* have to instantiate the class for every file in the transforms/buffer method
		*/

		let symbol = Symbol
		symbol.params = { file, options }
		options.svgo.plugins.push({ symbol : symbol	})

    // ignore empty files
    if (file.isNull()) {
      cb();
      return;
    }

    // we don't do streams (yet)
    if (file.isStream()) {
      this.emit('error', new Error('svg-to-symbols: Streaming not supported'));
      cb();
      return;
		}
		
    // set latest file if not already set,
    // or if the current file was modified more recently.
    if (!latestMod || file.stat && file.stat.mtime > latestMod) {
			latestFile = file;
      latestMod = file.stat && file.stat.mtime;
		}
		
    // construct concat instance
    if (!concat) {
      concat = new Concat(isUsingSourceMaps, fileName, opt.newLine);
    }

		new Svgo(options.svgo).optimize(String(file.contents)).then(result => {
			concat.add(file.relative, result.data, false);
		}, error => {
			throw new Error('svg-to-symbols: ' + path.parse(file.path).name + ' : ' +  error)
		})

		cb();
	}
	

	/**
	 * Stream Flush --------------------------------------------------------------
	 * gulp-concat endStream method converted to nodes native stream _flush method
	 */

  stream._flush = function(cb) {
    // no files passed in, no file goes out
    if (!latestFile || !concat) {
      cb();
      return;
    }

    var joinedFile;

    // if file opt was a file path
    // clone everything from the latest file
    if (typeof file === 'string') {
      joinedFile = latestFile.clone({contents: false});
      joinedFile.path = path.join(latestFile.base, file);
    } else {
      joinedFile = new File(file);
    }

    joinedFile.contents = wrapContent(concat.content);

    if (concat.sourceMapping) {
      joinedFile.sourceMap = JSON.parse(concat.sourceMap);
    }

    this.push(joinedFile);
    cb();
  }

	return stream;

};
