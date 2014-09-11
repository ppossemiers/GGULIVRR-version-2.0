'use strict';

var _usr = null;
var _team = null;
var _game = null;
var _jscript = null;
var _doc = null;
var _answers = {};
var _background = null;
var _zip = null;
var _ggulivrrDB = null;
//var _ggulivrrDBURL = '.cloudant.com/';
var _ggulivrrDBURL = '127.0.0.1:5984/';

// Public
function detectMobile(){
	if(navigator.userAgent.match(/Android/i)
			 || navigator.userAgent.match(/webOS/i)
			 || navigator.userAgent.match(/iPhone/i)
			 || navigator.userAgent.match(/iPad/i)
			 || navigator.userAgent.match(/iPod/i)
			 || navigator.userAgent.match(/BlackBerry/i)
			 || navigator.userAgent.match(/Windows Phone/i)){
		return true;
	}
	else{ return false; }
}

// Public
function getAnswers(){
	return _answers;
}

// Public
function setMessage(newMsg){
	var usrDoc = JSON.parse(localStorage.getItem(_usr));
	usrDoc.msg = newMsg;
	localStorage.setItem(_usr, JSON.stringify(usrDoc));
}

// Public
function setNextItem(item){
	var usrDoc = JSON.parse(localStorage.getItem(_usr));
	usrDoc.nextItem = item;
	localStorage.setItem(_usr, JSON.stringify(usrDoc));
}

function _openDB(){
	var dbSize = 50 * 1024 * 1024; // 50MB
	_ggulivrrDB = openDatabase('ggulivrr', '1.0', 'Ggulivrr DB', dbSize);
}

function _createTable(){
	_ggulivrrDB.transaction(function(tx) {
	  tx.executeSql('CREATE TABLE IF NOT EXISTS games(name TEXT, zip TEXT, added_on DATETIME)', []);
	});
}

function _addGame(name, zip){
	_ggulivrrDB.transaction(function(tx){
		var addedOn = new Date();
		tx.executeSql('INSERT INTO games(name, zip, added_on) VALUES (?,?,?)',
		   [name, zip, addedOn],
		   function(tx, r){},
		   function(tx, e){ alert(e.message); }
		);
	});
}

function _deleteGame(name){
	var db = _ggulivrrDB;
	db.transaction(function(tx){
		tx.executeSql('DELETE FROM games WHERE name=?', 
		    [name],
		    function(tx, r){ },
		    function(tx, e){ alert(e.message); }
		);
	});
}

function _downloadGame(name, reload){
	_ggulivrrDB.transaction(function(tx){
	tx.executeSql('SELECT zip, added_on FROM games WHERE name=?', 
	    [name],
	    function(tx, result){
			var len = result.rows.length;
			if(len===0 || $('#reload').is(':checked')===true){
				if($('#reload').is(':checked')===true){ _deleteGame(name); }
				var url = 'http://' + _ggulivrrDBURL + _game + '/' + _game + '.zip';
				// See http://stuk.github.com/jszip/examples/get-binary-files-xhr2.html
				var xhr1 = new XMLHttpRequest();
				xhr1.open('GET', url, true);
				if(xhr1.overrideMimeType){ xhr1.overrideMimeType('text/plain; charset=x-user-defined'); }
				xhr1.onreadystatechange = function(e){
					if(this.readyState===4 && this.status===200){
						var data = this.responseText;
						_addGame(name, JSON.stringify(data));
						_zip = new JSZip(data);
						_initGgulivrr();
					}
				};
				xhr1.send(null);
			}
			else{
				_zip = new JSZip(JSON.parse(result.rows.item(0).zip));
				_initGgulivrr();
			}
		},
	    function(tx, error){ alert(error.message); });
	});
}

function _display(docName){
	_doc = docName.toLowerCase();
	var visited = false;
	var usrDoc = JSON.parse(localStorage.getItem(_usr));
	for(var i=0; i<usrDoc.items.length; i++){ if(usrDoc.items[i].name===_doc){ visited = true; } }
	if(usrDoc.nextItem===_doc){ visited = false; }
	if(visited===true){ alert('You have already answered this question. Please go to the next item.'); }
	else{
		if(usrDoc.nextItem!==null && usrDoc.nextItem!==_doc){
			if(usrDoc.msg!==null && usrDoc.msg!==undefined){ alert(usrDoc.msg); }
		}
		else{
			usrDoc.nextItem = null;
			usrDoc.msg = null;
			localStorage.setItem(_usr, JSON.stringify(usrDoc));
			try{
				$('#buttons').hide();
				$('#webview').empty();
				var htmlString = _zip.file('html/' + _doc).asText();
				if(_jscript!==null){ htmlString += '<script type="text/javascript">'+ _jscript + '</script>'; }
				$('#webview').html(_getImages(htmlString));
				$('form').submit(function(){
					try{ process($(this).serializeArray(), _doc); }
					catch(e){}
					_process($(this).serializeArray());
					return false;
				});
			}
			catch(e){
				alert(e);
				//alert('The document could not be found. Please check your QR code.');
				$('#webview').html(_background);
				$('#buttons').show();
			}
		}
	}
	_showSpinner(false);
}

function _getImages(html){
	var htmlOld = html;
	var regex = /<img src='/gi;
	var offset = 10;
	var result;
	var indices = [];
	while((result = regex.exec(htmlOld))){ indices.push(result.index); }
	try{
		if(indices.length > 0){
			$.each(indices, function(index, value){
				var html2 = htmlOld.substring(value + offset, htmlOld.length);
				var end = html2.indexOf("'");
				var media1 = html2.substring(0, end);
				var media2 = media1;
				if(media1.substring(0, 1)==='/'){ media1 = media1.substring(1, media1.length); }
				if(media1.substring(0, 3)==='../'){ media1 = media1.substring(3, media1.length); }
				html = html.replace(media2, btoa(_zip.file(media1).data));
			});
		}
		html = html.replace(regex, "<img src='data:image/jpeg;base64,");
	}
	catch(e){ alert('Image could not be found. Please check your HTML.'); }
	return html;
}

function _scanQR(img){
	_showSpinner(true);
	var reader = new FileReader();
    reader.onload = (function(theFile){
      return function(e){
    	qrcode.decode(e.target.result);
      };
    })(img);
    reader.readAsDataURL(img);
}

function _process(answers){
	$('#webview').html(_background);
	$('#buttons').show();
	var usrDoc = JSON.parse(localStorage.getItem(_usr));
	var item = {};
	item.name = _doc;
	item.answers = answers;
	navigator.geolocation.getCurrentPosition(function(pos){
		item.timestamp = pos.timestamp;
		item.lat = pos.coords.latitude;
		item.lon = pos.coords.longitude;
		usrDoc.items.push(item);
		localStorage.setItem(_usr, JSON.stringify(usrDoc));
		var keys = Object.keys(_answers);
		if(_doc===keys[keys.length-1]){ _putUsrDoc(); }
	}, function(){ 
		item.timestamp = new Date();
		usrDoc.items.push(item);
		localStorage.setItem(_usr, JSON.stringify(usrDoc));
		var keys = Object.keys(_answers);
		if(_doc===keys[keys.length-1]){ _putUsrDoc(); }
	}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

function _putUsrDoc(){
	var item = {};
	var d = new Date();
	$.ajax({
		type:	'PUT',
		url:	'http://' + _ggulivrrDBURL + _usr + '-' + d.valueOf(),
	    data:	localStorage.getItem(_usr),
        async:  true,
        success:function(data){
        	localStorage.removeItem(_usr);
        	$('#upload').hide();
        	$('#scan').show();
        	alert('Your game results were uploaded to the server.');
        	_initGgulivrr();
        },
		error: function(XMLHttpRequest, textStatus, errorThrown){
			alert('User results could not be saved to the server. Check your network connection and try again later.');
			$('#buttons').show();
			$('#scan').hide();
			$('#upload').show();
			var usrDoc = JSON.parse(localStorage.getItem(_usr));
			usrDoc.finished = true;
			localStorage.setItem(_usr, JSON.stringify(usrDoc));
		}
	});
}

function _initGgulivrr(){
	// Create UserDoc
	if(localStorage.getItem(_usr)===undefined
			|| localStorage.getItem(_usr)===null){
		var doc = {};
		doc.id = _usr;
		doc.game = _game;
		doc.items = [];
		doc.nextItem = null;
		doc.msg = null;
		localStorage.setItem(_usr, JSON.stringify(doc));
	}
	// Initiate QRCode
	qrcode.callback = _display;
	// Get answers, JScript and background from ZIP
	if(_zip.file('misc/answers.json')){ _answers = JSON.parse(_zip.file('misc/answers.json').asText()); }
	if(_zip.file('misc/javascript')){ _jscript = _zip.file('misc/javascript').asText(); }
	if(_zip.file('html/background')){ _background = _zip.file('html/background').asText(); }
	_background = _getImages(_background);
	// Screen updates
	$('#login').hide();
	$('#buttons').show();
	$('#upload').hide();
	var usrDoc = JSON.parse(localStorage.getItem(_usr));
	if(usrDoc.finished===true){
		$('#scan').hide();
		$('#upload').show();
	}
    $('#webview').html(_background);
    _showSpinner(false);
}

function innerLoad(){
    var iframe = document.createElement('IFRAME');
    iframe.setAttribute('style', 'width:0px; height:0px; visibility:hidden; position:absolute; border:none');
    iframe.src = 'http://' + _ggulivrrDBURL + _game + '/manifest.html';
    document.body.appendChild(iframe);
}

function _login(){
	_showSpinner(true);
	var login = ($('#user').val()!=='' && $('#db').val()!=='' && $('#team').val()!=='');
	if(login===true){
		_usr = $('#user').val().toLowerCase();
		_team = $('#team').val().toLowerCase();
		_game = $('#db').val().toLowerCase();
		localStorage.setItem('ggulivrr_user', _usr);
		localStorage.setItem('ggulivrr_team', _team);
		localStorage.setItem('ggulivrr_game', _game);
		//_ggulivrrDBURL = _team + _ggulivrrDBURL + 'ggulivrrdb/';
		_ggulivrrDBURL = _ggulivrrDBURL + 'ggulivrr/';
		innerLoad();
		if($('#clear').is(':checked')===true){ localStorage.removeItem(_usr); }
		try{
			_openDB();
			_createTable();
			_downloadGame(_game);
		}
		catch(e){
			alert('Your browser does not support WebSQL (Firefox or IE?)');
			_showSpinner(false);
		}	
	}
	else{ 
		alert('Please fill in all the fields!');
		_showSpinner(false);
	}
}

function _showSpinner(visible){
	if(visible===true){ $('#spinner').show(); }
	else{ $('#spinner').hide(); }
}

$(document).ready(function(){
	$('#buttons').hide();
	_showSpinner(false);
	document.ontouchmove = function(e) { e.preventDefault(); };
	//scrollableDiv.ontouchmove = function(e) { e.stopPropagation(); };
	
	$('#user').val(localStorage.getItem('ggulivrr_user'));
	$('#team').val(localStorage.getItem('ggulivrr_team'));
	$('#db').val(localStorage.getItem('ggulivrr_game'));
	
    window.addEventListener('load', function(e){
		  window.applicationCache.addEventListener('updateready', function(e){
		    if(window.applicationCache.status == window.applicationCache.UPDATEREADY){
		      window.applicationCache.swapCache();
		      if (confirm('A new version of GGULIVRR is available. Load it?')){
		        window.location.reload();
		      }
		    } 
		    else {}
		  }, false);
		}, false);
});