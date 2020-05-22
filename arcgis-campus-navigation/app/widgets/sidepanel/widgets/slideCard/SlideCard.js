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
    'dojo/dom',
    'dojo/dom-class',
    'dojo/dom-attr',
    'dojo/topic',
    'dojo/on',
    'dojo/NodeList-dom',
    "dojo/promise/all",
    'dojo/Deferred',

    './widgets/slideItem/SlideItem',
    './widgets/slidesBtn/SlidesBtn',

    "dijit/_WidgetBase",
    'dijit/_TemplatedMixin',

    'dojo/text!./SlideCard.html'],

function(declare, lang, dom, domClass, domAttr, topic, dojoOn, nld, all, Deferred,
    SlideItem, SlidesBtn,
    _WidgetBase, _TemplatedMixin,
    template) {

    "use strict";

    return declare([_WidgetBase, _TemplatedMixin], {

        templateString: template,
        slides: [],

        constructor: function(options) {
            this.view = options.view;
            this.config = options.config;
            this.containerDiv = options.containerDiv;
            this.lyrPromises = [];
            this.allLayerViewsInfo = {};
            this.slideVisibleLayers = {};
            this.currentSlideName = "";

        },

        postCreate: function() {

            // domAttr.set(this.slideCardImg, 'src', this.imgURL);
            // this.slideCardTitle.innerHTML = this.title;
            // domAttr.set(this.slideCardContainer, 'id', this.id);
        },

        startup: function() {

            this.placeAt(this.containerDiv);

            this.slidesBtn = new SlidesBtn({
                view: this.view,
                containerDiv: 'slides-btn',
                config: this.config
            });
            this.slidesBtn.startup();


            this._setupSlides();
            this._getLayerViews();

            // set first slide as default
            this.currentSlideName = this.view.map.presentation.slides.getItemAt(0).title.text;
        },

        _setupSlides: function() {
            var slides = this.view.map.presentation.slides;

            //loop through each slide in the collection
            slides.forEach(lang.hitch(this, function(slide, idx) {

                var slideItem = new SlideItem({
                    id: slide.id,
                    title: slide.title.text,
                    imgURL: slide.thumbnail.url,
                    desc: slide.description.text
                }).placeAt(this.slidesList);

                if (idx === 0) {
                    domClass.add(dom.byId(slideItem.id), 'is-selected');
                }

                this.slides.push(slideItem);

                dojoOn(dom.byId(slideItem.id), "click", lang.hitch(this, this._clickSlide));

                // get visible layers per slide
                var visLyrs = [];
                for (var i = 0; i < slide.visibleLayers.length; i++) {
                  var lyrId = slide.visibleLayers.items[i].id;
                  var lyr = this.view.map.findLayerById(lyrId);

                  if (lyr && lyr.title && lyr.title.length > 0) {    // this is null for graphics layer

                    // dont add grp layer - as visible sub-layers are in 'visibleLayers' also
                    if (lyr.hasOwnProperty('layers')) {
                        //only add visible lyrs in grp lyr

                    } else {
                      visLyrs.push(lyr.id);
                    }
                  }
                }

                this.slideVisibleLayers[slide.title.text] = visLyrs;

            }));

        },

        _getLayerViews: function() {
            var self = this;

            // filteredLayers is a Collection of non-graphic layers
            var filteredLayers = this.view.map.layers.filter(function(filLyr){
              return (filLyr.operationalLayerType); //graphic layers does not have 'operationalLayerType'
            });

            for (var i = 0; i < filteredLayers.length; i++) {
                var lyrInfo = filteredLayers.items[i];
                //group layer
                if (lyrInfo.hasOwnProperty('layers')) {
                    for (var j = 0; j < lyrInfo.layers.length; j++) {
                        // store sub-layer
                        self._handleLayerViewPromises(lyrInfo.layers.items[j]);
                    }
                } else {
                  // store the single layer
                  self._handleLayerViewPromises(lyrInfo);
                }
            }

            all(self.lyrPromises).then(function(lyrViewsArr) {
                lyrViewsArr.forEach(function(lyrView) {
                    // store the layerviews with the layer id
                    self.allLayerViewsInfo[lyrView.layer.id] = lyrView;
                });

            }, function(err) {
                console.log(err);
            });

         },

        _handleLayerViewPromises: function(lyrInfo) {
            //layerView may not be initialized - also add to 'promises' array to get consolidated results
            this.lyrPromises.push(
                this.view.whenLayerView(lyrInfo)
                    .then(function(layerView) {
                        return layerView;
                    } , function(error) {
                        console.log("error " + error);
                    })
            );
        },

        _clickSlide: function(clickEvt) {
            var slideName = clickEvt.currentTarget.title;

            this.resetSlideLayers(slideName).then( function(flg) {
                topic.publish("slideCard/slideChanged", slideName);
            });
        },

        //temp function
        cascadeGroupSettings: function(groupLayer, prop, val) {
            groupLayer.layers.forEach(function(lyr){
                lyr[prop] = val;
            });

        },

        deselect: function() {
            this.slidesBtn.deselect();
        },

        routeInProgress: function(status) {
            this.slidesBtn.routeInProgress(status);
        },

        getRequestedSlide: function(slideName) {
            var slide = this.view.map.presentation.slides.find(function(item){
                if(item.title.text.toLowerCase().indexOf(slideName.toLowerCase()) > -1) {
                    return item;
                }
            });

            return slide;
        },

        resetSlideLayers: function(slideName) {
            var deferred = new Deferred();
            var status = false;

             //unselect all slide buttons
            this.slides.forEach(lang.hitch(this, function(slide) {
                //console.debug('clearing slide item class', slide);
                domClass.remove(dom.byId(slide.id), 'is-selected');
            }));

            var slide = this.view.map.presentation.slides.find(function(item){
                if(item.title.text.toLowerCase().indexOf(slideName.toLowerCase()) > -1) {
                    return item;
                }
            });

            domClass.add(dom.byId(slide.id), 'is-selected');

            var allIds = Object.keys(this.allLayerViewsInfo);

            slide.applyTo(this.view).then( lang.hitch(this, function() {
                // have to reset layers visibility
                var lyrIds = this.slideVisibleLayers[slide.title.text];

                for (var i=0; i < allIds.length; i++) {
                    var lyrVw = this.allLayerViewsInfo[allIds[i]];

                    if (lyrVw) {
                        if ( lyrIds.indexOf(allIds[i]) > -1 ) {
                            // layer is visible in this slide
                            lyrVw.visible = true;
                        } else {
                            lyrVw.visible = false;
                        }
                    }
                }

                this.currentSlideName = slide.title.text;
                status = true;
                deferred.resolve(status);
            }));
            return deferred.promise;

        }

    });
});
