var fileContents = "";

$(document).ready(function () {
	$( "#frm_options" ).submit(function( event ) {		//Listen for the submit button
		event.preventDefault();
		if (fileContents != "") {
			html = $.parseHTML( fileContents );    //Raw HTML from file. Returns an array
			data = html[4];               //Just the useful content
			threads = data.querySelectorAll(THREAD);
			username = data.querySelectorAll(USER)[0].childNodes[0].nodeValue;
			create_thread_length_graph(username,threads);					//Begin the analysis
		}
	});

	$( "#frm_cloud" ).submit(function( event ) {
		event.preventDefault();
		if (fileContents != "") {
			html = $.parseHTML( fileContents );    //Raw HTML from file. Returns an array
			data = html[4];               //Just the useful content
			threads = data.querySelectorAll(THREAD);
			create_word_cloud(threads);
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
var html;
var data;
var threads;
var username;

/*
Returns an object containing each word and its count, eg {unlucky: 2, shrek: 999}
oldwords is another object of the same type to add the words to. 
	If there isn't one, pass an empty object {}
*/
function count_words(messages,threadLength,oldWords,discountEmoticons,discountCommon) {

	for (var w = 0; w < threadLength; w++) {
		var msg = messages[w].nextElementSibling.innerHTML;
		var wordsInMsg = msg.split(/\s+/);
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
	return oldWords;	
}

function create_thread_length_graph(username,threads){

	var discountEmoticons = document.getElementById("discountEmoticons").checked;
	var discountCommon = document.getElementById("discountCommon").checked;

	var threadLengths = [];

	var numthreads = threads.length;

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
		
		newWords = count_words(messages,threadLength,oldWords,discountEmoticons,discountCommon);

		var newCount = oldCount + threadLength;
		//store new values for this title
		recipents[title].count = newCount;
		recipents[title].words = newWords;
		
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
	
}

function create_word_cloud(threads) {

	var discountEmoticons = document.getElementById("discountEmoticons").checked;
	var discountCommon = document.getElementById("discountCommon").checked;

	var numthreads = threads.length;

	var words = {};

	for (i = 0; i < numthreads; i++) { 
		var messages = threads[i].querySelectorAll(MSG);
		var threadLength = messages.length;
		words = count_words(messages,threadLength,words,discountEmoticons,discountCommon);
	}

	var wordList = getSortedKeys(words);
	var cloudWords = {};
	var justWords = [];
	var minWord;
	var maxWord;
	for (var i = 0; i < 80 && i < wordList.length; i++)
	{
		var escapedWord = escapeHtml(wordList[i][1] + " - " + wordList[i][0]);
		cloudWords[escapeHtml(wordList[i][0])] = wordList[i][1];
		justWords[i] = escapeHtml(wordList[i][0]);
		if(i == 0) {
			maxWord = wordList[i][1];
		}
		if(i == 79) {
			minWord = wordList[i][1];
		}
	}


	var wordScale = d3.scale.linear().range([20,120]);

	wordScale.domain([minWord,maxWord]);

	var fill = d3.scale.category20();

 	d3.layout.cloud()
	    .size([600, 600])
	    .words(justWords.map(function(d) {
			 return {text: d, size: wordScale(cloudWords[d])};
	    }))
	    .padding(5)
	    .rotate(function() { return ~~(Math.random() * 2) * 90; })
	    .font("Impact")
	    .fontSize(function(d) { return d.size; })
	    .on("end", draw)
		.start();

	function draw(words) {
	  d3.select("body").append("svg")
	      .attr("width", 600)
	      .attr("height", 600)
	    .append("g")
	      .attr("transform", "translate(300,300)")
	    .selectAll("text")
	      .data(words)
	    .enter().append("text")
	      .style("font-size", function(d) { return d.size + "px"; })
	      .style("font-family", "Impact")
	      .style("fill", function(d, i) { return fill(i); })
	      .attr("text-anchor", "middle")
	      .attr("transform", function(d) {
	        return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
	      })
	      .text(function(d) { return d.text; });
	}
}

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

function escapeHtml(string) {
	return String(string).replace(/[&<>"'\/]/g, function (s) {
		return entityMap[s];
	});
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
"are","was","were","be","been",	"being","have","has","had","having","do","does","did","doing","will","would","shall","should","can","could","may","might","must","ought","i'm","you're",
"he's","she's","it's","we're","they're","i've","you've","we've","they've","i'd","you'd","he'd","she'd","we'd","they'd","i'll","you'll","he'll","she'll","we'll","they'll","isn't",
"aren't","wasn't","weren't","hasn't","haven't","hadn't","doesn't","don't","didn't","won't","wouldn't","shan't","shouldn't","can't","cannot","couldn't","mustn't","let's","that's",
"who's","what's","here's","there's","when's","where's","why's","how's","daren't","needn't","oughtn't","mightn't","a","an","the","and","but","if","or","because","as","until","while",
"of","at","by","for","with","about","against","between","into","through","during","before","after","above","below","to","from","up","down","in","out","on","off","over","under",
"again","further","then","once","here","there","when","where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor","not","only","own","same",
"so","than","too","very","one","every","least","less","many","now","ever","never","say","says","said","also","get","go","goes","just","made","make","put","see","seen","whether",
"like","well","back","even","still","way","take","since","another","however","two","three","four","five","first","second","new","old","high","long","going","ok","really","yeah","im",
"0","1","2","3","4","5","6","7","8","9","10","okay","sure","dont","maybe","getting","gonna","today","anyone","everyone","coming","probably","around","already","thats","around","else",
"enough","something","lol","oh","ill","anyway","someone","cant","hey","wants","wanna",""
]

for (var i = 0; i <= words.length; i++) {
	stopList[words[i]] = 1;
};