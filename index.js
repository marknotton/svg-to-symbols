////////////////////////////////////////////////////////////////////////////////
// Gulp SVG to Symbols
////////////////////////////////////////////////////////////////////////////////

// =============================================================================
// Settings
// =============================================================================

'use strict'

// Requirments
const through   = require('through2'),
      fs        = require('fs'),
      path      = require('path'),
      File      = require('vinyl'),
			boundings = require('svg-boundings'),
			cheerio   = require('cheerio');

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
var validSVGElements = ['path', 'circle', 'line', 'polygon', 'polyline', 'rect', 'ellipse'];

// Configurable Options
var options = {
  prefix   : 'icon',
  sanitise : false,
  exclude  : [],
  scss     : false,
	children : false
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
      "width"    : parseInt(svg.width, 10),
      "height"   : parseInt(svg.height, 10),
    }

		// Only add the svg children if the option is enabled and there if any children actaully exist
		if ( options.children && typeof svg.children !== 'undefined' ) {
			symbols[svg.filename]['children'] = svg.children;
		}

  }

  // If the filename exists in the exclusion array, the don't include it.
  if ( !options.exclude.includes(svg.filename)) {
    svgs.push(svg.symbol);
  }


  callback();
}

function getGroupName(node) {

	let name = 'g'

	// Add ID attribute if it exists
	if (node.attribs['id'] ) {
		name = name + '#' +node.attribs['id']
	}

	// Add Class attribute if it exists
	if (node.attribs['class'] ) {
		name = name + '.' +node.attribs['class']
	}

	return name
}

function containsObject(obj, list) {
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i] === obj) {
            return list[i];
        }
    }

    return false;
}

// =============================================================================
// Manage the final results
// =============================================================================

let svgElements = [];
let groups = [];

function getSVGElements(svg) {

	let total = 0;
	let children = svg.children();

	children.each((index, child) => {
		let $child = cheerio(child),
		tag = child.tagName;

		if ( $child.get(0).parent.tagName == 'g' || $child.get(0).parent.tagName == 'svg' ) {

			let parent = cheerio($child.get(0).parent);

			let parentName = getGroupName(parent.get(0));

			let groupChildren = parent.children();

			let itemIndex = index + 1;

			let groupCount = groupChildren.length;

			let _elementCounts = {};

			groupChildren.each((i, c) => {
				if (validSVGElements.indexOf(c.tagName) !== -1) {
					if ( c.tagName in _elementCounts ) {
						_elementCounts[c.tagName] = _elementCounts[c.tagName] + 1;
						c['index'] = _elementCounts[c.tagName];
					} else {
						_elementCounts[c.tagName] = 1;
						c['index'] = 1;
					}
				}
			})

			$child['group'] = {
				parentName : parentName,
				itemIndex : itemIndex,
				groupCount : groupCount
			}

			// console.log(parentName, 'itemIndex: ' + itemIndex, 'groupIndex: ' + groupIndex, 'groupCount: ' + groupCount, elementCounts)

		}

		if (['style', 'mask', 'clipPath', 'defs'].indexOf(tag) !== -1) {
			return;
		} else if (validSVGElements.indexOf(tag) !== -1) {
			total ++;
			svgElements.push($child);
		}


		// Check child elements
		getSVGElements($child);
	});

	return svgElements
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

	// Add child data for each element
	if ( options.children ) {
		if ( filename == 'logo') {

		// Convert the SVG content into a jQuery-like object
		let svg = cheerio.load(fileContent.trim(), {
			lowerCaseAttributeNames: false,
			xmlMode: true
		})

		// Target the root of the svg
		let root = svg(':root')

		var children = []

		// If the root exists, we know we have a valid SVG file
		if (!root.length || root.get(0).tagName === 'svg') {

			// Gather all the child elements within the SVG if they match the tag types we're after
			let nodes = getSVGElements(root);

			nodes.forEach((node, index) => {

				// Set an empty object ready to be populated with child data
				let child = {}
				let group = node.group || false;

				// Get the bounds data for this node
				let bounds = boundings.shape(node, true);

				// Going forward, we'll only need to get the first item of each node object
				node = node.get(0);

				child = {
					...child,
					left   : bounds.left,
					top    : bounds.top,
					width  : bounds.width,
					height : bounds.height,
					y      : (bounds.top + (bounds.height/2)),
					x      : (bounds.left + (bounds.width/2))
				}

				// Data keys
				let keys = Object.keys(child)

				// Data values rounded down to 2 decimals places and suffixed with the 'px' unit
				let values = Object.values(child).map(item => (Math.round(item * 100) / 100) + 'px')

				// Zip the keys and amended values together
				child = values.reduce((obj, value, index) => ({...obj, [keys[index]]: value}), {})

				// Add ID attribute if it exists
				if ( node.attribs['id'] ) {
					child = {id : node.attribs['id'], ...child}
				}

				// Add Class attribute if it exists
				if ( node.attribs['class'] ) {
					child = {class : node.attribs['class'], ...child}
				}

				// Add element tag type attribute
				if ( node.name ) {
					child = {type : node.name, ...child}
				}


				//
				child = { 'type-index' : node['index'], ...child}

				// Gather Group details
				if ( node.parent.name == 'g') {

					child = {
						group : group.parentName,
						'type-index' : node['index'],
						'group-index' : (group.groupCount - group.groupIndex),
						...child
					}

				}

				children.push(child)

			})

		}

	}
}
  // If the sanitising option is true
  if ( options.sanitise ) {

    // Removing any XML tags and commenting
    data = data.replace(expressions.junk, '')

    // Remove any style tags
    data = data.replace(expressions.style, '')
  }

  // Get the SVG Tag opener and all the attributes within it.
  let svgAttributes = fileContent.replace(expressions.svg, '$2')

  // Run through the attributes and push each property to an array
  let properties = [];
  let match;
  while ((match = expressions.properties.exec(svgAttributes)) != null) {
    properties[match[1].toLowerCase()] = match[2]
  }

  // Pull out the viewbox from the properties array turn into an array
  let coords = properties.viewbox.split(" ")

  // Then set the width and heigh into an array
  let dimensions = {width:coords[2], height:coords[3]}

  // Compile the symbol string
  let symbol = `\n<symbol id="${safename}" viewbox="0 0 ${dimensions.width} ${dimensions.height}">\n\t${beautifySVG(data)}</symbol>`;

	// Clear SVG Elements array
	svgElements = []

  let result = {
    symbol     : symbol,
    width      : dimensions.width,
    height     : dimensions.height,
    id         : safename,
    filename   : filename,
    properties : properties
  }

	// Only add the svg children if the option is enabled and there if any children actaully exist
	if ( options.children && typeof children !== 'undefined' ) {
		result['children'] = children;
	}

  return result;

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
// Beautifiers
// =============================================================================

// SCSS ------------------------------------------------------------------------

function beautifySCSS(data) {
  return data
	.replace(/['"]/gm, '')
  .replace(/{/gm, '(')
  .replace(/}/gm, ')')
	.replace(/group: (.*)/gm, 'group: "$1"')
	.replace(/id: (.*)/gm, 'id: "$1"')
	.replace(/class: (.*)/gm, 'class: "$1"')
	.replace(/,"/gm, '",')
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
