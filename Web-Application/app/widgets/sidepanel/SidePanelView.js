/*
| Copyright 2016 Esri
|
| Licensed under the Apache License, Version 2.0 (the "License");
| you may not use this file except in compliance with the License.
| You may obtain a copy of the License at
|
| http://www.apache.org/licenses/LICENSE-2.0
|
| Unless required by applicable law or agreed to in writing, software
| distributed under the License is distributed on an "AS IS" BASIS,
| WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
| See the License for the specific language governing permissions and
| limitations under the License.
*/
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/dom',
    'dojo/dom-construct',
    'dojo/dom-class',
    'dojo/dom-attr',
    'dojo/query',
    'dojo/NodeList-manipulate',
    'dojo/on',
    'dojo/NodeList-dom',
    'dojo/topic',

    "dijit/_WidgetBase",
    'dijit/_TemplatedMixin',

    "esri/tasks/QueryTask",
    "esri/tasks/support/Query",
    "esri/geometry/geometryEngineAsync",
    "campussearch/CampusSearch",

    './widgets/slideCard/SlideCard',

    'dojo/text!./SidePanelView.html'],

function(declare, lang, array, dom, domConstruct, domClass, domAttr, dojoQuery, dojoManip, dojoOn, nld, topic,
    _WidgetBase, _TemplatedMixin, QueryTask, Query, geometryEngineAsync, CampusSearch, SlideCard,
    template) {

    "use strict";

    return declare([_WidgetBase, _TemplatedMixin], {

        templateString: template,
        id: 'side-panel',
        cards: [
                'route',
                'office',
                'multiple',
                'info',
                'slides'
               ],
        isRouting: false,
        isElevatorRoute: false,

        constructor: function(options) {

            this.view = options.view;
            this.config = options.config;
            this.containerDiv = options.containerDiv;
            this.appUtils = options.appUtils;
            this.currentCard = "";
            this.featInfo = null;
            this.from_Info = null;
            this.to_Info = null;
            this.selectedFromMultipleResults = [];
            this.multipleResultsFromClick = false;
        },

        postCreate: function() {

            this._addEventListeners();

        },

        startup: function() {

            this.placeAt(this.containerDiv);
            this.initWidgets();

            this.searchSources = this.appUtils.getSearchSourceInfo(this.config.searchInfo);

        },

        _addEventListeners: function() {
            var thisNode = this;
            dojoOn(this.domNode, dojoOn.selector(".js-left-panel-close", 'click'), function() {
                thisNode.close('clear');
            });
            dojoOn(this.domNode, dojoOn.selector(".sp-swap-btn", 'click'), lang.hitch(this, this.swapFromTo));

            dojoOn(this.domNode, dojoOn.selector(".js-route-toggle", 'click'), lang.hitch(this, this._toggleRouteType));

            dojoOn(this._selectFromMultipleResults, "click", lang.hitch(this, this._processMultipleResults));
        },

        initWidgets: function() {

          if (this.config.routingEnabled) {
            this.fromSearch = new CampusSearch({
                    view: this.view,
                    containerDiv: this.route_FromNameNode,
                    config:  this.config,
                    appUtils:this.appUtils
                    });
            this.fromSearch.startup();

            this.toSearch = new CampusSearch({
                    view: this.view,
                    containerDiv: this.route_ToNameNode,
                    config:  this.config,
                    appUtils:this.appUtils
                    });
            this.toSearch.startup();

            dojoQuery('.sp-route-from-btn').removeClass('is-hidden');
            dojoQuery('.sp-route-to-btn').removeClass('is-hidden');

          }

          this.slideCard = new SlideCard ({
              view: this.view,
              containerDiv: this.slidesCardNode,
              config: this.config
          });
          this.slideCard.startup();

        },

        // this function will primarily be used by the InfoBtn to open and close correctly during route mode
        toggle: function() {
            var panelNode = this.domNode;

            // decide if we are opening or closing the panel
            if (domClass.contains(panelNode, 'panel-open')) {
                this.close();
            } else {
                this.open('route');
                this.currentCard = 'route';
            }
        },

        // function to open the side panel
        open: function(cardValue) {
            //console.debug('the panel is running an OPEN');
            // deselect other buttons on the map
            this.slideCard.deselect();

            var panelNode = this.domNode,
                panelChildren = dojoQuery('.js-left-panel-move'),
                hiddenSearch = dojoQuery('.js-left-panel-move .esri-search');

            // if the card is NOT Info & NOT Route then we hide the btn
            // Info & Route are special cases that will change the InfoBtn
            if (cardValue !== 'info' && cardValue !== 'route') {
                topic.publish("infoBtn/hide");
                hiddenSearch.removeClass('is-hidden');
                this.isRouting = false;
            }
            // if the card is Route then we need to set the routing flag
            // and call the InfoBtn update
            else if (cardValue === 'route') {
                this.isRouting = true;
                hiddenSearch.addClass('is-hidden');
                topic.publish("infoBtn/routeInProgress", { status: "open" });
                topic.publish("navToggle/routeInProgress", { status: "open" });
                this.slideCard.routeInProgress("open");
            }

            // Check if the panel is open or closed
            // if closed then open it
            if (!domClass.contains(panelNode, 'panel-open')) {
                domClass.add(panelNode, 'panel-open');
                panelChildren.addClass('panel-open');
            } else { // if it's open then switch the card by first clearing out the panel
                array.forEach(this.cards, function(card) {
                    dojoQuery('.js-card-' + card).addClass('is-hidden');
                });
            }

            // update the card in the panel
            dojoQuery('.js-card-' + cardValue).removeClass('is-hidden');
        },

        // function to close the side panel
        close: function(status) {
            var hiddenSearch = dojoQuery('.js-left-panel-move .esri-search');

            dojoQuery('.panel-open').removeClass('panel-open');

            // iterate through and hide all the cards
            array.forEach(this.cards, function(card) {
                dojoQuery('.js-card-' + card).addClass('is-hidden');
            });

            // if the status is to clear than set the routing flag to false to end routing mode
            if (status === 'clear') {
                if (!this.config.routingEnabled) {
                    topic.publish('sidePanel/close');
                } else {
                    topic.publish('route/close');
                }
                topic.publish("infoBtn/routeInProgress", { status: "clear" });
                topic.publish("navToggle/routeInProgress", { status: "clear" });
                this.slideCard.routeInProgress("clear");
                this.isRouting = false;

                this._clearRoutingInfo();
                this.hideRouteType();

                hiddenSearch.removeClass('is-hidden');


                this.slideCard.deselect();

            }

            // if the routing flag is set then when we close the side panel we need to
            // with the expand arrows in info tab otherwise we rest the tab to the i icon
            if (this.isRouting === true) {
                topic.publish("infoBtn/routeInProgress", { status: "close" });
            } else {
                topic.publish("infoBtn/reset");
            }
        },

        handleSearchInfo: function(evt) {

            var resultSrcName = evt.results[0].source.name;
            var displayInfo = this.config.searchInfo[this.searchSources[resultSrcName]].displayInfo;
            var suggestions = this.config.searchInfo[this.searchSources[resultSrcName]].dropdownSearch.suggestionTemplate;
            var outFields = this.config.searchInfo[this.searchSources[resultSrcName]].outFields;

            var results = evt.results[0].results[0].feature;
            results.displayInfo = displayInfo;
            results.suggestions = suggestions;
            results.outFields = outFields;
            results.srcName = resultSrcName;


            switch (evt.srcElementId) {
                case 'search':
                    // this.from_Info = null;
                    // this.to_Info = null;

                    this.featInfo = results;
                    this._populateOfficeCard();

                    break;
                case 'fromSearch':
                    this.from_Info = results;
                    this.fromSearch.searchWidget.clear();
                    this._populateRouteCard('from');


                    break;
                case 'toSearch':
                    this.to_Info = results;
                    this.toSearch.searchWidget.clear();
                    this._populateRouteCard('to');
                    break;
            }

        },

        handleClickInfo:  function(feat) {

            this.featInfo = feat;

            var resultSrcName = feat.attributes['srcName'];
            var displayInfo = this.config.searchInfo[this.searchSources[resultSrcName]].displayInfo;
            var suggestions = this.config.searchInfo[this.searchSources[resultSrcName]].dropdownSearch.suggestionTemplate;
            var outFields = this.config.searchInfo[this.searchSources[resultSrcName]].outFields;

            this.featInfo.displayInfo = displayInfo;
            this.featInfo.suggestions = suggestions;
            this.featInfo.outFields = outFields;

            this._populateOfficeCard();

        },

        handleSearchMultipleResults: function(origResult, multipleResults) {

          if (this.isRouting === true) {
            // routing panel visible
            // can ignore multiple results as geomtery is same
            topic.publish("search/complete", origResult);

          } else {
            // not routing panel - so display multiple values

            var resultSrcName = origResult.results[0].source.name;
            this._createMultipleResultsUI(origResult, multipleResults,resultSrcName );
            this.multipleResultsFromClick = false;
            //dojoOn(this._selectFromMultipleResults, "click", lang.hitch(this, this._searchMultipleResultsSelect, origResult));
          }
        },

        handleClickMultipleResults: function(origResult, multipleResults) {
          // regardless of routing mode , display multiple values
          // as dont know if clicked location is 'from' or 'to'
          var resultSrcName = origResult.attributes['srcName'];
          this._createMultipleResultsUI(origResult, multipleResults,resultSrcName );
          this.multipleResultsFromClick = true;
          //dojoOn(this._selectFromMultipleResults, "click", lang.hitch(this, this._spaceClickMultipleResultsSelect, origResult));

        },

        _createMultipleResultsUI: function(origResult, multipleResults, resultSrcName) {

            // clear old values
            domConstruct.empty(this.multipleRadioNode);

            var associatedOutFields = this.config.searchInfo[this.searchSources[resultSrcName]].associatedInfo.outFields;

            //var locValues = origResult.results[0].results[0].feature.attributes;

            for (var i = 0; i < multipleResults.length; i++) {
              let fldValues = "";
              fldValues = multipleResults[i][associatedOutFields[0]];

              var itemNode = domConstruct.create("input", {
                  class: "sp-multiple-list-item",
                  value: i,
                  type: 'radio',
                  name: 'multiValues',
                  id: i
              }, this.multipleRadioNode);

              var lblNode = domConstruct.create("label", {
                  class: "sp-multiple-list-item-label",
                  for: i,
                  innerHTML: fldValues
              }, this.multipleRadioNode);

              var brNode = domConstruct.create("br");
              domConstruct.place(brNode, lblNode, "after");

              dojoOn(itemNode, "click", lang.hitch(this, this._multipleResultClick, origResult, multipleResults));
            }

            this.open('multiple');
            this.currentCard = 'multiple';

        },

        _processMultipleResults: function() {
          if (this.multipleResultsFromClick) {
            this._spaceClickMultipleResultsSelect();
          } else {
            this._searchMultipleResultsSelect();
          }

        },

        _populateOfficeCard: function() {

          var values = this.featInfo.attributes;
          var displayInfo = this.featInfo.displayInfo;

          //var flds = this.config.officeCardFields;
          var fldNames = Object.keys(displayInfo);
          var fldCount = Object.keys(displayInfo).length;

          var officeNodeChildren = this.officeCardNode.children;
          // clear any previous values
          for (var j = 0; j < officeNodeChildren.length; j++) {
              if (domAttr.get(officeNodeChildren[j], 'type') === "button" ) {
                  // nothing for now
              } else {
                  // remove all classes and content
                  domClass.remove(officeNodeChildren[j]);
                  domConstruct.empty(officeNodeChildren[j]);
              }
          }

          for (var i = 0; i < fldCount; i++) {
              var elem = officeNodeChildren[i];
              if ((elem.dataset) && (elem.dataset.dojoAttachPoint)) {
                  // add class
                  var elemClass = displayInfo[fldNames[i]].class;
                  domClass.add(elem, elemClass);

                  // initialize as empty string in case content value is null
                  elem.innerHTML = "";

                  var val = values[fldNames[i]];
                  // add content
                  if (val) {
                      elem.innerHTML = val;
                      // if email , add href attribute
                      if (elemClass.toLowerCase().indexOf('email') > -1 ) {
                          elem.href = "mailto:" + val;
                      }
                  }

                  if (displayInfo[fldNames[i]].prefix) {
                      elem.innerHTML = displayInfo[fldNames[i]].prefix + elem.innerHTML;
                  }
                  if (displayInfo[fldNames[i]].suffix) {
                      elem.innerHTML = elem.innerHTML + displayInfo[fldNames[i]].suffix;
                  }

              }
          }

          this.open('office');
          this.currentCard = 'office';
        },

        _populateRouteCard: function(flag) {

            var fromPlaceholderTxt = dojoQuery('#fromSearch_input'),
                toPlaceholderTxt = dojoQuery('#toSearch_input');

            var suggestions = "";
            switch (flag) {

                case 'from':
                    suggestions = this._updatePlaceholderText(this.from_Info);
                    fromPlaceholderTxt.attr("placeholder", suggestions);
                    break;
                case 'to':
                    suggestions = this._updatePlaceholderText(this.to_Info);
                    toPlaceholderTxt.attr("placeholder", suggestions);
                    break;
            }

            // as soon as both from/to has been specified , call routing
            if ((this.from_Info) && (this.to_Info)) {
              // // route frm/to shd be points
              this._startRouting(this.isElevatorRoute);
            }

        },

        _updatePlaceholderText: function(info) {
            var suggestions = info.suggestions;
            var outFlds = info.outFields;

            for (var i = 0; i < outFlds.length; i++) {
                var val = "{" + outFlds[i] + "}";
                if (suggestions.indexOf(val) > -1 ) {
                    if (info.attributes[outFlds[i]]) {
                        suggestions = suggestions.replace(val, info.attributes[outFlds[i]]);
                    } else {
                        suggestions = suggestions.replace(val, "");
                    }
                }
            }
            return suggestions;
        },

        _routeFromBtnClick: function() {
            this.from_Info = this.featInfo;
            this._populateRouteCard('from');
            this.open('route');
            this.currentCard = 'route';
        },

        _routeToBtnClick: function() {
            this.to_Info =  this.featInfo;
            this._populateRouteCard('to');
            this.open('route');
            this.currentCard = 'route';
        },

        _multipleResultClick: function(origResult, multipleResults, clickEvt) {
          this.selectedFromMultipleResults = [];
          this.selectedFromMultipleResults = [origResult, multipleResults[clickEvt.currentTarget.value]];

        },

        _searchMultipleResultsSelect: function() {

          var origResult = this.selectedFromMultipleResults[0];
          // consolidate attr
          var feat = origResult.results[0].results[0].feature;

          var attrs = this.selectedFromMultipleResults[1];
          for (var fld in attrs) {
            if (attrs.hasOwnProperty(fld)) {
                feat.attributes[fld] = attrs[fld];
            }
          }
          origResult.results[0].results[0].feature = feat;
          topic.publish("search/complete", origResult);

        },

        _spaceClickMultipleResultsSelect: function() {
          var origResult = this.selectedFromMultipleResults[0];
          var attrs = this.selectedFromMultipleResults[1];
          // consolidate attr
          for (var fld in attrs) {
            if (attrs.hasOwnProperty(fld)) {
                origResult.attributes[fld] = attrs[fld];
            }
          }
          this.handleClickInfo(origResult);

        },

        _onMyOfficeBtnClick: function() {

        },

        _startRouting:  function(elevator) {

          // no route if same location ( multiple people per space use case)
          geometryEngineAsync.intersects(this.from_Info.geometry, this.to_Info.geometry)
              .then(lang.hitch(this, function(isEqual) {
                if (!isEqual) {
                  //true = elevator, false = stair
                  topic.publish("route/solve", this.from_Info, this.to_Info, elevator);
                  this.showLoading();
                  this.hideRouteType();
                  this.hideMeasures();
                  this.hideIdenticalInfo();
                  this.route_Distance.innerHTML = "";
                  this.route_Time.innerHTML = "";
                } else {
                  topic.publish("route/clear");
                  this.hideLoading();
                  this.hideRouteType();
                  this.hideMeasures();
                  this.showIdenticalInfo();

                }
              }));

        },

        populatePOI: function(lyrInfo) {

            //console.log(lyrInfo);

            // clear old values
            domConstruct.empty(this.poiCardNode);

            var queryTask = new QueryTask({
                    url: lyrInfo['url']
            });

            var query = new Query();
            query.returnGeometry = true;
            query.outFields = ["*"];
            query.where = "1=1";
            //query.returnZ = true;
            query.multipatchOption = "xyFootprint";


            queryTask.execute(query).then(lang.hitch(this, function(result) {

                if (result.features.length > 0) {

                    result.features.forEach(lang.hitch(this, function(feat, idx) {

                         this._populatePOICard(feat, idx, lyrInfo['fields']);
                    }));

                    this.open('poi');
                    this.currentCard = 'poi';
                }
            }));
        },

        _populatePOICard: function(feat, idx, flds) {

            var headingID = "poiHeading_" + idx;
            //var collapseID = "poiCollapse_" + idx;

            var mainNode = domConstruct.create("div", {
                class: "panel sp-poi__panel"
            }, this.poiCardNode);

            //header
            //var headingNode = domConstruct.create("div", {id: headingID,}, mainNode);
            //domAttr.set(headingNode, "role", "tab");

            // var anchorNode = domConstruct.create("a", {
            //     class: "sp-poi__collapse-btn"
            // }, headingNode);

            //var poiHeadNode = domConstruct.create("div", {class: "sp-poi__head"}, anchorNode);

            // var titleNode = domConstruct.create("h4", {
            //     class: "sp-info__title sp-info__title--poi",
            //     innerHTML: feat.attributes[flds[0]]
            // }, poiHeadNode);

            //domConstruct.place("<i class='fa fa-laptop'></i>", titleNode, "first");

            //collapse panel
            var collapseNode = domConstruct.create("div", {
                // id: collapseID,
                // class: "",
                // role: "tabpanel",
                // "aria-labelledby": headingID
            }, mainNode);

            var contentNode = domConstruct.create("div", {class: "sp-poi__content"}, collapseNode);

            // domConstruct.create("p", {
            //     innerHTML: feat.attributes[flds[1]],
            //     class: "sp-info__desc"
            // }, contentNode);

            domConstruct.create("button", {
                innerHTML: ' Route',
                id: 'btn' + headingID,
                class: "btn btn-primary sp-btn"
            }, contentNode);

            dojoOn(dom.byId('btn' + headingID), "click", lang.hitch(this, this._clickPOIRoute, feat));

        },

        _clickPOIRoute: function (feat) {
            this.to_Info = feat;
            this._populateRouteCard('to');
            this.open('route');
            this.currentCard = 'route';

        },

        _clearRoutingInfo: function () {
            this.from_Info = null;
            this.to_Info = null;

            var fromPlaceholderTxt = dojoQuery('#fromSearch_input'),
                toPlaceholderTxt = dojoQuery('#toSearch_input');

            if (fromPlaceholderTxt) {
                fromPlaceholderTxt.attr("placeholder", "");
            }

            if (toPlaceholderTxt) {
                toPlaceholderTxt.attr("placeholder", "");
            }

            topic.publish('route/close');
        },

        populateRouteInfo: function(attr) {
            if (attr) {
                var distanceString = attr['RouteLength'].toString() + ' m',
                    timeVals = attr['WalkTime'].toString().split(":"),
                    timeString = timeVals[0] + ' min ' + timeVals[1] + ' sec';

                console.log(timeVals);
                this.route_Distance.innerHTML = distanceString;
                this.route_Time.innerHTML = timeString;
            } else {
                //error in routing
                this.route_Distance.innerHTML = "";
                this.route_Time.innerHTML = "";
            }
            this.hideLoading();
            this.hideIdenticalInfo();
            this.showRouteType();
            this.showMeasures();
        },

        swapFromTo: function () {
            var tmpFrom = this.from_Info;
            var tmpTo = this.to_Info;

            // resetting from/to null so that route 'solve' is not called with partially set info
            this.from_Info = null;
            this.to_Info = null;

            this.from_Info = tmpTo;
            this._populateRouteCard('from');
            this.to_Info = tmpFrom;
            this._populateRouteCard('to');

        },

        _toggleRouteType: function() {
            var routeTypeBtn = dojoQuery('.js-route-toggle');

            if (this.isElevatorRoute === true) {
                this.isElevatorRoute = false;
                this._startRouting(false); //stairs
                routeTypeBtn.innerHTML('Need an elevator?');
                routeTypeBtn.removeClass('is-selected');
            } else {
                this.isElevatorRoute = true;
                this._startRouting(true);   //elev
                routeTypeBtn.innerHTML('Prefer the stairs?');
                routeTypeBtn.addClass('is-selected');
            }
        },

        showLoading: function() {
            dojoQuery('.js-route-loading').removeClass('is-hidden');
            dojoQuery('.js-route-toggle').attr('disabled', true);
        },

        hideLoading: function() {
            dojoQuery('.js-route-loading').addClass('is-hidden');
            dojoQuery('.js-route-toggle').attr('disabled', false);
        },

        showMeasures: function() {
            dojoQuery('.js-route-measures').removeClass('is-hidden');
        },

        hideMeasures: function() {
            dojoQuery('.js-route-measures').addClass('is-hidden');
        },

        showIdenticalInfo: function() {
            dojoQuery('.js-route-identical').removeClass('is-hidden');
        },

        hideIdenticalInfo: function() {
            dojoQuery('.js-route-identical').addClass('is-hidden');
        },

        showRouteType: function() {
            dojoQuery('.js-route-toggle').removeClass('is-hidden');
        },

        hideRouteType: function() {
            dojoQuery('.js-route-toggle').addClass('is-hidden');
        }

    });
});
