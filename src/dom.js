
var DOM = {
	/*
	** Append content to DOM element and force script nodes re-evaluation.
	*/
	append: function (target, content)
	{
		var evaluate = function (element, complete)
		{
			var iterate;
			var parent;
			var script;
			var source;

			// Script element found, force evaluation
			if (element.nodeName.toUpperCase() === 'SCRIPT' && (!element.type || element.type.toLowerCase() === 'text/javascript') && element.parentNode)
			{
				source = element.text || element.textContent || element.innerHTML || '';
				script = document.createElement('script');
				script.type = 'text/javascript';

				// Asynchronously complete script having an "src" attribute to
				// simulate standard DOM sequential loading
				if (element.src)
				{
					script.onabort = complete;
					script.onerror = complete;
					script.onload = complete;
					script.src = element.src;
				}

				try
				{
					// Standard way to set script source code
					script.appendChild(document.createTextNode(source));
				}
				catch (e)
				{
					// Workaround for IE <= 7
					script.text = source;
				}

				// Swap inactive script node with created one
				parent = element.parentNode;
				parent.removeChild(element);
				parent.appendChild(script);

				// Synchronously complete script without "src" attribute
				if (!element.src)
					complete();
			}

			// Not a script node, recurse on children
			else
			{
				iterate = function (nodes, i)
				{
					if (i < nodes.length)
						evaluate(nodes[i], function () { iterate(nodes, i + 1); });
					else
						complete();
				};

				iterate(element.childNodes, 0);
			}
		};

		// Use innerHTML property to build DOM from string into "source" node
		var source = document.createElement('div');

		source.innerHTML = content;

		// Copy child nodes from source to target and force script re-evaluation
		var replicate = function (source, target, complete)
		{
			var node;

			if (source.childNodes.length > 0)
			{
				node = source.childNodes[0];

				source.removeChild(node);
				target.appendChild(node);

				evaluate(node, function () { replicate(source, target, complete); });
			}
			else
				complete();
		};

		// Capture "document.write" function and start nodes replication
		var write = document.write;

		document.write = function (content) { DOM.append(target, content); };

		replicate(source, target, function ()
		{
			document.write = write;
		});		
	},

	/*
	** Create pixel element and append to given parent.
	*/
	pixel: function (parent, url)
	{
		var img = document.createElement('img');

		img.height = '1px';
		img.width = '1px';
		img.src = url;

		parent.appendChild(img);
	}
};

// Module exports
exports.DOM = DOM;
