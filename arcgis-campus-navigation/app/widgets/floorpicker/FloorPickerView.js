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
    'dojo/dom-construct',
    'dojo/dom-class',
    'dojo/dom-attr',
    'dojo/query',
    'dojo/on',
    'dojo/NodeList-dom',
    "dojo/topic",
    "dojo/promise/all",

    "dijit/_WidgetBase",
    'dijit/_TemplatedMixin',

    'dojo/text!./FloorPickerView.html'],

function(declare, lang, domConstruct, domClass, domAttr, dojoQuery, dojoOn, nld, topic, all,
    _WidgetBase, _TemplatedMixin,
    template) {

    "use strict";

    return declare([_WidgetBase, _TemplatedMixin], {

        templateString: template,
        baseClass: 'vertical',
        id: 'floorPicker',

        constructor: function(options) {

            this.view = options.view;
            this.map = this.view.map;
            this.config = options.config;
            this.containerDiv = options.containerDiv;

            // sort by numbers without string conversion
            this.availFloors = Object.keys(this.config.floorPickerInfo);
            this.availFloors.sort(function(a, b) {
              return a - b;
            });

            this.grpLayerViewsInfo = {};
            this.floorLayerPromises = [];

            // each floor is a separate Layer or group Layer
            this.eachFloorAsGroup = [];

            this._selectedObjects = [];
            this.floorsLayers = [];
            //this.bldgs = [];
            this._enableFloorPicker = false;
        },

        postCreate: function() {

            this._getLayerInfo();
            this.constructUI();
        },


        _getLayerInfo: function () {
            var flrNamesArr = Object.keys(this.config.floorsLayers);

            var allLayersAndSublayers = this.view.map.layers.flatten(function(item){
              return item.layers || item.sublayers;
            });

            // work for 'all floors in single layer' and 'layer per floor' scenarios
            for (var i = 0; i < flrNamesArr.length; i++) {
              let flrName = flrNamesArr[i];
              let layersPerFloor = this.config.floorsLayers[flrName];

              //for (var lyr in layersPerFloor) {
              for (var j = 0; j < layersPerFloor.length; j++)  {

                let lyrInfo = {};

                let floorNumFld = layersPerFloor[j].floorNumberFld;
                let lyrName = layersPerFloor[j].layerName;

                var flrLayer = allLayersAndSublayers.find(function(findLyr){
                  if (lyrName.toLowerCase() === findLyr.title.toLowerCase())
                    return findLyr;
                });

                if (flrLayer) {
                  lyrInfo["flrLyr"] = flrLayer;
                  lyrInfo["flrNumFld"] = floorNumFld;

                  this.floorsLayers.push(lyrInfo);
                }
              }
            }

        },

        startup: function() {

            this.placeAt(this.containerDiv);
            this._addEventListeners();
            this.enableFloorPicker(true);
        },

        _addEventListeners: function() {
            dojoOn(this.scrollUp, 'click', lang.hitch(this, this.scrollAnimate, -1));
            dojoOn(this.scrollDown, 'click', lang.hitch(this, this.scrollAnimate, 1));
            dojoOn(this.allfloorsDiv, 'click', lang.hitch(this, this.floorButtonClick, "All"));
        },

        constructUI: function() {
            var self = this;

            // clear existing picker
            domConstruct.empty(this.floorsDiv);

            if (this.availFloors.length > 5) {
                domClass.remove(this.scrollUp, 'hide disabled');
                domClass.remove(this.scrollDown, 'hide disabled');
                domClass.add(this.domNode, 'set-height');
            } else {
                domClass.add(this.scrollUp, 'hide');
                domClass.add(this.scrollDown, 'hide');
                domClass.remove(this.domNode, 'set-height');
            }

            var grp = this.config.floorPickerInfo;

            // construct button for each floor
            for (var i = 0 ; i < this.availFloors.length ; i++) {
                var floorNumLabel = grp[this.availFloors[i]].buttonLabel;
                var floorNum = grp[this.availFloors[i]].value;

                domConstruct.create('div', {
                    'class': 'btn',
                    'innerHTML': floorNumLabel,
                    'data-floornum': floorNum,
                    'click': lang.hitch(self, self.floorButtonClick, floorNum, true)
                }, self.floorsDiv, 'first');
            }

            // initially highlight 'All' button
            domClass.toggle(this.allfloorsDiv, 'is-selected', true);

        },


        _refreshDefQry: function() {

            let defQry = "";

            if (this._selectedObjects.length === 0) {
              defQry = "1 = 1";
            } else {
              this._selectedObjects.forEach( function(flrNum) {
                defQry += "'" +  flrNum + "'," ;
              });
              defQry = defQry.substr(0, defQry.length - 1);
            }

            for (var i=0; i < this.floorsLayers.length; i++) {
                var item = this.floorsLayers[i];
                var lyr = item["flrLyr"];
                if (this._selectedObjects.length === 0) {
                  lyr.definitionExpression = defQry;
                } else {
                  var floorNumFld = item["flrNumFld"];
                  lyr.definitionExpression = floorNumFld + " IN (" + defQry + ")";
                }
            }

        },


        floorButtonClick: function(flr, multiSelect) {

            topic.publish("slide-floorLayersAvailable");

            if (flr === 'All') {
                this._selectedObjects = [];
            } else {
              if (multiSelect) {
                if (this._selectedObjects.indexOf(flr) > -1) {
                    // already selected - unselect
                    this._selectedObjects.splice( this._selectedObjects.indexOf(flr), 1);
                } else {
                    // not selected - select it now
                    this._selectedObjects.push(flr);
                }
              } else {
                // not multiselect - clear prev flrs
                this._selectedObjects = [];
                this._selectedObjects.push(flr);
              }

            }

            this._refreshDefQry();
            // highlight selected button
            this.updateHighlightedFloor(flr);
        },

        scrollAnimate: function(scrollInt) {

            var scrollFloorsPerClick = 1;
            var numVisibleFloorButtons = 5;
            var floorDivHt = this.floorsDiv.getBoundingClientRect().height;
            var buttonHt = floorDivHt/numVisibleFloorButtons;

            // scroll by 2 floors if num of floors greater than 5 AND there are at least 2 more floors available to scroll into view
            if (this.availFloors.length > 5){
                var floorsDivBB = this.floorsDiv.getBoundingClientRect();
                if (scrollInt < 0) {
                    var topButton = dojoQuery('.btn', this.floorsDiv)[0];
                    if (Math.abs(topButton.getBoundingClientRect().top - floorsDivBB.top) >= buttonHt * 2){
                        scrollFloorsPerClick = 2;
                    }
                } else {
                    var bottomButton = dojoQuery('.btn:last-child', this.floorsDiv)[0];
                    if (Math.abs(bottomButton.getBoundingClientRect().bottom - floorsDivBB.bottom) >= buttonHt * 2){
                         scrollFloorsPerClick = 2;
                    }
                }
            }

            this.floorsDiv.scrollTop += scrollInt * scrollFloorsPerClick * buttonHt;
        },

        updateHighlightedFloor: function(flr) {
            // highlight selected button

            if (flr === 'All') {
                domClass.add(this.allfloorsDiv, 'is-selected');
            } else {
                domClass.remove(this.allfloorsDiv, 'is-selected');
            }

            dojoQuery('.floors-div .btn').forEach(lang.hitch(this, function(node) {
                var nodeFlr = domAttr.get(node, 'data-floornum');

                if (this._selectedObjects.indexOf(nodeFlr) > -1) {
                    domClass.add(node, 'is-selected');
                } else {
                    domClass.remove(node, 'is-selected');
                }

            }));

        },

        enableFloorPicker: function(flgEnable) {
            this._enableFloorPicker = flgEnable;
            dojoQuery('.fp-wrapper').forEach(lang.hitch(this, function(node) {
                if (flgEnable) {
                    domClass.remove(node, 'hide');
                    //reset
                    this._selectedObjects = [];
                    this.updateHighlightedFloor('All');

                } else {
                     domClass.add(node, 'hide');
                }
            }));
        }

    });
});
