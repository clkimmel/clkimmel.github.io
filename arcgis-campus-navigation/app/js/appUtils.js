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
    'dojo/Deferred',
    'dojo/_base/lang',

    "esri/layers/FeatureLayer",
    "esri/Color",
    "esri/symbols/TextSymbol",
    "esri/tasks/support/Query",
    "esri/tasks/support/RelationshipQuery",
    "esri/tasks/QueryTask",
    "esri/request"
    ],
    function (
        Deferred, lang,
        FeatureLayer, Color, TextSymbol,
        RelationshipQuery, Query, QueryTask, esriRequest
        ){

        "use strict";

        return {

            retrieveFeatureLayerColors: function(url) {

                var deferred = new Deferred();
                var fl = new FeatureLayer({
                    url: url
                });

                var colorsObj = {};
                var arrCols = [];
                var fld = null;
                fl.load().then(lang.hitch(this, function(){

                    fld = fl.renderer.field;
                    var uniqValues = fl.renderer.uniqueValueInfos;
                    for (var i = 0; i < uniqValues.length; i++ ) {
                        var label = uniqValues[i].value;
                        var sym = uniqValues[i].symbol;

                        colorsObj[label] = new Color(sym.color).toHex();
                        arrCols.push(new Color(sym.color).toHex());

                    }

                    // default symbol - 'all other values'
                    colorsObj[fl.renderer.defaultLabel] = new Color(fl.renderer.defaultSymbol.color).toHex();
                    arrCols.push(new Color(fl.renderer.defaultSymbol.color).toHex());

                    deferred.resolve([fld, colorsObj, arrCols, fl.renderer.defaultLabel , fl.renderer.defaultSymbol ]);
                }) );
                return deferred;
            },

            retrieveFeatureLayerColorsGroup: function(url) {

                var deferred = new Deferred();
                var fl = new FeatureLayer({
                    url: url
                });

                var colorsObj = {};
                var labelsObj = {};
                var fld = null;
                fl.load().then(lang.hitch(this, function(){

                    fld = fl.renderer.field;
                    var uniqValues = fl.renderer.uniqueValueInfos;
                    for (var i = 0; i < uniqValues.length; i++ ) {
                        var val = uniqValues[i].value;
                        var sym = uniqValues[i].symbol;
                        var label = uniqValues[i].label;

                        colorsObj[val] = new Color(sym.color).toHex();

                        // easier to retrieve if based on each value
                        labelsObj[val] = label;

                        // if (labelsObj.hasOwnProperty(label)) {
                        //     var tmpVals = labelsObj[label];
                        //     tmpVals.push(val);
                        //     labelsObj[label] = tmpVals;
                        // } else {
                        //     labelsObj[label] = [val];
                        // }
                    }
                    deferred.resolve([fld, colorsObj, labelsObj]);
                }) );
                return deferred;
            },


            getTextSymbol: function(sym, col, fnt) {

                var txtSymbol = new TextSymbol({
                    color:col,
                    text: sym,
                    font: fnt
                  });

                return txtSymbol;
            },

            getQueryResults: function(qryUrl , queryWhere, outFlds) {

              var deferred = new Deferred();

              // using esriRequest as regular Query is ignoring outFlds/returnGeom property here
              var options = {
                  query: {
                      f: 'json',
                      returnGeometry: true,
                      returnZ: true,
                      outFields:outFlds,
                      where: queryWhere
                  },
                  responseType: "json"
              };

              esriRequest(qryUrl + "/query", options).then(function(response) {
                  //console.log(response);
                  deferred.resolve(response.data.features);
              });

            return deferred.promise;
            },

            getQueryIds: function(qryUrl , queryWhere) {

              var deferred = new Deferred();
              var options = {
                  query: {
                      f: 'json',
                      returnIdsOnly:true,
                      where: queryWhere
                  },
                  responseType: "json"
              };

              esriRequest(qryUrl + "/query", options).then(function(response) {
                  // returns array of IDs
                  deferred.resolve(response.data);
              });

            return deferred.promise;
            },

            getSearchSourceInfo: function(searchConfig) {
                var searchSources = {};
                for (var searchOrder in searchConfig) {
                    if (searchConfig.hasOwnProperty(searchOrder)) {
                        searchSources[searchConfig[searchOrder].name] = searchOrder;
                    }
                }
                return searchSources;

            },

            layerNameFromUrl: function(lyrUrl, pattern) {
              var endIdx = lyrUrl.lastIndexOf(pattern);
              var startIdx = lyrUrl.lastIndexOf('/', (endIdx - 1) );
              var lyrName = lyrUrl.substring((startIdx + 1), endIdx );
              return lyrName;
            },

            consolidateInfo: function(origResults, featArr) {

              //handle geometry with no Z
              var zVal = null;

              //get first geometry from array
              if (!origResults.geometry.hasZ) {
                if (featArr.length >= 1) {
                  zVal = featArr[0].geometry.z;
                }
              }

              // handle attributes
              let multipleFlg = false;

              if (featArr.length > 1) {
                // if multiple results 1:many , return attrs of multiple results
                let multipleResults = [];
                multipleFlg = true;
                for (var i = 0; i < featArr.length; i++) {
                  multipleResults.push(featArr[i].attributes);
                }

                return [multipleFlg, multipleResults, zVal];

              } else if (featArr.length === 1) {
                // if 1:1 results , orig Search result attr are consolidated with the associated result attr
                var attr = featArr[0].attributes;
                for (var fld in attr) {
                  if (attr.hasOwnProperty(fld)) {
                      origResults.attributes[fld] = attr[fld];
                  }
                }
                return [multipleFlg, origResults, zVal];

              } else if (featArr.length <= 0) {
                // no associated results - eg for conf room

                // do we need to do any processing here?
                return [multipleFlg, origResults, zVal];


              }


            },

            getAssociatedInfo: function(associatedInfo, feat) {

              let queryVal = feat.attributes[associatedInfo['matchingQueryField']];
              if (associatedInfo.hasOwnProperty('queryFieldType') &&
                  associatedInfo['queryFieldType'].toString().toLowerCase() !== "number") {
                queryVal = "'" + queryVal + "'";
              }

              var queryWhere = associatedInfo['queryField'] + " = " + queryVal;

              return [associatedInfo['url'], queryWhere, associatedInfo['outFields']];

            },

            getAssociatedResults: function(arr) {
              return this.getQueryResults(arr[0], arr[1], arr[2]);
            },

            getConsolidatedAttrs: function(origResults, results) {
              origResults.attributes = results.features["0"].attributes;
              return origResults;
            }


    };
});
