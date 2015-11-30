var fileContents = "";

$(document).ready(function () {
	$( "#frm_options" ).submit(function( event ) {		//Listen for the submit button
		event.preventDefault();
		if (fileContents != "") {
			load_dataset(fileContents);					//Begin the analysis
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
			wordsInMsg = msg.split(/\s+/);
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
			var toolTipText = recipents[d].count + " messages, top 30 words:<br />";
			var wordList = getSortedKeys(recipents[d].words);
			for (var i = 0; i < 30 && i < wordList.length; i++)
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

	var words = [
"january","february","march","april","may","june","july","august","september","october","november","december","monday","tuesday","wednesday","thursday","friday","saturday",
"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","-","--","''","we've","we'll","we're","who'll","who've","who's","you'll",
"you've","you're","i'll","i've","i'm","i'd","he'll","he'd","he's","she'll","she'd","she's","it'll","it'd","it's","they've","they're","they'll","didn't","don't","can't","won't",
"isn't","wasn't","couldn't","should't","wouldn't","ve","ll","re","th","rd","st","doing","allow","examining","using","during","within","across","among","whether","especially",
"without","actually","another","am","because","cannot","the","of","to","and","a","in","is","it","you","that","he","was","for","on","are","with","as","I","his","they","be","at",
"one","have","this","from","or","had","by","hot","word","but","what","some","we","yet","can","out","other","were","all","there","when","up","use","your","how","said","an","each",
"she","which","do","their","time","if","will","shall","way","about","many","then","them","would","like","so","these","her","long","make","thing","see","him","two","has","look",
"more","day","could","go","come","did","no","yes","most","my","over","know","than","call","first","who","may","down","side","been","now","find","any","new","part","take","get",
"place","made","where","after","back","little","only","came","show","every","good","me","our","under","upon","very","through","just","great","say","low","cause","much","mean",
"before","move","right","too","same","tell","does","set","three","want","well","also","put","here","must","big","high","such","why","ask","men","went","kind","need","try","again",
"near","should","still","between","never","last","let","though","might","saw","left","late","run","don't","while","close","few","seem","next","got","always","those","both","often",
"thus","won't","not","into","inside","its","makes","tenth","trying","i","me","my","myself","we","us","our","ours","ourselves","you","your","yours","yourself","yourselves","he","him",
"his","himself","she","her","hers","herself","it","its","itself","they","them","their","theirs","themselves","what","which","who","whom","this","that","these","those","am","is",
"are","was","were","be","been","being","have","has","had","having","do","does","did","doing","will","would","shall","should","can","could","may","might","must","ought","i'm","you're",
"he's","she's","it's","we're","they're","i've","you've","we've","they've","i'd","you'd","he'd","she'd","we'd","they'd","i'll","you'll","he'll","she'll","we'll","they'll","isn't",
"aren't","wasn't","weren't","hasn't","haven't","hadn't","doesn't","don't","didn't","won't","wouldn't","shan't","shouldn't","can't","cannot","couldn't","mustn't","let's","that's",
"who's","what's","here's","there's","when's","where's","why's","how's","daren't","needn't","oughtn't","mightn't","a","an","the","and","but","if","or","because","as","until","while",
"of","at","by","for","with","about","against","between","into","through","during","before","after","above","below","to","from","up","down","in","out","on","off","over","under",
"again","further","then","once","here","there","when","where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor","not","only","own","same",
"so","than","too","very","one","every","least","less","many","now","ever","never","say","says","said","also","get","go","goes","just","made","make","put","see","seen","whether",
"like","well","back","even","still","way","take","since","another","however","two","three","four","five","first","second","new","old","high","long","going","ok","really","yeah","im",
"0","1","2","3","4","5","6","7","8","9","okay","sure","dont","maybe","getting","gonna","today",""
	]

	for (var i = 0; i <= words.length; i++) {
		stopList[words[i]] = 1;
	};