/**
		Portrayal.
		Cross browser canvas drawing tool built on jQuery and Raphael.js

**/
(function()
{
	
	// Initialises Portrayal 
    function Portrayal(config)
	{
		try
		{
	    	this.init(config);	     
		}
		catch(e)
		{
	    	throw new Error(e.message);
		}
    }



	// 
    Portrayal.prototype.init = function(config)
	{
		// this will eventually hold all the information from our json file
		// TODO : possibly add yaml <-> json converter
		var jsonData = {};
		
		this.config.init(config);
		
		// This grabs all the data from our json file
		// and populate the jsonData object
		// based on the file specified in this.config.get('config')
		$.ajax(
		{
			url: this.config.get('config'), 
			dataType: 'json', 
			async: false,
			success: function(data, textStatus, jqXHR)
			{
				jsonData = data;
			},
			error: function ()
			{
		    	jsonData = undefined;
			}
		});
		
		// TODO :: Could this test be moved straight into the ajax.error() function?
		if (!jsonData)
	    	throw new Error('failed to fetch ' + this.config.get('config'));

		// jsonData.view holds the canvas dom-element configuration 
		this.view.init(jsonData.view);

		// Initialise the canvas using Raphael 
		this.canvas = Raphael(
			document.getElementById( this.config.get('htmlElementId' ), 
			this.view.box.width, 
			this.view.box.height)
		);
		
		// Symbols are our image objects TODO check this with Oli
		this.symbols.init( jsonData.symbols );	

		// Set up the layers, pass in the current portrayal object 
		// and the list of layers from the config json
		this.layers.init( this, jsonData.layers );
		
		// Setup the widgets
		this.widgets = jsonData.widgets;
    };
	
	
	
	// Gets, Sets and holds our portrayal configuration
    Portrayal.prototype.config = {
		items: {
	    	"image_dir": 'images/',
	    	"config": '',
	    	"lang": 'en',
	    	"htmlElementId": '',
	    	"ur": ''
		},
		
		init: function(config)
		{
	    	for (var key in config)
				this.set(key, config[key]);
		},
		
		get: function(key)
		{
	    	if (this.items[key] === undefined)
				throw new Error($config[key] + ' configuration item does not exist');
	    	else
				return this.items[key];
		},
		
		set: function(key, value)
		{
	    	if (this.items[key] === undefined)
				throw new Error($items[key] + ' is not a valid configuration option');
	    	else
				this.items[key] = value;
		}
    };



	// 
    Portrayal.prototype.state = {
		active: {
	    	layer: null,
	    	symbol: {
				layer: undefined,
				id: undefined
	    	}
		}
    }


	


	/* 
	 Zooming happens on every element within every layer where the 'scale' property is set to true
	 ++ whenever the zoom is called by the canvas's attached event handlers ++
	 therefore you need to put elements that are to zoom on a layer with other zooming items
	*/
    Portrayal.prototype.zoom = function(args)
	{
		// TODO center the zoom around where the mouse was clicked rather than the centre of the box (if thats the case, check with Oli??)
		var centre   = this.view.box.centre();      // Centre tells us around which point to zoom
		var i        = this.layers.layer.length;
	
		// The range checking on the value is handled by the slider.
		this.view.zoom.previous  = this.view.zoom.value;
		this.view.zoom.value     = args.value;
		
		// Loop through all the layers, as set in the config file.  
		while (i--)
		{
	    	// If so then check that our layer has been set to allow scaling, if not, skip zooming on this layer
			// TODO combine this logic into one query (check with Oli)
			if (this.layers.layer[i].properties.scale === undefined)
				continue;
	    	if (this.layers.layer[i].properties.scale == false)
				continue;
	    	
			// Figure out how many elements are displayed on this layer
	    	var ii = this.layers.layer[i].elements.length;
			
			// Loop through each element of the layer
	    	while (ii--)
			{
	        	// 
				if (this.layers.layer[i].elements[ii].portrayal !== undefined)
				{
		    		// If portrayal property is set, then check if 
					if (this.layers.layer[i].elements[ii].portrayal.properties !== undefined)
					{
						
						if ( ! this.layers.layer[i].elements[ii].portrayal.properties.scale)
						{
			    			translateWithScale(
								this.layers.layer[i].elements[ii], 
								centre, 
								args.value,
					       		this.view.zoom.previous
							);
			    			continue;
						}
		    		}
				}

				this.layers.layer[i].elements[ii].scale(
					this.view.zoom.value, 
					this.view.zoom.value, 
					centre.x, 
					centre.y
				);
	    	}
		} // End the loop through layers
		
		// 
		if ("centre" in args)
		{
	    	delta = getDelta(centre, args.centre);
	    	this.layers.translate(delta.x, delta.y);
		}
    };





    Portrayal.prototype.scroll = function(point)
	{
		var offset = this.view.scroll.offset(this, point, this.view.scroll.lastMousePoint);

		if (offset.x || offset.y) 
		{
	    	this.layers.translate(offset.x, offset.y);
	    	this.view.scroll.lastMousePoint = point;
		}
    };





	// View object defines the canvas dom element 
	// within the portrayal system  
    Portrayal.prototype.view = {
		// Define canvas dimensions in the view object
		init: function(view) 
		{
	    	this.box.x      = view.box.x;
	    	this.box.y      = view.box.y;
	    	this.box.width  = view.box.width;
	    	this.box.height = view.box.height;
	    	this.zoom.min   = view.zoom.min;
	    	this.zoom.max   = view.zoom.max;
	    	this.zoom.step  = view.zoom.step;
		},
		
		// Define the width, height, and center vector of the canvas
		box: {
	    	x: 0,
	    	y: 0,
	    	width: 0,
	    	height: 0,
	    	centre: function()
			{
				return { x: this.x + (this.width * 0.5), y: this.y + (this.height * 0.5) };
	    	}
		},
		
		// Defines scrolling parameters
		scroll: {
			// Store this so we can gauge how far the cursor has moved
	    	lastMousePoint: { x: 0, y: 0 },
	    	isActive: false,
			// Figures out how far the cursor moved while mouse is pressed
	    	offset: function(that, p1, p2)
			{
				var offset = { x: 0, y: 0 };
				// Operate on both the x and y cursor points
				for (var prop in offset)
				{
		    		if (p1[prop] > (p2[prop] + 1))
						offset[prop] = 10 * that.view.zoom.value;
		    		else if (p1[prop] < (p2[prop] - 1))
						offset[prop] = -(10 * that.view.zoom.value);
		    		else
						offset[prop] = 0;
				}
				
				return offset;
	    	}
		},
		
		// Defines zoom and defaults 
		zoom: {
	    	value: 1,
	    	min: 0,
	    	max: 0,
	    	step: 0
		}
    };

    
	/*
		Layers contains the functionality 
		methods :
			init()
			translate()
			display()
			getById()
	*/
    Portrayal.prototype.layers = {
		//Populated by init, used like this.layers.layer[i]
		layer: [],
		
		// Places all the information about layer items defined in the 
		// config file into an array we can query elsewhere in the script
		// this.layers.init is called by Portrayal.init()
		init: function(that, layers)
		{	    
	    	// layers is the a json object holding layers data defined in the config
			for(var i = 0, len = layers.length; i < len; i++)
			{
				// Each layer (defined in json) from our config becomes an object held in the this.layers.layer array
				this.layer[i] = {
					id: layers[i].id,
					properties: layers[i].properties,
					elements: []
				};
				
				// Also need to loop through all the elements defined within each layer
				// and put 'em into this.layers.layer[i].elements[ii]
				for (var ii = 0, elmLen = layers[i].elements.length; ii < elmLen; ii++)
				{
			    	/* Each element on a layer has a type
						- image   - a png file
						- set     - a set means that the element is made up of other elements, each in turn with their own type, 
								    useful for defining vector graphics
						- path    - used to define complex vector graphics, these can be output by vector editing software such as illustrator
						- rect    - simple canvas rectangle 
						- symbol  - TODO :: Oli define what symbols are
						- text    - used for holding data for text elements, 
					*/
					var type = layers[i].elements[ii].type;
					
					// the create[type]() function generates a raphael object
					// containg all data about each element
			    	this.layer[i].elements[ii] = that.element.create[type](
					{
						that: that,
						element: layers[i].elements[ii],
						layer_id: layers[i].id
					});
				}
			}
		},
	
	
		
		translate: function(dx, dy)
		{
	    	var i = this.layer.length;
	  
	    	while (i--)
			{ 
				if (this.layer[i].properties.scroll === undefined || this.layer[i].properties.scroll == false)
		    		continue;

				var ii = this.layer[i].elements.length;		

				while (ii--)
		    		this.layer[i].elements[ii].translate(dx, dy);	
	    	}
		},
		
		
		display: function(props)
		{
	    	var i = this.layer.length;

	    	while (i--)
			{
				var found = false;
		
				for (var prop in props)
				{
		    		var ii = props[prop].length;
		
		    		while (ii--)
					{
						if (props[prop][ii] != this.layer[i].id)
			    			continue;

						found = true;

						var iii = this.layer[i].elements.length;

						while (iii--)
			    			this.layer[i].elements[iii][prop]();
		    		}

		    		if (found)
						break;
				}
	    	}
		},
		
		
		getById: function(id)
		{
	    	var i = this.layer.length;

	    	while (i--)
				if (this.layer[i].id == id)
		    		return this.layer[i];

	    	return undefined;
		}
    };


	
    Portrayal.prototype.symbols = {
		symbol: [],
		
		init: function(symbols)
		{
	    	var i = symbols.length;

	    	while(i--)
				this.symbol[i] = {
					id: symbols[i].id, 
					elements: symbols[i].elements,
				  	properties: symbols[i].properties
				};
		},
		
		create: function(args)
		{
	    	var i = args.that.symbols.symbol.length;
	    
	    	while(i--)
			{
				if (args.that.symbols.symbol[i].id == args.element.attributes.id)
				{

		    		var elm = args.that.canvas.set();
					
		    		for (ii = 0, len = args.that.symbols.symbol[i].elements.length; ii < len; ii++)
					{
						var element          = args.that.symbols.symbol[i].elements[ii];

						element.id           = args.element.id;
						element.properties   = args.element.properties;
						element.info         = args.element.info;

						var elm              = args.that.element.create[element.type](
						{
							that: args.that,
							element: element,
							layer_id: args.layer_id
						});
		    		}
		
		    		return elm.translate(args.element.attributes.x, args.element.attributes.y);
				}
            }

	    	throw new Error('The symbol ' + id + ' does not exist');
		},
		
		
		toggleImage: function(elm)
		{
	    	// This is a horride work around due to lack of time.
	    	var image   = elm.attrs.src.replace(/.png/, '');
	    	var type    = '.png';
	    	var src     = "";

	    	if (image.match(/_sel/))
				src = image.replace(/_sel/, '') + type;
	    	else
				src = image + '_sel' + type;

	    	elm.attr({"src": src});
		}
    };
	
	
    Portrayal.prototype.element = {

    	setProperties: function(args)
		{
			return {
				id: args.element.id, 
				parent_id: args.parent_id || undefined,
				layer_id: args.layer_id,
				properties: args.element.properties,
				info: args.element.info || {}
			};
    	},
    
    	create: {
			// 
			set: function(args)
			{
	    		// Stores an object-like array of a set of elements
				// http://raphaeljs.com/reference.html#Paper.set
				var elm = args.that.canvas.set();
				
				
	    		for (var i = 0, len = args.element.elements.length; i < len; i++)
				{
					elm.push(
						args.that.element.create[ args.element.elements[i].type ](
						{ 
								that: args.that, 
								element: args.element.elements[i], 
								layer_id: args.layer_id, 
								parent_id: args.element.id
						})
					);
				}

	    		if (args.element.attributes !== undefined)
					if (args.element.attributes.translate !== undefined)
		    			elm.translate(args.element.attributes.translate.x, args.element.attributes.translate.y);

	    		elm.portrayal = args.that.element.setProperties(args);

	    		return elm;
			},
			
			image: function(args)
			{
	    		elm = args.that.canvas.image(
					args.that.config.get('image_dir') + args.element.attributes.src, 
					args.element.attributes.x, 
					args.element.attributes.y, 
					args.element.attributes.w, 
					args.element.attributes.h
				);
				
	    		elm.portrayal = args.that.element.setProperties(args);
	
	    		return elm;
			},
			
			
			
			path: function(args)
			{
	    		elm = args.that.canvas.path(args.element.attributes.path).attr(args.element.attributes);
	
	    		elm.attr(args.element.attributes);
	
	    		elm.portrayal = args.that.element.setProperties(args);
	
	    		return elm;
			},
			
			
			rect: function(args)
			{
	    		elm = args.that.canvas.rect(
					args.element.attributes.x, 
					args.element.attributes.y, 
					args.element.attributes.w, 
					args.element.attributes.h
				);
				
	    		elm.attr(args.element.attributes);
	
	    		elm.portrayal = args.that.element.setProperties(args);
	
	    		return elm;
			},
			
			circle: function(args)
			{
	    		elm = args.that.canvas.circle(
					args.element.attributes.x, args.element.attributes.y, 
					 args.element.attributes.r
				).attr(args.element.attributes);
				
	    		elm.attr(args.element.attributes);	  
	  
	    		elm.portrayal = args.that.element.setProperties(args);
	
	    		return elm;
			},
			
			
			text: function(args)
			{
	    		if (args.element.text[args.that.config.get('lang')] === undefined)
					throw new Error("The language '" + args.that.config.get('lang') + "' is unsupported");

	    		elm = args.that.canvas.text(
					args.element.attributes.x, args.element.attributes.y, 
					args.element.text[args.that.config.get('lang')]
				);
				
	    		elm.attr(args.element.attributes);
		    
	    		elm.portrayal = args.that.element.setProperties(args);
	
	    		return elm;
			},
			
			
			symbol: function(args)
			{
	    		return args.that.symbols.create(args);
			}
    	},

    	setEvent: function(element, events)
		{
			for(var event in events)
			{
	    		if(element.type == "set")
				{
					var ii = element.items.length;
					
					while (ii--)
		    			( $( element.items[ii].node )[event]( events[event] ) );
	    		}
				else
				{
					( $( element.node )[event]( events[event] ) );
	    		}
			}
    	},

    	getById: function(id, layers, layerId)
		{
			var layer = layers.getById(layerId);

			if (layer === undefined)
	    		throw new Error('The Layer ' + layerId + ' does not exist.');

			var i = layer.elements.length;

			while (i--)
	    		if( layer.elements[i].portrayal.id == id )
					return layer.elements[i];

			return undefined;
    	}
	};
	
	
	
	

    Portrayal.prototype.setAttrById = function(elm, id, attr)
	{
		if(elm.type == "set")
		{
	    	var i = elm.items.length;
	    	while (i--)
				if (elm.items[i].portrayal.id == id)
				{
		    		elm.items[i].attr(attr);
		    		break;
				}
		}
		else
		{
	    	if (elm.portrayal.id == id)
			elm.attr(attr);
		}
    };




    Portrayal.prototype.setEvent = function(element, event)
	{
		this.element.setEvent(element, event);
    };



	//          Calculating functions		
	/*

	*/
    function getDelta(p1, p2)
	{
		return { 
			x: (p1.x == p2.x) ? 0 : (p1.x - p2.x),
			y: (p1.y == p2.y) ? 0 : (p1.y - p2.y)
		};
    }


	/*
		
	*/
    function getCentre(x, y, w, h)
	{
		return {
			x: x + (w * 0.5),
			y: y + (h * 0.5)
		};
    }


	/*
		
	*/
    function scaleVector(v, scale)
	{
		return {
			x: v.x * scale,
			y: v.y * scale
		};
    }

	/*
		
	*/
    function getVector(p1, p2)
	{
		return {
			x: p1.x - p2.x,
			y: p1.y - p2.y
		};
    }

	/*
		
	*/
    function addVector(v1, v2)
	{
		return {
			x: v1.x + v2.x,
			y: v1.y + v2.y
		};
    }


	/*
		
	*/
    function translateWithScale(element, centre, scale, previous)
	{
        kx        = Math.abs(scale / previous);

		var v1    = { 
						x: element.getBBox().x, 
						y: element.getBBox().y
					};

		var v2    = getVector(v1, centre);
		
		var v2    = scaleVector(v2, kx);

		v2        = addVector(v2, centre);

		var delta = getDelta(v2, v1);
	
		element.translate(delta.x, delta.y);
    };


	/*  */
	window.Portrayal = Portrayal;
})();
