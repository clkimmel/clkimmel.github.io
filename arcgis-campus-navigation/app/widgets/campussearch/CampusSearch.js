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
    'dojo/topic',
    'dojo/on',
    "dojo/_base/lang",
    'dojo/Deferred',

    "esri/widgets/Search",
    "esri/layers/FeatureLayer"

    ],
    function(
        declare, topic, on, lang, Deferred,
        esriSearch, FeatureLayer
        ) {

        "use strict";

        return declare([], {

            constructor: function(options) {
                this.config = options.config;
                this.sceneView = options.view;
                this.map = this.sceneView.map;
                this.containerDiv = options.containerDiv;
                this.appUtils = options.appUtils;

                var allSrc = [];
                var searchInfo = this.config.searchInfo;
                for (var searchOrder in searchInfo) {
                    if (searchInfo.hasOwnProperty(searchOrder)) {
                        var src = {
                            featureLayer: new FeatureLayer({
                                url: searchInfo[searchOrder].dropdownSearch.queryUrl,
                            }),
                            searchFields: searchInfo[searchOrder].dropdownSearch.queryFields,
                            exactMatch: false,
                            outFields: searchInfo[searchOrder].outFields,
                            placeholder: searchInfo[searchOrder].dropdownSearch.placeholder,
                            name: searchInfo[searchOrder].name,
                            popupEnabled: false,
                            popupOpenOnSelect: false,
                            resultGraphicEnabled: false,
                            autoNavigate: false,
                            suggestionTemplate: searchInfo[searchOrder].dropdownSearch.suggestionTemplate,
                            searchQueryParams:  { returnGeometry:true , returnZ: true} ,
                            zoomScale: this.config.viewZoom,
                            minSuggestCharacters: 1
                        };
                        allSrc.push(src);
                    }
                }

                this.searchWidget = new esriSearch({
                    view: this.sceneView,
                    allPlaceholder: this.config.allSearchPlaceholder,
                    autoSelect: false,
                    activeSourceIndex: -1,
                    searchAllEnabled: true,
                    sources: allSrc
                  }, this.containerDiv);

                this.attachEventListeners();
                this.searchSources = {};
            },

            startup: function() {
                this.searchSources = this.appUtils.getSearchSourceInfo(this.config.searchInfo);
            },

            attachEventListeners: function() {
                this.searchWidget.on("search-complete", lang.hitch(this, "_processSearchResults"));

                this.searchWidget.on("suggest-complete", function(event){
                  //console.log("Results of suggest: ", event);
                  if (event.numResults <= 0) {
                    //'No results found';
                  }

                });


            },

            _processSearchResults: function(evt) {

              var self = this;

              // identify src element - used in SidePanelView
              evt.srcElementId = this.searchWidget.id;

              var resultSrcName = evt.results[0].source.name;
              var searchObj = self.config.searchInfo[self.searchSources[resultSrcName]];
              let feat = evt.results[0].results[0].feature;

              // check if associated Info exists
              if (searchObj.hasOwnProperty('associatedInfo') && searchObj['associatedInfo'].toString().length > 0) {
                // get the config info as array
                var associatedInfo = self.appUtils.getAssociatedInfo(searchObj['associatedInfo'], feat);

                self.appUtils.getAssociatedResults(associatedInfo)
                  .then(self.appUtils.consolidateInfo.bind(self,feat))
                  .then(function(updtData) {

                    // if original result has no Z val
                    if (!evt.results[0].results[0].feature.geometry.hasZ && (updtData[2] != null)) {
                        //update orig geom with this z
                        evt.results[0].results[0].feature.geometry.hasZ = true;
                        evt.results[0].results[0].feature.geometry.z = updtData[2];
                    }

                    // if multiple results 1:many , return geometry and attrs of multiple results
                    if (updtData[0]) {  // value of multipleFlg
                      topic.publish("search/multipleResults", evt, updtData[1]);
                    } else {
                      // if 1:1 results , result attr are consolidated with geometry
                      evt.results[0].results[0].feature = updtData[1];
                      topic.publish("search/complete", evt);
                    }
                  }
                );

              } else {  // no associated Info
                topic.publish("search/complete", evt);
              }

            }

        });

    });
