var fileContents = "";

$(document).ready(function () {
	$( "#frm_options" ).submit(function( event ) {
		event.preventDefault();
		if (fileContents != "") {
			load_dataset(fileContents);
		}
	});

	$( "#uploader" ).change( function( ev )
	{
		var uploader = document.getElementById("uploader");  
		
		var reader = new FileReader();
		
		d3.select(".loading").text("loading...");
		
		reader.onload = function(e) { fileContents = e.target.result; d3.select(".loading").text("file load sucessful!"); };
		reader.onerror = function(e) { fileContents = ""; d3.select(".loading").text("error loading file!"); };

		var file = this.files[0];
		reader.readAsText(file);
	});
});

var CONTENTS = ".contents";
var THREAD = ".thread";
var USER = "h1";
var MSG = ".message"

function load_dataset(arg) {

	var discountEmoticons = document.getElementById("discountEmoticons").checked;
	var discountCommon = document.getElementById("discountCommon").checked;
	//discountEmoticons = true;
	//discountCommon = true;

	html = $.parseHTML( arg );    //Raw HTML from file. Returns an array

	data = html[4];               //Just the useful content

	var threadLengths = [];

	var threads = data.querySelectorAll(THREAD);

	var numthreads = threads.length;

	var username = data.querySelectorAll(USER)[0].childNodes[0].nodeValue;

	var recipents = {};
	
	var max = 0;

	for (i = 0; i < numthreads; i++) { 
		var threadName = threads[i].childNodes[0].nodeValue;

		var people = threadName.split(", ");
		
		var messages = threads[i].querySelectorAll(MSG);
		
		var threadLength = messages.length;
		
		//don't need my own name in the title
		var me = people.indexOf(username);
		if (me > -1 && people.length > 1) {
			people.splice(me, 1);
		}
		
		var title = people.sort().join(", ");
		
		//have we seen this thread title before?
		var oldCount = 0;
		var oldWords = {};
		if (recipents.hasOwnProperty(title)) {
			oldCount = recipents[title].count;
			oldWords = recipents[title].words;
		}
		else {
			recipents[title] = {};
		}
		
		//do word count
		for (var w = 0; w < threadLength; w++) {
			var msg = messages[w].nextElementSibling.innerHTML;
			wordsInMsg = msg.split(" ");
			for (wrd in wordsInMsg) {
				var word = wordsInMsg[wrd];
				
				word = word.toLowerCase();
				
				//discount emoticons
				if (discountEmoticons) {
					if (!(word.match(/^[^\w\d]/) == null)) {
						continue;
					}
				}
				
				//remove trailing punctuation
				word = word.replace(/^[^\w\d]+/,"");
				word = word.replace(/[^\w\d]+$/,"");
				
				//discount common words
				if (discountCommon) {
					if (stopList.hasOwnProperty(word))
					{
						continue;
					}
				}
				
				if (oldWords.hasOwnProperty(word)) {
					oldWords[word] = oldWords[word] + 1;
				}
				else {
					oldWords[word] = 1;
				}
			}
		}
		
		var newCount = oldCount + threadLength;
		//store new values for this title
		recipents[title].count = newCount;
		recipents[title].words = oldWords;
		
		if (newCount > max) {
			max = newCount;
		}
	}
	
	var threadTitles = Object.keys(recipents);

//this belongs in css
	var outerWidth = 1500;
	var outerHeight = 2000;
	var barPadding = 0.2;
	var margin = { left: 160, top: 20, right: 20, bottom: 30 };
	var innerWidth = outerWidth - margin.left - margin.right;
	var innerHeight = outerHeight - margin.top - margin.bottom;

	$("svg").remove();
	
	var svg = d3.select("#container").append("svg")
		.attr("width","100%")
		.attr("height",outerHeight);

	var g = svg.append("g")
		.attr("transform","translate(" + margin.left + "," + margin.top + ")");

	var xAxisG = g.append("g");
	var yAxisG = g.append("g");


	var xscale = d3.scale.linear()
		.domain([0,max])
		.range([0,100]);

	var yscale = d3.scale.ordinal()
		.rangeRoundBands([0, outerHeight],barPadding)
		.domain(threadTitles);

	var yAxis = d3.svg.axis()
		.scale(yscale)
		.orient("left");

	yAxisG.call(yAxis)
		.attr("class", "y axis");

	g.selectAll(".bar")
		.data(threadTitles)
		.enter().append("rect")
		.attr("class", "bar")
		.attr("height", yscale.rangeBand())
		.attr("width",function(d){ return xscale(recipents[d].count) + "%"; })
		.attr("x",0)
		.attr("y",function(d) { return yscale(d); })
		.on("mouseover", function(d,i) {
			var toolTipText = recipents[d].count + " messages, top 20 words:<br />";
			var wordList = getSortedKeys(recipents[d].words);
			for (var i = 0; i < 40 && i < wordList.length; i++)
			{
				var escapedWord = escapeHtml(wordList[i][1] + " - " + wordList[i][0]);
				toolTipText = toolTipText + escapedWord + "<br />";
			}
			
			showToolTip(toolTipText,d3.mouse(this)[0]+200,d3.mouse(this)[1]+150,true);
		})
		.on("mousemove", function(d,i) {
			tooltipDivID.css({top:d3.mouse(this)[1]+150,left:d3.mouse(this)[0]+200});
		})	
		.on("mouseout", function() {
			showToolTip("",0,0,false);
		});

	d3.select("#sorter").on("change", change);

	var sortTimeout = setTimeout(function() {
		d3.select("#sorter").property("checked", true).each(change);
	}, 2000);

	// http://bl.ocks.org/mbostock/3885705
	function change() {
		clearTimeout(sortTimeout);

		// Copy-on-write since tweens are evaluated after a delay.
		var y0 = yscale.domain(threadTitles.sort(this.checked
			? function(a, b) { return recipents[b].count - recipents[a].count; }
			: function(a, b) { return d3.ascending(a, b); })
			.map(function(d) { return d; }))
			.copy();

		svg.selectAll(".bar")
			.sort(function(a, b) { return y0(a) - y0(b); });

		var transition = svg.transition().duration(750),
			delay = function(d, i) { return i * 50; };

		transition.selectAll(".bar")
			.delay(delay)
			.attr("y", function(d) { return y0(d); });

		transition.select(".y.axis")
			.call(yAxis)
			.selectAll("g")
			.delay(delay);
	};

	//http://stackoverflow.com/questions/5199901/how-to-sort-an-associative-array-by-its-values-in-javascript
	function getSortedKeys(obj) {
		var keys = []; 
		for(var key in obj) {
			keys.push([key, obj[key]]);
		}
		return keys.sort(function(a,b){
			return obj[b[0]]-obj[a[0]];
		});
	};
	
	
	function showToolTip(pMessage,pX,pY,pShow) {
		if (typeof(tooltipDivID)=="undefined")
		{
			tooltipDivID =$('<div id="messageToolTipDiv" style="position:absolute;display:block;z-index:10000;border:2px solid black;background-color:rgba(0,0,0,0.8);margin:auto;padding:3px 5px 3px 5px;color:white;font-size:12px;font-family:arial;border-radius: 5px;vertical-align: middle;text-align: center;min-width:50px;overflow:auto;"></div>');
			$('body').append(tooltipDivID);
		}
		if (!pShow) { 
			tooltipDivID.hide(); 
		}
		else {
			tooltipDivID.html(pMessage);
			tooltipDivID.css({top:pY,left:pX});
			tooltipDivID.show();
		}
	};
	
	//https://github.com/janl/mustache.js/blob/master/mustache.js#L82
	var entityMap = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': '&quot;',
		"'": '&#39;',
		"/": '&#x2F;'
	};

	function escapeHtml(string) {
		return String(string).replace(/[&<>"'\/]/g, function (s) {
			return entityMap[s];
		});
	};
}

//http://tagcrowd.com/languages/English
	var stopList = {};
	stopList["january"] = 1; stopList["february"] = 1; stopList["march"] = 1; stopList["april"] = 1; stopList["may"] = 1; stopList["june"] = 1; stopList["july"] = 1; stopList["august"] = 1; stopList["september"] = 1; stopList["october"] = 1; stopList["november"] = 1; stopList["december"] = 1; stopList["monday"] = 1; stopList["tuesday"] = 1; stopList["wednesday"] = 1; stopList["thursday"] = 1; stopList["friday"] = 1; stopList["saturday"] = 1; stopList["a"] = 1; stopList["b"] = 1; stopList["c"] = 1; stopList["d"] = 1; stopList["e"] = 1; stopList["f"] = 1; stopList["g"] = 1; stopList["h"] = 1; stopList["i"] = 1; stopList["j"] = 1; stopList["k"] = 1; stopList["l"] = 1; stopList["m"] = 1; stopList["n"] = 1; stopList["o"] = 1; stopList["p"] = 1; stopList["q"] = 1; stopList["r"] = 1; stopList["s"] = 1; stopList["t"] = 1; stopList["u"] = 1; stopList["v"] = 1; stopList["w"] = 1; stopList["x"] = 1; stopList["y"] = 1; stopList["z"] = 1; stopList["-"] = 1; stopList["--"] = 1; stopList["''"] = 1; stopList["we've"] = 1; stopList["we'll"] = 1; stopList["we're"] = 1; stopList["who'll"] = 1; stopList["who've"] = 1; stopList["who's"] = 1; stopList["you'll"] = 1; stopList["you've"] = 1; stopList["you're"] = 1; stopList["i'll"] = 1; stopList["i've"] = 1; stopList["i'm"] = 1; stopList["i'd"] = 1; stopList["he'll"] = 1; stopList["he'd"] = 1; stopList["he's"] = 1; stopList["she'll"] = 1; stopList["she'd"] = 1; stopList["she's"] = 1; stopList["it'll"] = 1; stopList["it'd"] = 1; stopList["it's"] = 1; stopList["they've"] = 1; stopList["they're"] = 1; stopList["they'll"] = 1; stopList["didn't"] = 1; stopList["don't"] = 1; stopList["can't"] = 1; stopList["won't"] = 1; stopList["isn't"] = 1; stopList["wasn't"] = 1; stopList["couldn't"] = 1; stopList["should't"] = 1; stopList["wouldn't"] = 1; stopList["ve"] = 1; stopList["ll"] = 1; stopList["re"] = 1; stopList["th"] = 1; stopList["rd"] = 1; stopList["st"] = 1; stopList["doing"] = 1; stopList["allow"] = 1; stopList["examining"] = 1; stopList["using"] = 1; stopList["during"] = 1; stopList["within"] = 1; stopList["across"] = 1; stopList["among"] = 1; stopList["whether"] = 1; stopList["especially"] = 1; stopList["without"] = 1; stopList["actually"] = 1; stopList["another"] = 1; stopList["am"] = 1; stopList["because"] = 1; stopList["cannot"] = 1; stopList["the"] = 1; stopList["of"] = 1; stopList["to"] = 1; stopList["and"] = 1; stopList["a"] = 1; stopList["in"] = 1; stopList["is"] = 1; stopList["it"] = 1; stopList["you"] = 1; stopList["that"] = 1; stopList["he"] = 1; stopList["was"] = 1; stopList["for"] = 1; stopList["on"] = 1; stopList["are"] = 1; stopList["with"] = 1; stopList["as"] = 1; stopList["I"] = 1; stopList["his"] = 1; stopList["they"] = 1; stopList["be"] = 1; stopList["at"] = 1; stopList["one"] = 1; stopList["have"] = 1; stopList["this"] = 1; stopList["from"] = 1; stopList["or"] = 1; stopList["had"] = 1; stopList["by"] = 1; stopList["hot"] = 1; stopList["word"] = 1; stopList["but"] = 1; stopList["what"] = 1; stopList["some"] = 1; stopList["we"] = 1; stopList["yet"] = 1; stopList["can"] = 1; stopList["out"] = 1; stopList["other"] = 1; stopList["were"] = 1; stopList["all"] = 1; stopList["there"] = 1; stopList["when"] = 1; stopList["up"] = 1; stopList["use"] = 1; stopList["your"] = 1; stopList["how"] = 1; stopList["said"] = 1; stopList["an"] = 1; stopList["each"] = 1; stopList["she"] = 1; stopList["which"] = 1; stopList["do"] = 1; stopList["their"] = 1; stopList["time"] = 1; stopList["if"] = 1; stopList["will"] = 1; stopList["shall"] = 1; stopList["way"] = 1; stopList["about"] = 1; stopList["many"] = 1; stopList["then"] = 1; stopList["them"] = 1; stopList["would"] = 1; stopList["like"] = 1; stopList["so"] = 1; stopList["these"] = 1; stopList["her"] = 1; stopList["long"] = 1; stopList["make"] = 1; stopList["thing"] = 1; stopList["see"] = 1; stopList["him"] = 1; stopList["two"] = 1; stopList["has"] = 1; stopList["look"] = 1; stopList["more"] = 1; stopList["day"] = 1; stopList["could"] = 1; stopList["go"] = 1; stopList["come"] = 1; stopList["did"] = 1; stopList["no"] = 1; stopList["yes"] = 1; stopList["most"] = 1; stopList["my"] = 1; stopList["over"] = 1; stopList["know"] = 1; stopList["than"] = 1; stopList["call"] = 1; stopList["first"] = 1; stopList["who"] = 1; stopList["may"] = 1; stopList["down"] = 1; stopList["side"] = 1; stopList["been"] = 1; stopList["now"] = 1; stopList["find"] = 1; stopList["any"] = 1; stopList["new"] = 1; stopList["part"] = 1; stopList["take"] = 1; stopList["get"] = 1; stopList["place"] = 1; stopList["made"] = 1; stopList["where"] = 1; stopList["after"] = 1; stopList["back"] = 1; stopList["little"] = 1; stopList["only"] = 1; stopList["came"] = 1; stopList["show"] = 1; stopList["every"] = 1; stopList["good"] = 1; stopList["me"] = 1; stopList["our"] = 1; stopList["under"] = 1; stopList["upon"] = 1; stopList["very"] = 1; stopList["through"] = 1; stopList["just"] = 1; stopList["great"] = 1; stopList["say"] = 1; stopList["low"] = 1; stopList["cause"] = 1; stopList["much"] = 1; stopList["mean"] = 1; stopList["before"] = 1; stopList["move"] = 1; stopList["right"] = 1; stopList["too"] = 1; stopList["same"] = 1; stopList["tell"] = 1; stopList["does"] = 1; stopList["set"] = 1; stopList["three"] = 1; stopList["want"] = 1; stopList["well"] = 1; stopList["also"] = 1; stopList["put"] = 1; stopList["here"] = 1; stopList["must"] = 1; stopList["big"] = 1; stopList["high"] = 1; stopList["such"] = 1; stopList["why"] = 1; stopList["ask"] = 1; stopList["men"] = 1; stopList["went"] = 1; stopList["kind"] = 1; stopList["need"] = 1; stopList["try"] = 1; stopList["again"] = 1; stopList["near"] = 1; stopList["should"] = 1; stopList["still"] = 1; stopList["between"] = 1; stopList["never"] = 1; stopList["last"] = 1; stopList["let"] = 1; stopList["though"] = 1; stopList["might"] = 1; stopList["saw"] = 1; stopList["left"] = 1; stopList["late"] = 1; stopList["run"] = 1; stopList["don't"] = 1; stopList["while"] = 1; stopList["close"] = 1; stopList["few"] = 1; stopList["seem"] = 1; stopList["next"] = 1; stopList["got"] = 1; stopList["always"] = 1; stopList["those"] = 1; stopList["both"] = 1; stopList["often"] = 1; stopList["thus"] = 1; stopList["won't"] = 1; stopList["not"] = 1; stopList["into"] = 1; stopList["inside"] = 1; stopList["its"] = 1; stopList["makes"] = 1; stopList["tenth"] = 1; stopList["trying"] = 1; stopList["i"] = 1; stopList["me"] = 1; stopList["my"] = 1; stopList["myself"] = 1; stopList["we"] = 1; stopList["us"] = 1; stopList["our"] = 1; stopList["ours"] = 1; stopList["ourselves"] = 1; stopList["you"] = 1; stopList["your"] = 1; stopList["yours"] = 1; stopList["yourself"] = 1; stopList["yourselves"] = 1; stopList["he"] = 1; stopList["him"] = 1; stopList["his"] = 1; stopList["himself"] = 1; stopList["she"] = 1; stopList["her"] = 1; stopList["hers"] = 1; stopList["herself"] = 1; stopList["it"] = 1; stopList["its"] = 1; stopList["itself"] = 1; stopList["they"] = 1; stopList["them"] = 1; stopList["their"] = 1; stopList["theirs"] = 1; stopList["themselves"] = 1; stopList["what"] = 1; stopList["which"] = 1; stopList["who"] = 1; stopList["whom"] = 1; stopList["this"] = 1; stopList["that"] = 1; stopList["these"] = 1; stopList["those"] = 1; stopList["am"] = 1; stopList["is"] = 1; stopList["are"] = 1; stopList["was"] = 1; stopList["were"] = 1; stopList["be"] = 1; stopList["been"] = 1; stopList["being"] = 1; stopList["have"] = 1; stopList["has"] = 1; stopList["had"] = 1; stopList["having"] = 1; stopList["do"] = 1; stopList["does"] = 1; stopList["did"] = 1; stopList["doing"] = 1; stopList["will"] = 1; stopList["would"] = 1; stopList["shall"] = 1; stopList["should"] = 1; stopList["can"] = 1; stopList["could"] = 1; stopList["may"] = 1; stopList["might"] = 1; stopList["must"] = 1; stopList["ought"] = 1; stopList["i'm"] = 1; stopList["you're"] = 1; stopList["he's"] = 1; stopList["she's"] = 1; stopList["it's"] = 1; stopList["we're"] = 1; stopList["they're"] = 1; stopList["i've"] = 1; stopList["you've"] = 1; stopList["we've"] = 1; stopList["they've"] = 1; stopList["i'd"] = 1; stopList["you'd"] = 1; stopList["he'd"] = 1; stopList["she'd"] = 1; stopList["we'd"] = 1; stopList["they'd"] = 1; stopList["i'll"] = 1; stopList["you'll"] = 1; stopList["he'll"] = 1; stopList["she'll"] = 1; stopList["we'll"] = 1; stopList["they'll"] = 1; stopList["isn't"] = 1; stopList["aren't"] = 1; stopList["wasn't"] = 1; stopList["weren't"] = 1; stopList["hasn't"] = 1; stopList["haven't"] = 1; stopList["hadn't"] = 1; stopList["doesn't"] = 1; stopList["don't"] = 1; stopList["didn't"] = 1; stopList["won't"] = 1; stopList["wouldn't"] = 1; stopList["shan't"] = 1; stopList["shouldn't"] = 1; stopList["can't"] = 1; stopList["cannot"] = 1; stopList["couldn't"] = 1; stopList["mustn't"] = 1; stopList["let's"] = 1; stopList["that's"] = 1; stopList["who's"] = 1; stopList["what's"] = 1; stopList["here's"] = 1; stopList["there's"] = 1; stopList["when's"] = 1; stopList["where's"] = 1; stopList["why's"] = 1; stopList["how's"] = 1; stopList["daren't"] = 1; stopList["needn't"] = 1; stopList["oughtn't"] = 1; stopList["mightn't"] = 1; stopList["a"] = 1; stopList["an"] = 1; stopList["the"] = 1; stopList["and"] = 1; stopList["but"] = 1; stopList["if"] = 1; stopList["or"] = 1; stopList["because"] = 1; stopList["as"] = 1; stopList["until"] = 1; stopList["while"] = 1; stopList["of"] = 1; stopList["at"] = 1; stopList["by"] = 1; stopList["for"] = 1; stopList["with"] = 1; stopList["about"] = 1; stopList["against"] = 1; stopList["between"] = 1; stopList["into"] = 1; stopList["through"] = 1; stopList["during"] = 1; stopList["before"] = 1; stopList["after"] = 1; stopList["above"] = 1; stopList["below"] = 1; stopList["to"] = 1; stopList["from"] = 1; stopList["up"] = 1; stopList["down"] = 1; stopList["in"] = 1; stopList["out"] = 1; stopList["on"] = 1; stopList["off"] = 1; stopList["over"] = 1; stopList["under"] = 1; stopList["again"] = 1; stopList["further"] = 1; stopList["then"] = 1; stopList["once"] = 1; stopList["here"] = 1; stopList["there"] = 1; stopList["when"] = 1; stopList["where"] = 1; stopList["why"] = 1; stopList["how"] = 1; stopList["all"] = 1; stopList["any"] = 1; stopList["both"] = 1; stopList["each"] = 1; stopList["few"] = 1; stopList["more"] = 1; stopList["most"] = 1; stopList["other"] = 1; stopList["some"] = 1; stopList["such"] = 1; stopList["no"] = 1; stopList["nor"] = 1; stopList["not"] = 1; stopList["only"] = 1; stopList["own"] = 1; stopList["same"] = 1; stopList["so"] = 1; stopList["than"] = 1; stopList["too"] = 1; stopList["very"] = 1; stopList["one"] = 1; stopList["every"] = 1; stopList["least"] = 1; stopList["less"] = 1; stopList["many"] = 1; stopList["now"] = 1; stopList["ever"] = 1; stopList["never"] = 1; stopList["say"] = 1; stopList["says"] = 1; stopList["said"] = 1; stopList["also"] = 1; stopList["get"] = 1; stopList["go"] = 1; stopList["goes"] = 1; stopList["just"] = 1; stopList["made"] = 1; stopList["make"] = 1; stopList["put"] = 1; stopList["see"] = 1; stopList["seen"] = 1; stopList["whether"] = 1; stopList["like"] = 1; stopList["well"] = 1; stopList["back"] = 1; stopList["even"] = 1; stopList["still"] = 1; stopList["way"] = 1; stopList["take"] = 1; stopList["since"] = 1; stopList["another"] = 1; stopList["however"] = 1; stopList["two"] = 1; stopList["three"] = 1; stopList["four"] = 1; stopList["five"] = 1; stopList["first"] = 1; stopList["second"] = 1; stopList["new"] = 1; stopList["old"] = 1; stopList["high"] = 1; stopList["long"] = 1;

//Words Olly doesn't want to see
	stopList["going"] = 1; stopList["ok"] = 1; stopList["really"] = 1; stopList["yeah"] = 1; stopList["im"]	= 1; 