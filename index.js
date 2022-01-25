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
			cheerio   = require('cheerio').default;

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
var validSVGElements = ['path', 'circle', 'line', 'polygon', 'polyline', 'rect', 'ellipse', 'use'];

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
      "width"    : parseInt(svg.width, 10) + 'px',
      "height"   : parseInt(svg.height, 10) + 'px',
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

// =============================================================================
// Get a legibal node name using any given data attrbutes
// =============================================================================

function getNodeName(node) {

	let name = node.tagName

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

// =============================================================================
// Recrusive function to check how many levels of group there are in a given node
// =============================================================================

let groupDepth = 1;
let groupTarget = '';

function getGroupDepth(node) {
	if ( node.parent.tagName == 'g') {
		groupDepth ++
		getGroupDepth(node.parent)
	}
	return groupDepth
}

function getGroupTargets(node) {
	let name = getNodeName(node);
	if ( name !== '' && name !== node.parent.tagName) {
		groupTarget = groupTarget + ' ' + name + ' '
	} else {
		groupTarget = `${groupTarget} g:nth-of-type(${groupDepth}) `
	}
}

// =============================================================================
// Manage the final results
// =============================================================================

let svgElements  = [];
let groupCounter = 0;

function getSVGElements(svg) {

	svg.children().each((index, child) => {

		let $child    = cheerio(child);
		let $parent   = $child.get(0).parent;
		let _counters = {};

		// Gather data relative to the childs parent if it's a group or the root 'svg' tag.
		if ( $parent.tagName == 'g' || $parent.tagName == 'svg' ) {

			// Incriment the group counter
			if ( $parent.tagName == 'g' ) {

				if ( child.tagName != 'g' && groupCounter > 0) {

					// TODO: managed nested groups and their tagets
					// let depth = getGroupDepth($parent);
					// $child['depth'] = depth;
					// // groupTarget = `${groupTarget} g:nth-of-type(${groupCounter})`;
					// //
					// getGroupTargets($parent);
					// //
					// console.log(groupCounter, depth, groupTarget.replace('  ', ' ').trim())
					// // // groupCounter = groupDepth - groupCounter;
					// groupDepth = 1;
					// groupTarget = '';
				}

				if (!('index' in $parent)) {
					groupCounter ++
					$parent['index'] = groupCounter;
				}

			}

			// Run through each child of the parent
			cheerio($parent).children().each((i, c) => {
				// If the child matches a valid SVG element type
				if (validSVGElements.indexOf(c.tagName) !== -1) {
					// Add a incirmental variable for each tag type
					if ( c.tagName in _counters ) {
						_counters[c.tagName] = _counters[c.tagName] + 1;
					} else {
						_counters[c.tagName] = 1;
					}
					// Add that index directly to the child for later use.
					c['index'] = _counters[c.tagName];
				}
			})

		}

		if (['style', 'mask', 'clipPath', 'defs'].indexOf(child.tagName) !== -1) {
			return;
		} else if (validSVGElements.indexOf(child.tagName) !== -1) {
			svgElements.push($child);
		}

		// Check child elements
		getSVGElements($child);
	});


	return svgElements
}

function getSVGChildData(fileContent) {

	// Convert the SVG content into a jQuery-like object
	let $ = cheerio.load(fileContent.trim(), {
		lowerCaseAttributeNames: false,
		xmlMode: true
	})

	// Target the root of the svg
	let svg = $(':root')

	var children = []

	// If the root exists, we know we have a valid SVG file
	if (!svg.length || svg.get(0).tagName === 'svg') {

		// Gather all the child elements within the SVG if they match the tag types we're after
		let nodes = getSVGElements(svg);

		nodes.forEach((node, index) => {

			// Set an empty object ready to be populated with child data
			let depth = node.depth || false;

			let element = node.get(0);

			let name = getNodeName(element);

			// Add the type and index after the other elements have had units added
			let child = {
				type   : element['name'],
				index  : element['index']
			}

			if (element.tagName == 'use') {
			 	node = $(element.attribs.href);
				if ( name == 'use' ) {
					name = 'use[href=' + element.attribs.href + ']';
				}
				element = node.get(0);
				child['type'] = 'use';
			}

			// Get the bounds data for this node
			let bounds = boundings.shape(node, true);


			let units = {
				left   : bounds.left,
				top    : bounds.top,
				width  : bounds.width,
				height : bounds.height,
				y      : (bounds.top + (bounds.height/2)),
				x      : (bounds.left + (bounds.width/2))
			}

			// Data keys
			let keys = Object.keys(units)

			// Data values rounded down to 2 decimals places and suffixed with the 'px' unit
			let values = Object.values(units).map(item => (Math.round(item * 100) / 100) + 'px')

			// Zip the keys and amended values together
			units = values.reduce((obj, value, index) => ({...obj, [keys[index]]: value}), {})

			child = { ...child, ...units };

			// Add the node name if it has any unique attrbutes like a class or id
			// if ( name !== '' && name !== node.tagName) {
			// 	child = { name : name, ...child }
			// }


			// -----------------------------------------------------------------------
			// Use all the data gathered to render a usable target
			// -----------------------------------------------------------------------

			let target = '';

			// Add Group details
			if ( element.parent.name == 'g') {

				if ( depth > 1) {
					target = 'g '.repeat(depth - 1)
				}

				let parentName = getNodeName(element.parent);

				child = { 'group' : element.parent['index'],	...child}

				// Add the node name if it has any unique attrbutes like a class or id
				if ( parentName !== '' && parentName !== element.parent.tagName) {
					target = target + parentName + ' '
				} else {
					target = `${target}g:nth-of-type(${element.parent['index']}) `
				}

			}

			if ( name !== '' && name !== element.tagName) {
				target = target + name;
			} else {
				target = `${target} ${element['name']}:nth-of-type(${element['index']})`;
			}

			child = { 'target' : target.replace('  ', ' ').trim(),	...child}
			// console.log(target.replace('  ', ' '));

			children.push(child)

		})

	}

	return children;


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

	// Reset the group counter
	groupCounter = 0;


  let result = {
    symbol     : symbol,
    width      : dimensions.width,
    height     : dimensions.height,
    id         : safename,
    filename   : filename,
    properties : properties
  }

	// Only add the svg children if the option is enabled and there if any children actaully exist
	if ( options.children ) {
		let children = getSVGChildData(fileContent);
		if ( children ) {	result['children'] = children }
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
	.replace(/target: (.*)/gm, "target: '$1'")
	.replace(/href=(.*)/gm, 'href="$1"')
	.replace(/,'/gm, "',")
	.replace(/]',"/gm, "\"]',")
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
