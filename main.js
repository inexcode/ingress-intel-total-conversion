// ==UserScript==
// @id             ingress-intel-total-conversion@jonatkins
// @name           IITC: Ingress intel map total conversion
// @version        0.29.1.@@DATETIMEVERSION@@
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @updateURL      @@UPDATEURL@@
// @downloadURL    @@DOWNLOADURL@@
// @description    [@@BUILDNAME@@-@@BUILDDATE@@] Total conversion for the ingress intel map.
// @include        https://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @grant          none
// @run-at         document-end
// ==/UserScript==


// REPLACE ORIG SITE ///////////////////////////////////////////////////
if(document.getElementsByTagName('html')[0].getAttribute('itemscope') != null)
  throw('Ingress Intel Website is down, not a userscript issue.');
window.iitcBuildDate = '@@BUILDDATE@@';

// disable vanilla JS
window.onload = function() {};
document.body.onload = function() {};

//originally code here parsed the <Script> tags from the page to find the one that defined the PLAYER object
//however, that's already been executed, so we can just access PLAYER - no messing around needed!

var PLAYER = window.PLAYER || (unsafeWindow && unsafeWindow.PLAYER);
if (typeof(PLAYER)!="object" || typeof(PLAYER.nickname) != "string") {
  // page doesn’t have a script tag with player information.
  if(document.getElementById('header_email')) {
    // however, we are logged in.
    // it used to be regularly common to get temporary 'account not enabled' messages from the intel site.
    // however, this is no longer common. more common is users getting account suspended/banned - and this
    // currently shows the 'not enabled' message. so it's safer to not repeatedly reload in this case
//    setTimeout('location.reload();', 3*1000);
    throw("Page doesn't have player data, but you are logged in.");
  }
  // FIXME: handle nia takedown in progress
  throw("Couldn't retrieve player data. Are you logged in?");
}

// player information is now available in a hash like this:
// window.PLAYER = {"ap": "123", "energy": 123, "available_invites": 123, "nickname": "somenick", "team": "ENLIGHTENED||RESISTANCE"};

// remove complete page. We only wanted the user-data and the page’s
// security context so we can access the API easily. Setup as much as
// possible without requiring scripts.
document.getElementsByTagName('head')[0].innerHTML = ''
  + '<title>Ingress Intel Map</title>'
  + '<style>@@INCLUDESTRING:style.css@@</style>'
  + '<style>@@INCLUDECSS:external/leaflet.css@@</style>'
//note: smartphone.css injection moved into code/smartphone.js
  + '<link rel="stylesheet" type="text/css" href="//fonts.googleapis.com/css?family=Roboto:100,100italic,300,300italic,400,400italic,500,500italic,700,700italic&subset=latin,cyrillic-ext,greek-ext,greek,vietnamese,latin-ext,cyrillic"/>'
  + '<link href="https://fonts.googleapis.com/css?family=Coda&display=swap&subset=latin-ext" rel="stylesheet"> '

// remove body element entirely to remove event listeners
document.body = document.createElement('body');
document.body.innerHTML = ''
  + '<div id="map">Loading, please wait</div>'
  + '<div id="chatcontrols" style="display:none">'
  + '<a accesskey="0" title="[0]"><span class="toggle expand"></span></a>'
  + '<a accesskey="1" title="[1]">all</a>'
  + '<a accesskey="2" title="[2]" class="active">faction</a>'
  + '<a accesskey="3" title="[3]">alerts</a>'
  + '</div>'
  + '<div id="chat" style="display:none">'
  + '  <div id="chatfaction"></div>'
  + '  <div id="chatall"></div>'
  + '  <div id="chatalerts"></div>'
  + '</div>'
  + '<form id="chatinput" style="display:none"><table><tr>'
  + '  <td><time></time></td>'
  + '  <td><mark>tell faction:</mark></td>'
  + '  <td><input id="chattext" type="text" maxlength="256" accesskey="c" title="[c]" /></td>'
  + '</tr></table></form>'
  + '<div id="statbar">'
  + '    <div id="playerstat">t</div>'
  + '    <div id="gamestat">&nbsp;loading global control stats</div>'
  + '</div>'
  + '<div id="scrollwrapper" class="sidebar_visible">' // enable scrolling for small screens
  + '  <div id="sidebar">'
  + '    <div id="searchwrapper">'
  + '      <a id="sidebartoggle" accesskey="i" title="Toggle sidebar [i]">@@INCLUDESTRING:images/icon-chevron-right.svg@@</a>'
  + '      <div id="searchdecorator">'
  + '         <input id="search" placeholder="Search location…" type="search" accesskey="f" title="Search for a place [f]"/>'
  + '      </div>'
  + '      <button title="Current location" id="buttongeolocation">@@INCLUDESTRING:images/icon-location.svg@@</button>'
  + '    </div>'
  + '    <div id="portaldetails"></div>'
  + '    <input id="redeem" placeholder="Redeem code…" type="text"/>'
  + '    <div id="toolbox">'
  + '      <a onmouseover="setPermaLink(this)" onclick="setPermaLink(this);return androidPermalink()" title="URL link to this map view">Permalink</a>'
  + '      <a onclick="window.aboutIITC()" style="cursor: help">About IITC</a>'
  + '      <a onclick="window.regionScoreboard()" title="View regional scoreboard">Region scores</a>'
  + '    </div>'
  + '  </div>'
  + '</div>'
  + '<div id="updatestatus"><div id="innerstatus"></div></div>'
  // avoid error by stock JS
  + '<div id="play_button"></div>';

// putting everything in a wrapper function that in turn is placed in a
// script tag on the website allows us to execute in the site’s context
// instead of in the Greasemonkey/Extension/etc. context.
function wrapper(info) {
// a cut-down version of GM_info is passed as a parameter to the script
// (not the full GM_info - it contains the ENTIRE script source!)
window.script_info = info;




// CONFIG OPTIONS ////////////////////////////////////////////////////
window.REFRESH = 30; // refresh view every 30s (base time)
window.ZOOM_LEVEL_ADJ = 5; // add 5 seconds per zoom level
window.ON_MOVE_REFRESH = 2.5;  //refresh time to use after a movement event
window.MINIMUM_OVERRIDE_REFRESH = 10; //limit on refresh time since previous refresh, limiting repeated move refresh rate
window.REFRESH_GAME_SCORE = 15*60; // refresh game score every 15 minutes
window.MAX_IDLE_TIME = 15*60; // stop updating map after 15min idling
window.HIDDEN_SCROLLBAR_ASSUMED_WIDTH = 20;
window.SIDEBAR_WIDTH = 300;

// how many pixels to the top before requesting new data
window.CHAT_REQUEST_SCROLL_TOP = 200;
window.CHAT_SHRINKED = 60;

// Minimum area to zoom ratio that field MU's will display
window.FIELD_MU_DISPLAY_AREA_ZOOM_RATIO = 0.001;

// Point tolerance for displaying MU's
window.FIELD_MU_DISPLAY_POINT_TOLERANCE = 60

window.COLOR_SELECTED_PORTAL = '#f0f';
window.COLORS = ['#FF6600', '#0088FF', '#03DC03']; // none, res, enl
window.COLORS_LVL = ['#000', '#FECE5A', '#FFA630', '#FF7315', '#E40000', '#FD2992', '#EB26CD', '#C124E0', '#9627F4'];
window.COLORS_MOD = {VERY_RARE: '#b08cff', RARE: '#73a8ff', COMMON: '#8cffbf'};


window.MOD_TYPE = {RES_SHIELD:'Shield', MULTIHACK:'Multi-hack', FORCE_AMP:'Force Amp', HEATSINK:'Heat Sink', TURRET:'Turret', LINK_AMPLIFIER: 'Link Amp'};

// circles around a selected portal that show from where you can hack
// it and how far the portal reaches (i.e. how far links may be made
// from this portal)
window.ACCESS_INDICATOR_COLOR = 'orange';
window.RANGE_INDICATOR_COLOR = 'red'

// min zoom for intel map - should match that used by stock intel
window.MIN_ZOOM = 3;

window.DEFAULT_PORTAL_IMG = '//commondatastorage.googleapis.com/ingress.com/img/default-portal-image.png';
//window.NOMINATIM = '//open.mapquestapi.com/nominatim/v1/search.php?format=json&polygon_geojson=1&q=';
window.NOMINATIM = '//nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=';

// INGRESS CONSTANTS /////////////////////////////////////////////////
// http://decodeingress.me/2012/11/18/ingress-portal-levels-and-link-range/
window.RESO_NRG = [0, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000];
window.HACK_RANGE = 40; // in meters, max. distance from portal to be able to access it
window.OCTANTS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
window.OCTANTS_ARROW = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
window.DESTROY_RESONATOR = 75; //AP for destroying portal
window.DESTROY_LINK = 187; //AP for destroying link
window.DESTROY_FIELD = 750; //AP for destroying field
window.CAPTURE_PORTAL = 500; //AP for capturing a portal
window.DEPLOY_RESONATOR = 125; //AP for deploying a resonator
window.COMPLETION_BONUS = 250; //AP for deploying all resonators on portal
window.UPGRADE_ANOTHERS_RESONATOR = 65; //AP for upgrading another's resonator
window.MAX_PORTAL_LEVEL = 8;
window.MAX_RESO_PER_PLAYER = [0, 8, 4, 4, 4, 2, 2, 1, 1];

// OTHER MORE-OR-LESS CONSTANTS //////////////////////////////////////
window.TEAM_NONE = 0;
window.TEAM_RES = 1;
window.TEAM_ENL = 2;
window.TEAM_TO_CSS = ['none', 'res', 'enl'];

window.SLOT_TO_LAT = [0, Math.sqrt(2)/2, 1, Math.sqrt(2)/2, 0, -Math.sqrt(2)/2, -1, -Math.sqrt(2)/2];
window.SLOT_TO_LNG = [1, Math.sqrt(2)/2, 0, -Math.sqrt(2)/2, -1, -Math.sqrt(2)/2, 0, Math.sqrt(2)/2];
window.EARTH_RADIUS=6367000;
window.DEG2RAD = Math.PI / 180;

// STORAGE ///////////////////////////////////////////////////////////
// global variables used for storage. Most likely READ ONLY. Proper
// way would be to encapsulate them in an anonymous function and write
// getters/setters, but if you are careful enough, this works.
window.refreshTimeout = undefined;
window.urlPortal = null;
window.urlPortalLL = null;
window.selectedPortal = null;
window.portalRangeIndicator = null;
window.portalAccessIndicator = null;
window.mapRunsUserAction = false;
//var portalsLayers, linksLayer, fieldsLayer;
var portalsFactionLayers, linksFactionLayers, fieldsFactionLayers;

// contain references to all entities loaded from the server. If render limits are hit,
// not all may be added to the leaflet layers
window.portals = {};
window.links = {};
window.fields = {};

window.resonators = {};

// contain current status(on/off) of overlay layerGroups.
// But you should use isLayerGroupDisplayed(name) to check the status
window.overlayStatus = {};

// plugin framework. Plugins may load earlier than iitc, so don’t
// overwrite data
if(typeof window.plugin !== 'function') window.plugin = function() {};


@@INJECTCODE@@


} // end of wrapper

// inject code into site context
var script = document.createElement('script');
var info = { buildName: '@@BUILDNAME@@', dateTimeVersion: '@@DATETIMEVERSION@@' };
if (this.GM_info && this.GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
