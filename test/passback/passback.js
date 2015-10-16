passback = function (id)
{
	var element = document.getElementById(id);
	var update = function ()
	{
		element.innerHTML = '<center><p>Passback script executed!</p><p>' + Math.random() + '</p></center>';
	};

	setInterval(update, 1000);

	update();

	document.write('<center><p>And document.write works.</p></center>');
};
