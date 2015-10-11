
var DOM = {
	create: function (parent, type)
	{
		var element;

		element = document.createElement(type);
		parent.appendChild(element);

		return element;
	},

	html: function (element, content, complete)
	{
		var evaluate = function (element, complete)
		{
			var parent;
			var recurse;
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

				return;
			}

			// Not a script node, browse children
			recurse = function (nodes, i)
			{
				if (i < nodes.length)
					evaluate(nodes[i], function () { recurse(nodes, i + 1); });
				else
					complete();
			};

			recurse(element.childNodes, 0);
		};

		element.innerHTML = content;

		evaluate(element, complete || function () {});

		return element;
	},

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
