
var DOM = {
	html: function (node, content, complete)
	{
		var evaluate = function (node, complete)
		{
			var parent;
			var recurse;
			var script;
			var source;

			// Script node found, force evaluation
			if (node.nodeName.toUpperCase() === 'SCRIPT' && (!node.type || node.type.toLowerCase() === 'text/javascript') && node.parentNode)
			{
				source = node.text || node.textContent || node.innerHTML || '';
				script = document.createElement('script');
				script.type = 'text/javascript';

				// Asynchronously complete script having an "src" attribute to
				// simulate standard DOM sequential loading
				if (node.src)
				{
					script.onabort = complete;
					script.onerror = complete;
					script.onload = complete;
					script.src = node.src;
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
				parent = node.parentNode;
				parent.removeChild(node);
				parent.appendChild(script);

				// Synchronously complete script without "src" attribute
				if (!node.src)
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

			recurse(node.childNodes, 0);
		};

		node.innerHTML = content;

		evaluate(node, complete || function () {});

		return node;
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
